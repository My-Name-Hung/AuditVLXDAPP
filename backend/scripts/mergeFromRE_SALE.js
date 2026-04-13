/**
 * ============================================================
 * SCRIPT: mergeFromRE_SALE.js  (DIRECT CHUNKED — no temp tables)
 * MỤC ĐÍCH: Merge data từ RE_SALE_20260410 sang DBXMTD
 * CÁCH CHẠY: node scripts/mergeFromRE_SALE.js
 * CHIẾN LƯỢC:
 *   - Bước 1-5: INSERT...SELECT trực tiếp (ít data)
 *   - Bước 6+: Chunk OldIds từ source → lookup NewId bằng IN subquery
 * ============================================================
 */

const path = require("path");
const fs = require("fs");

const envPaths = [
  path.join(__dirname, ".env"),
  path.join(__dirname, "../.env"),
  path.join(__dirname, "../../.env"),
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
    console.log(`Loaded .env from: ${envPath}`);
    break;
  }
}

const sql = require("mssql");

const SOURCE_DB = process.env.RE_SALE_DB || "RE_SALE_20260410";
const BATCH_SIZE = parseInt(process.env.MERGE_BATCH_SIZE || "3000");

const sqlConfig = (db) => ({
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || "1433"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: db,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
    enableArithAbort: true,
  },
  pool: { max: 1, min: 0, idleTimeoutMillis: 60000 },
  connectionTimeout: 60000,
  requestTimeout: 600000,
});

const SOURCE_CONFIG = sqlConfig(SOURCE_DB);
const TARGET_CONFIG = sqlConfig(process.env.DB_NAME);
const SRC = SOURCE_DB;

// ──────────────────────────────────────
// HELPERS
// ──────────────────────────────────────

async function connect(config, label) {
  console.log(`🔌 ${label}: ${config.server}/${config.database}...`);
  const pool = await sql.connect(config);
  console.log(`   ✅ Connected`);
  return pool;
}

function ts() {
  return new Date().toISOString().slice(11, 23);
}
function log(n, m) {
  console.log(`[${ts()}] STEP ${n}: ${m}`);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function batchChunks(total, size) {
  const chunks = [];
  for (let i = 0; i < total; i += size) chunks.push({ offset: i, limit: size });
  return chunks;
}

// Chạy INSERT...SELECT trên target, bỏ qua duplicate
async function safeInsert(pool, label, q, timeout = 300000) {
  try {
    const r = await pool.request().query(q, { timeout });
    const n = r.rowsAffected[0];
    if (n > 0) console.log(`   ✅ ${label}: +${n}`);
    else console.log(`   ⏭  ${label}: 0 (already exists)`);
    return n;
  } catch (err) {
    if (err.number === 2627 || err.number === 2601) {
      console.log(`   ⏭  ${label}: duplicates skipped`);
      return 0;
    }
    throw err;
  }
}

// Lấy count từ source
async function srcCount(pool, table) {
  try {
    const r = await pool
      .request()
      .query(`SELECT COUNT(*) as c FROM ${SRC}.dbo.${table}`, {
        timeout: 30000,
      });
    return r.recordset[0].c;
  } catch {
    return 0;
  }
}

// Lấy MaxId/Num từ target
async function targetMax(pool, table, pattern, extractor) {
  try {
    const r = await pool
      .request()
      .query(
        `SELECT ISNULL(MAX(${extractor}), 0) as m FROM ${table} WHERE ${pattern}`,
        { timeout: 30000 },
      );
    return r.recordset[0].m;
  } catch {
    return 0;
  }
}

// ──────────────────────────────────────
// STEP 1: Territories
// ──────────────────────────────────────
async function step1(pool) {
  log(1, "Territories...");
  const c = await srcCount(pool, "Territories");
  console.log(`   (source: ${c} rows)`);
  await safeInsert(
    pool,
    "Territories",
    `
    INSERT INTO Territories (TerritoryName, CreatedAt, UpdatedAt)
    SELECT TerritoryName, ISNULL(CreatedAt, GETDATE()), ISNULL(UpdatedAt, GETDATE())
    FROM ${SRC}.dbo.Territories src
    WHERE NOT EXISTS (SELECT 1 FROM Territories WHERE TerritoryName = src.TerritoryName)
  `,
  );
}

// ──────────────────────────────────────
// STEP 2: CementProducts
// ──────────────────────────────────────
async function step2(pool) {
  log(2, "CementProducts...");
  const c = await srcCount(pool, "CementProducts");
  console.log(`   (source: ${c} rows)`);
  await safeInsert(
    pool,
    "CementProducts",
    `
    INSERT INTO CementProducts (Code, Name, CreatedAt, UpdatedAt)
    SELECT Code, Name, ISNULL(CreatedAt, GETDATE()), ISNULL(UpdatedAt, GETDATE())
    FROM ${SRC}.dbo.CementProducts src
    WHERE NOT EXISTS (SELECT 1 FROM CementProducts WHERE Code = src.Code)
  `,
  );
}

// ──────────────────────────────────────
// STEP 3: Users (chunked)
// ──────────────────────────────────────
async function step3(pool) {
  log(3, "Users...");
  const total = await srcCount(pool, "Users");
  console.log(`   (source: ${total} rows, batch: ${BATCH_SIZE})`);
  const startNum = await targetMax(
    pool,
    "Users",
    "UserCode LIKE 'U%'",
    "CAST(SUBSTRING(UserCode,2,10) AS INT)",
  );
  console.log(`   (target max: U${startNum})`);

  const t0 = Date.now();
  let totalIns = 0;

  for (const { offset, limit } of batchChunks(total, BATCH_SIZE)) {
    // Lấy batch user từ source
    const srcR = await pool.request().query(
      `
      SELECT Id, Username, FullName, Email, Phone, Role, Position, CreatedAt, UpdatedAt
      FROM ${SRC}.dbo.Users
      ORDER BY Id OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `,
      { timeout: 120000 },
    );
    const srcRows = srcR.recordset;
    if (srcRows.length === 0) break;

    // Check existing usernames
    const usernames = srcRows
      .map((r) => `N'${r.Username.replace(/'/g, "''")}'`)
      .join(", ");
    const existR = await pool
      .request()
      .query(
        `SELECT LOWER(Username) as u FROM Users WHERE Username IN (${usernames})`,
        { timeout: 30000 },
      );
    const existSet = new Set(existR.recordset.map((r) => r.u.toLowerCase()));

    const newOnes = srcRows.filter(
      (r) => !existSet.has(r.Username.toLowerCase()),
    );
    if (newOnes.length === 0) continue;

    const vals = newOnes
      .map((r, i) => {
        const code = `U${String(startNum + totalIns + i + 1).padStart(6, "0")}`;
        const createdAt = r.CreatedAt
          ? `'${new Date(r.CreatedAt).toISOString()}'`
          : "GETDATE()";
        return (
          `('${code}', N'${r.Username.replace(/'/g, "''")}', 'HASH_PLACEHOLDER_${r.Id}', ` +
          `N'${(r.FullName || "").replace(/'/g, "''")}', N'${(r.Email || "").replace(/'/g, "''")}', ` +
          `N'${(r.Phone || "").replace(/'/g, "''")}', N'${r.Role || "user"}', N'${(r.Position || "").replace(/'/g, "''")}', ` +
          `1, ${createdAt}, GETDATE())`
        );
      })
      .join(", ");

    try {
      const ir = await pool
        .request()
        .query(
          `INSERT INTO Users (UserCode,Username,Password,FullName,Email,Phone,Role,Position,IsChangePassword,CreatedAt,UpdatedAt) VALUES ${vals}`,
          { timeout: 120000 },
        );
      totalIns += ir.rowsAffected[0];
    } catch (err) {
      if (err.number !== 2627 && err.number !== 2601) throw err;
    }
  }

  console.log(`   ✅ Users: +${totalIns} in ${Date.now() - t0}ms`);
}

// ──────────────────────────────────────
// STEP 4: Stores (chunked)
// ──────────────────────────────────────
async function step4(pool) {
  log(4, "Stores...");
  const total = await srcCount(pool, "Stores");
  console.log(`   (source: ${total} rows, batch: ${BATCH_SIZE})`);
  const startNum = await targetMax(
    pool,
    "Stores",
    "StoreCode LIKE 'CH%'",
    "CAST(SUBSTRING(StoreCode,3,10) AS INT)",
  );
  console.log(`   (target max: CH${startNum})`);

  const t0 = Date.now();
  let totalIns = 0;

  for (const { offset, limit } of batchChunks(total, BATCH_SIZE)) {
    const srcR = await pool.request().query(
      `
      SELECT s.Id, s.StoreName, s.Address, s.Phone, s.Email,
             s.Latitude, s.Longitude, s.Status, s.Rank, s.TaxCode, s.PartnerName,
             s.TerritoryId, src_t.TerritoryName
      FROM ${SRC}.dbo.Stores s
      LEFT JOIN ${SRC}.dbo.Territories src_t ON src_t.Id = s.TerritoryId
      ORDER BY s.Id OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `,
      { timeout: 120000 },
    );
    const srcRows = srcR.recordset;
    if (srcRows.length === 0) break;

    // Resolve TerritoryId: TerritoryName → Id trên target
    const tNames = srcRows
      .filter((r) => r.TerritoryName)
      .map((r) => `N'${r.TerritoryName.replace(/'/g, "''")}'`)
      .join(", ");
    let terrMap = {};
    if (tNames) {
      const tR = await pool
        .request()
        .query(
          `SELECT TerritoryName, Id FROM Territories WHERE TerritoryName IN (${tNames})`,
          { timeout: 30000 },
        );
      for (const r of tR.recordset) terrMap[r.TerritoryName] = r.Id;
    }

    // Check duplicate stores
    const dupsR = await pool.request().query(
      `
      SELECT StoreName, Address FROM Stores
      WHERE StoreName IN (${srcRows.map((r) => `N'${r.StoreName.replace(/'/g, "''")}'`).join(", ")})
    `,
      { timeout: 30000 },
    );
    const dupSet = new Set(
      dupsR.recordset.map((r) => `${r.StoreName}|${r.Address || ""}`),
    );

    const newOnes = srcRows.filter(
      (r) => !dupSet.has(`${r.StoreName}|${r.Address || ""}`),
    );
    if (newOnes.length === 0) continue;

    const vals = newOnes
      .map((r, i) => {
        const code = `CH${String(startNum + totalIns + i + 1).padStart(6, "0")}`;
        const lat = r.Latitude != null ? r.Latitude : "NULL";
        const lng = r.Longitude != null ? r.Longitude : "NULL";
        const tid =
          r.TerritoryName && terrMap[r.TerritoryName]
            ? terrMap[r.TerritoryName]
            : "NULL";
        return (
          `('${code}', N'${r.StoreName.replace(/'/g, "''")}', N'${(r.Address || "").replace(/'/g, "''")}', ` +
          `N'${(r.Phone || "").replace(/'/g, "''")}', N'${(r.Email || "").replace(/'/g, "''")}', ` +
          `${lat}, ${lng}, ${tid}, NULL, N'${r.Status || "not_audited"}', N'${(r.Rank || "").replace(/'/g, "''")}', ` +
          `N'${(r.TaxCode || "").replace(/'/g, "''")}', N'${(r.PartnerName || "").replace(/'/g, "''")}', GETDATE(), GETDATE())`
        );
      })
      .join(", ");

    try {
      const ir = await pool
        .request()
        .query(
          `INSERT INTO Stores (StoreCode,StoreName,Address,Phone,Email,Latitude,Longitude,TerritoryId,UserId,Status,Rank,TaxCode,PartnerName,CreatedAt,UpdatedAt) ` +
            `VALUES ${vals}`,
          { timeout: 120000 },
        );
      totalIns += ir.rowsAffected[0];
    } catch (err) {
      if (err.number !== 2627 && err.number !== 2601) throw err;
    }
  }

  console.log(`   ✅ Stores: +${totalIns} in ${Date.now() - t0}ms`);
}

// ──────────────────────────────────────
// STEP 5: StoreUsers
// ──────────────────────────────────────
async function step5(pool) {
  log(5, "StoreUsers...");
  const c = await srcCount(pool, "StoreUsers");
  console.log(`   (source: ${c} rows)`);
  await safeInsert(
    pool,
    "StoreUsers",
    `
    INSERT INTO StoreUsers (StoreId, UserId, CreatedAt)
    SELECT dst_s.Id, dst_u.Id, ISNULL(src.CreatedAt, GETDATE())
    FROM ${SRC}.dbo.StoreUsers src
    INNER JOIN ${SRC}.dbo.Stores src_s ON src.StoreId = src_s.Id
    INNER JOIN ${SRC}.dbo.Users src_u ON src.UserId = src_u.Id
    INNER JOIN Stores dst_s ON dst_s.StoreName = src_s.StoreName
    INNER JOIN Users dst_u ON dst_u.Username = src_u.Username
    WHERE NOT EXISTS (
      SELECT 1 FROM StoreUsers dst
      WHERE dst.StoreId = dst_s.Id AND dst.UserId = dst_u.Id
    )
  `,
    300000,
  );
}

// ──────────────────────────────────────
// STEP 6: Audits (chunked — lớn nhất)
// ──────────────────────────────────────
async function step6(pool) {
  log(6, "Audits (may take a while)...");
  const total = await srcCount(pool, "Audits");
  console.log(`   (source: ${total} rows, batch: ${BATCH_SIZE})`);

  const t0 = Date.now();
  let totalIns = 0;

  for (const { offset, limit } of batchChunks(total, BATCH_SIZE)) {
    // Lấy audit rows từ source kèm Username/StoreName
    const srcR = await pool.request().query(
      `
      SELECT a.Id, a.Result, a.Notes, a.FailedReason, a.AuditDate, a.CreatedAt, a.UpdatedAt,
             u.Username, s.StoreName
      FROM ${SRC}.dbo.Audits a
      INNER JOIN ${SRC}.dbo.Users u ON a.UserId = u.Id
      INNER JOIN ${SRC}.dbo.Stores s ON a.StoreId = s.Id
      ORDER BY a.Id
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `,
      { timeout: 180000 },
    );
    const srcRows = srcR.recordset;
    if (srcRows.length === 0) break;

    // Lookup NewUserId + NewStoreId trên target
    const uniqUsers = [...new Set(srcRows.map((r) => r.Username))];
    const uniqStores = [...new Set(srcRows.map((r) => r.StoreName))];
    const uIn = uniqUsers.map((u) => `N'${u.replace(/'/g, "''")}'`).join(", ");
    const sIn = uniqStores.map((s) => `N'${s.replace(/'/g, "''")}'`).join(", ");

    const mapR = await pool.request().query(
      `
      SELECT u.Username, u.Id AS uid, s.StoreName, s.Id AS sid
      FROM Users u CROSS JOIN Stores s
      WHERE u.Username IN (${uIn}) AND s.StoreName IN (${sIn})
    `,
      { timeout: 120000 },
    );

    const keyMap = {};
    for (const r of mapR.recordset)
      keyMap[`${r.Username}|${r.StoreName}`] = { uid: r.uid, sid: r.sid };

    const valid = srcRows
      .map((r) => ({ ...r, m: keyMap[`${r.Username}|${r.StoreName}`] }))
      .filter((r) => r.m);

    if (valid.length === 0) continue;

    // Insert sub-batch 500 rows
    const SUB = 500;
    for (let i = 0; i < valid.length; i += SUB) {
      const chunk = valid.slice(i, i + SUB);
      const vals = chunk
        .map((r) => {
          const dt = r.AuditDate
            ? `'${new Date(r.AuditDate).toISOString()}'`
            : "GETDATE()";
          const created = r.CreatedAt
            ? `'${new Date(r.CreatedAt).toISOString()}'`
            : "GETDATE()";
          const updated = r.UpdatedAt
            ? `'${new Date(r.UpdatedAt).toISOString()}'`
            : "GETDATE()";
          const notes = r.Notes ? `N'${r.Notes.replace(/'/g, "''")}'` : "NULL";
          const fr = r.FailedReason
            ? `N'${r.FailedReason.replace(/'/g, "''")}'`
            : "NULL";
          return `(${r.m.uid}, ${r.m.sid}, N'${(r.Result || "audited").replace(/'/g, "''")}', ${notes}, ${fr}, ${dt}, ${created}, ${updated})`;
        })
        .join(", ");

      try {
        const ir = await pool.request().query(
          `
          INSERT INTO Audits (UserId, StoreId, Result, Notes, FailedReason, AuditDate, CreatedAt, UpdatedAt)
          SELECT UserId, StoreId, Result, Notes, FailedReason, AuditDate, CreatedAt, UpdatedAt
          FROM (VALUES ${vals}) v(UserId,StoreId,Result,Notes,FailedReason,AuditDate,CreatedAt,UpdatedAt)
          WHERE NOT EXISTS (
            SELECT 1 FROM Audits a
            WHERE a.UserId = v.UserId AND a.StoreId = v.StoreId
              AND CAST(a.AuditDate AS DATE) = CAST(v.AuditDate AS DATE)
          )
        `,
          { timeout: 120000 },
        );
        totalIns += ir.rowsAffected[0];
      } catch (err) {
        if (err.number !== 2627 && err.number !== 2601) {
          // row-by-row fallback
          let sub = 0;
          for (const r of chunk) {
            try {
              const dt = r.AuditDate
                ? `'${new Date(r.AuditDate).toISOString()}'`
                : "GETDATE()";
              const ir2 = await pool.request().query(
                `
                INSERT INTO Audits (UserId,StoreId,Result,Notes,FailedReason,AuditDate,CreatedAt,UpdatedAt)
                VALUES (${r.m.uid},${r.m.sid},N'${(r.Result || "audited").replace(/'/g, "''")}',
                  ${r.Notes ? `N'${r.Notes.replace(/'/g, "''")}'` : "NULL"},
                  ${r.FailedReason ? `N'${r.FailedReason.replace(/'/g, "''")}'` : "NULL"},
                  ${dt},GETDATE(),GETDATE())
              `,
                { timeout: 30000 },
              );
              sub += ir2.rowsAffected[0];
            } catch (_) {}
          }
          totalIns += sub;
        }
      }
    }

    const pct = Math.min(100, Math.round(((offset + limit) / total) * 100));
    if (offset === 0 || offset % (BATCH_SIZE * 5) === 0) {
      console.log(
        `   Batch ${Math.floor(offset / BATCH_SIZE) + 1}: offset=${offset}, inserted=${totalIns} (${pct}%)`,
      );
    }
  }

  console.log(`   ✅ Audits: +${totalIns} in ${Date.now() - t0}ms`);
}

// ──────────────────────────────────────
// STEP 7: Images (chunked)
// ──────────────────────────────────────
async function step7(pool) {
  log(7, "Images...");
  const total = await srcCount(pool, "Images");
  console.log(`   (source: ${total} rows)`);

  const t0 = Date.now();
  let totalIns = 0;

  for (const { offset, limit } of batchChunks(total, BATCH_SIZE)) {
    const srcR = await pool.request().query(
      `
      SELECT img.Id, img.AuditId, img.ImageUrl, img.ReferenceImageUrl,
             img.Latitude, img.Longitude, img.CapturedAt, img.CreatedAt, img.UpdatedAt,
             a.UserId, a.StoreId, a.AuditDate,
             u.Username, s.StoreName
      FROM ${SRC}.dbo.Images img
      INNER JOIN ${SRC}.dbo.Audits a ON img.AuditId = a.Id
      INNER JOIN ${SRC}.dbo.Users u ON a.UserId = u.Id
      INNER JOIN ${SRC}.dbo.Stores s ON a.StoreId = s.Id
      ORDER BY img.Id
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `,
      { timeout: 180000 },
    );
    const srcRows = srcR.recordset;
    if (srcRows.length === 0) break;

    // Lookup NewAuditId
    const uniqUsers = [...new Set(srcRows.map((r) => r.Username))];
    const uniqStores = [...new Set(srcRows.map((r) => r.StoreName))];
    const uIn = uniqUsers.map((u) => `N'${u.replace(/'/g, "''")}'`).join(", ");
    const sIn = uniqStores.map((s) => `N'${s.replace(/'/g, "''")}'`).join(", ");

    const mapR = await pool.request().query(
      `
      SELECT u.Username, s.StoreName, CAST(a.AuditDate AS DATE) AS AuditDate, a.Id AS NewAuditId
      FROM Audits a
      INNER JOIN Users u ON a.UserId = u.Id
      INNER JOIN Stores s ON a.StoreId = s.Id
      WHERE u.Username IN (${uIn}) AND s.StoreName IN (${sIn})
    `,
      { timeout: 120000 },
    );

    const auditKey = {};
    for (const r of mapR.recordset) {
      const k = `${r.Username}|${r.StoreName}|${r.AuditDate ? new Date(r.AuditDate).toISOString().split("T")[0] : ""}`;
      auditKey[k] = r.NewAuditId;
    }

    const valid = srcRows
      .map((r) => {
        const k = `${r.Username}|${r.StoreName}|${r.AuditDate ? new Date(r.AuditDate).toISOString().split("T")[0] : ""}`;
        return { ...r, newAuditId: auditKey[k] };
      })
      .filter((r) => r.newAuditId);

    if (valid.length === 0) continue;

    const SUB = 500;
    for (let i = 0; i < valid.length; i += SUB) {
      const chunk = valid.slice(i, i + SUB);
      const vals = chunk
        .map((r) => {
          const lat = r.Latitude != null ? r.Latitude : "NULL";
          const lng = r.Longitude != null ? r.Longitude : "NULL";
          const captured = r.CapturedAt
            ? `'${new Date(r.CapturedAt).toISOString()}'`
            : "NULL";
          const created = r.CreatedAt
            ? `'${new Date(r.CreatedAt).toISOString()}'`
            : "GETDATE()";
          const updated = r.UpdatedAt
            ? `'${new Date(r.UpdatedAt).toISOString()}'`
            : "GETDATE()";
          const url = r.ImageUrl
            ? `N'${r.ImageUrl.replace(/'/g, "''")}'`
            : "NULL";
          const ref = r.ReferenceImageUrl
            ? `N'${r.ReferenceImageUrl.replace(/'/g, "''")}'`
            : "NULL";
          return `(${r.newAuditId},${url},${ref},${lat},${lng},${captured},${created},${updated})`;
        })
        .join(", ");

      try {
        const ir = await pool.request().query(
          `
          INSERT INTO Images (AuditId,ImageUrl,ReferenceImageUrl,Latitude,Longitude,CapturedAt,CreatedAt,UpdatedAt)
          VALUES ${vals}
        `,
          { timeout: 120000 },
        );
        totalIns += ir.rowsAffected[0];
      } catch (err) {
        if (err.number !== 2627 && err.number !== 2601) {
          let sub = 0;
          for (const r of chunk) {
            try {
              const ir2 = await pool.request().query(
                `
                INSERT INTO Images (AuditId,ImageUrl,ReferenceImageUrl,Latitude,Longitude,CapturedAt,CreatedAt,UpdatedAt)
                VALUES (${r.newAuditId},
                  ${r.ImageUrl ? `N'${r.ImageUrl.replace(/'/g, "''")}'` : "NULL"},
                  ${r.ReferenceImageUrl ? `N'${r.ReferenceImageUrl.replace(/'/g, "''")}'` : "NULL"},
                  ${r.Latitude != null ? r.Latitude : "NULL"},
                  ${r.Longitude != null ? r.Longitude : "NULL"},
                  ${r.CapturedAt ? `'${new Date(r.CapturedAt).toISOString()}'` : "NULL"},
                  GETDATE(),GETDATE())
              `,
                { timeout: 30000 },
              );
              sub += ir2.rowsAffected[0];
            } catch (_) {}
          }
          totalIns += sub;
        }
      }
    }

    if (offset === 0 || offset % (BATCH_SIZE * 5) === 0) {
      console.log(
        `   Batch ${Math.floor(offset / BATCH_SIZE) + 1}: offset=${offset}, inserted=${totalIns}`,
      );
    }
  }

  console.log(`   ✅ Images: +${totalIns} in ${Date.now() - t0}ms`);
}

// ──────────────────────────────────────
// STEP 8: StoreSurveys (chunked)
// ──────────────────────────────────────
async function step8(pool) {
  log(8, "StoreSurveys...");
  const total = await srcCount(pool, "StoreSurveys");
  console.log(`   (source: ${total} rows)`);

  const t0 = Date.now();
  let totalIns = 0;

  for (const { offset, limit } of batchChunks(total, BATCH_SIZE)) {
    const srcR = await pool.request().query(
      `
      SELECT ss.*,
             u.Username, s.StoreName, CAST(a.AuditDate AS DATE) AS AuditDate,
             cp.Code AS CementCode
      FROM ${SRC}.dbo.StoreSurveys ss
      INNER JOIN ${SRC}.dbo.Users u ON ss.UserId = u.Id
      INNER JOIN ${SRC}.dbo.Stores s ON ss.StoreId = s.Id
      INNER JOIN ${SRC}.dbo.Audits a ON ss.AuditId = a.Id
      LEFT JOIN ${SRC}.dbo.CementProducts cp ON ss.CementProductId = cp.Id
      ORDER BY ss.Id
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `,
      { timeout: 180000 },
    );
    const srcRows = srcR.recordset;
    if (srcRows.length === 0) break;

    // Lookup NewAuditId
    const uniqUsers = [...new Set(srcRows.map((r) => r.Username))];
    const uniqStores = [...new Set(srcRows.map((r) => r.StoreName))];
    const uniqDates = [
      ...new Set(
        srcRows.map((r) =>
          r.AuditDate ? new Date(r.AuditDate).toISOString().split("T")[0] : "",
        ),
      ),
    ].filter(Boolean);
    const uIn = uniqUsers.map((u) => `N'${u.replace(/'/g, "''")}'`).join(", ");
    const sIn = uniqStores.map((s) => `N'${s.replace(/'/g, "''")}'`).join(", ");
    const dIn = uniqDates.map((d) => `'${d}'`).join(", ");

    const mapR = await pool.request().query(
      `
      SELECT u.Username, s.StoreName, CAST(a.AuditDate AS DATE) AS AuditDate, a.Id AS NewAuditId
      FROM Audits a
      INNER JOIN Users u ON a.UserId = u.Id
      INNER JOIN Stores s ON a.StoreId = s.Id
      WHERE u.Username IN (${uIn}) AND s.StoreName IN (${sIn})
      ${dIn ? `AND CAST(a.AuditDate AS DATE) IN (${dIn})` : ""}
    `,
      { timeout: 120000 },
    );

    const auditKey = {};
    for (const r of mapR.recordset) {
      const k = `${r.Username}|${r.StoreName}|${r.AuditDate ? new Date(r.AuditDate).toISOString().split("T")[0] : ""}`;
      auditKey[k] = r.NewAuditId;
    }

    // CementProductId map
    const codes = [
      ...new Set(srcRows.filter((r) => r.CementCode).map((r) => r.CementCode)),
    ];
    let cpMap = {};
    if (codes.length > 0) {
      const cpR = await pool
        .request()
        .query(
          `SELECT Code, Id FROM CementProducts WHERE Code IN (${codes.map((c) => `N'${c.replace(/'/g, "''")}'`).join(", ")})`,
          { timeout: 30000 },
        );
      for (const r of cpR.recordset) cpMap[r.Code] = r.Id;
    }

    const valid = srcRows
      .map((r) => {
        const k = `${r.Username}|${r.StoreName}|${r.AuditDate ? new Date(r.AuditDate).toISOString().split("T")[0] : ""}`;
        const newAuditId = auditKey[k];
        const newCpid =
          r.CementCode && cpMap[r.CementCode] ? cpMap[r.CementCode] : null;
        return { ...r, newAuditId, newCpid };
      })
      .filter((r) => r.newAuditId);

    if (valid.length === 0) continue;

    const SUB = 300;
    for (let i = 0; i < valid.length; i += SUB) {
      const chunk = valid.slice(i, i + SUB);
      const vals = chunk
        .map((r) => {
          const created = r.CreatedAt
            ? `'${new Date(r.CreatedAt).toISOString()}'`
            : "GETDATE()";
          const updated = r.UpdatedAt
            ? `'${new Date(r.UpdatedAt).toISOString()}'`
            : "GETDATE()";
          const num = (f) => (r[f] != null ? r[f] : "NULL");
          const txt = (f) =>
            r[f] != null ? `N'${String(r[f]).replace(/'/g, "''")}'` : "NULL";
          const n = (f) => (r[f] != null ? r[f] : "NULL");
          return (
            `(${r.newAuditId},${r.newCpid != null ? r.newCpid : "NULL"},` +
            `${n("PurchasePrice")},${n("SellingPrice")},${n("RoadTransportFee")},${n("WaterTransportFee")},` +
            `${n("ImportExportQuantity")},${n("StockQuantity")},${n("ConsumptionArea")},${n("DebtPeriod")},` +
            `${n("NewProductImportQuantity")},` +
            `${txt("ContactPerson")},${txt("SupplierName")},${txt("WhyNotSellNewProduct")},${txt("TimeToSellNewProduct")},` +
            `${txt("ImportedBySalesperson")},${txt("StoreComment")},${created},${updated})`
          );
        })
        .join(", ");

      try {
        const ir = await pool.request().query(
          `
          INSERT INTO StoreSurveys (
            AuditId,CementProductId,
            PurchasePrice,SellingPrice,RoadTransportFee,WaterTransportFee,
            ImportExportQuantity,StockQuantity,ConsumptionArea,DebtPeriod,NewProductImportQuantity,
            ContactPerson,SupplierName,WhyNotSellNewProduct,TimeToSellNewProduct,
            ImportedBySalesperson,StoreComment,CreatedAt,UpdatedAt
          ) VALUES ${vals}
        `,
          { timeout: 120000 },
        );
        totalIns += ir.rowsAffected[0];
      } catch (err) {
        console.log(`   ⚠️  Sub-batch error: ${err.message.split("\n")[0]}`);
      }
    }

    if (offset === 0 || offset % (BATCH_SIZE * 5) === 0) {
      console.log(
        `   Batch ${Math.floor(offset / BATCH_SIZE) + 1}: offset=${offset}, inserted=${totalIns}`,
      );
    }
  }

  console.log(`   ✅ StoreSurveys: +${totalIns} in ${Date.now() - t0}ms`);
}

// ──────────────────────────────────────
// STEP 9: StoreSurveyProducts
// ──────────────────────────────────────
async function step9(pool) {
  log(9, "StoreSurveyProducts...");
  const c = await srcCount(pool, "StoreSurveyProducts");
  console.log(`   (source: ${c} rows)`);
  await safeInsert(
    pool,
    "StoreSurveyProducts",
    `
    INSERT INTO StoreSurveyProducts (
      StoreSurveyId,ProductType,CementProductId,SellingPrice,
      ContactPersonPhone,PurchasePrice,RoadTransportFee,WaterTransportFee,
      ImportedFromNPP,DiscountPromotion,AverageStockQuantity,CreatedAt
    )
    SELECT dst_ss.Id, src.ProductType, cp.Id, src.SellingPrice,
           src.ContactPersonPhone, src.PurchasePrice, src.RoadTransportFee, src.WaterTransportFee,
           src.ImportedFromNPP, src.DiscountPromotion, src.AverageStockQuantity,
           ISNULL(src.CreatedAt, GETDATE())
    FROM ${SRC}.dbo.StoreSurveyProducts src
    INNER JOIN ${SRC}.dbo.StoreSurveys src_ss ON src.StoreSurveyId = src_ss.Id
    INNER JOIN ${SRC}.dbo.Users src_u ON src_ss.UserId = src_u.Id
    INNER JOIN ${SRC}.dbo.Stores src_s ON src_ss.StoreId = src_s.Id
    INNER JOIN ${SRC}.dbo.Audits src_aud ON src_ss.AuditId = src_aud.Id
    INNER JOIN (
      SELECT ss.Id, u.Username, s.StoreName, CAST(a.AuditDate AS DATE) AS AuditDate
      FROM StoreSurveys ss
      INNER JOIN Audits a ON ss.AuditId = a.Id
      INNER JOIN Users u ON a.UserId = u.Id
      INNER JOIN Stores s ON a.StoreId = s.Id
    ) dst_ss
      ON dst_ss.Username = src_u.Username
         AND dst_ss.StoreName = src_s.StoreName
         AND dst_ss.AuditDate = CAST(src_aud.AuditDate AS DATE)
    LEFT JOIN ${SRC}.dbo.CementProducts src_cp ON src.CementProductId = src_cp.Id
    LEFT JOIN CementProducts cp ON cp.Code = src_cp.Code
  `,
    600000,
  );
}

// ──────────────────────────────────────
// STEP 10: Refresh statuses
// ──────────────────────────────────────
async function step10(pool) {
  log(10, "Refreshing store statuses...");
  const t0 = Date.now();
  const r = await pool.request().query(`
    UPDATE s SET s.Status = CASE WHEN latest.Result='fail' THEN 'failed' WHEN latest.Result='pass' THEN 'passed' ELSE 'audited' END,
                  s.UpdatedAt = GETDATE()
    FROM Stores s
    INNER JOIN (
      SELECT a.StoreId, a.Result,
             ROW_NUMBER() OVER (PARTITION BY a.StoreId ORDER BY a.AuditDate DESC, a.Id DESC) AS rn
      FROM Audits a
    ) latest ON latest.StoreId = s.Id AND latest.rn = 1
  `);
  console.log(
    `   ✅ ${r.rowsAffected[0]} stores updated in ${Date.now() - t0}ms`,
  );
}

// ──────────────────────────────────────
// STEP 11: Fix TerritoryId
// ──────────────────────────────────────
async function step11(pool) {
  log(11, "Fixing TerritoryId...");
  const t0 = Date.now();
  const r = await pool.request().query(`
    UPDATE s SET s.TerritoryId = t.Id, s.UpdatedAt = GETDATE()
    FROM Stores s
    INNER JOIN ${SRC}.dbo.Stores src_s ON src_s.StoreName = s.StoreName
    INNER JOIN ${SRC}.dbo.Territories src_t ON src_t.Id = src_s.TerritoryId
    INNER JOIN Territories t ON t.TerritoryName = src_t.TerritoryName
    WHERE s.TerritoryId IS NULL
  `);
  console.log(
    `   ✅ ${r.rowsAffected[0]} stores fixed in ${Date.now() - t0}ms`,
  );
}

// ──────────────────────────────────────
// MAIN
// ──────────────────────────────────────
async function main() {
  console.log("");
  console.log("============================================================");
  console.log("  MERGE: " + SOURCE_DB + " -> " + process.env.DB_NAME);
  console.log("  Batch: " + BATCH_SIZE);
  console.log("============================================================");

  const start = Date.now();
  let srcPool, tgtPool;

  try {
    srcPool = await connect(SOURCE_CONFIG, "SOURCE");
    tgtPool = await connect(TARGET_CONFIG, "TARGET");

    console.log("\nRunning merge steps...\n");

    await step1(tgtPool);
    await step2(tgtPool);
    await step3(tgtPool);
    await step4(tgtPool);
    await step5(tgtPool);
    await step6(tgtPool);
    await step7(tgtPool);
    await step8(tgtPool);
    await step9(tgtPool);
    await step11(tgtPool);
    await step10(tgtPool);

    const dur = Date.now() - start;
    console.log(
      "\n============================================================",
    );
    console.log("  MERGE COMPLETED!");
    console.log(
      `  Time: ${Math.round(dur / 1000)}s (${Math.round(dur / 60000)} min)`,
    );
    console.log("============================================================");
    console.log("NOTE: Users with HASH_PLACEHOLDER_* password need reset.");
  } catch (err) {
    console.error(
      "\n============================================================",
    );
    console.error("  MERGE FAILED!");
    console.error("  " + err.message);
    console.error(
      "============================================================",
    );
    process.exit(1);
  } finally {
    if (srcPool) await srcPool.close();
    if (tgtPool) await tgtPool.close();
    process.exit(0);
  }
}

main();
