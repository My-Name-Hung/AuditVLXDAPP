/**
 * Script merge an toàn: RE_SALE_20260410 (Backup) → DBXMTD
 *
 * Nguyên tắc: CHỈ INSERT - KHÔNG UPDATE - KHÔNG XÓA
 * Giữ nguyên mọi data hiện tại trong DBXMTD
 * Chỉ thêm records hoàn toàn mới (Id chưa tồn tại)
 *
 * Chạy: node scripts/mergeBackupData.js
 */

const sql = require("mssql");

const DBXMTD_CONFIG = {
  server: "113.161.208.240",
  port: 3433,
  user: "sa",
  password: "XMTD@@@2025",
  database: "DBXMTD",
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, requestTimeout: 300000 },
};

const BACKUP_CONFIG = {
  server: "113.161.208.240",
  port: 3433,
  user: "sa",
  password: "XMTD@@@2025",
  database: "RE_SALE_20260410",
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true, requestTimeout: 300000 },
};

async function connectDB(config, name) {
  const pool = await sql.connect(config);
  console.log(`✅ Kết nối: ${name}`);
  return pool;
}

// ─── Lấy column list từ bảng thực tế ───
async function getColumns(pool, db, table) {
  const result = await pool.request().query(
    `SELECT COLUMN_NAME FROM ${db}.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}' ORDER BY ORDINAL_POSITION`
  );
  return result.recordset.map(r => r.COLUMN_NAME);
}

// ─── Chẩn đoán ───
async function diagnose(backupPool, dbxmtdPool) {
  console.log("\n🔍 Chẩn đoán trước merge...");

  for (const t of ["Stores", "Users", "Audits", "Images", "StoreSurveys", "StoreSurveyProducts"]) {
    try {
      const bc = await backupPool.request().query(`SELECT COUNT(*) as c FROM RE_SALE_20260410.dbo.${t}`);
      const dc = await dbxmtdPool.request().query(`SELECT COUNT(*) as c FROM DBXMTD.dbo.${t}`);
      const diff = bc.recordset[0].c - dc.recordset[0].c;
      const mark = diff === 0 ? "✅" : diff > 0 ? "📥" : "📤";
      console.log(`   ${mark} ${t}: DBXMTD=${dc.recordset[0].c}, Backup=${bc.recordset[0].c}, Chênh=${diff >= 0 ? "+" : ""}${diff}`);
    } catch (e) {
      console.log(`   ❌ ${t}: ${e.message}`);
    }
  }

  const dDist = await dbxmtdPool.request().query(`
    SELECT CAST(AuditDate AS DATE) as d, COUNT(*) as c
    FROM DBXMTD.dbo.Audits GROUP BY CAST(AuditDate AS DATE) ORDER BY d DESC
  `);
  const total = dDist.recordset.reduce((s, x) => s + x.c, 0);
  console.log(`\n   📅 DBXMTD - ${total} records across ${dDist.recordset.length} ngày:`);
  for (const r of dDist.recordset.slice(0, 10)) {
    console.log(`      ${r.d}: ${r.c}`);
  }
  if (dDist.recordset.length > 10) {
    const hidden = total - dDist.recordset.slice(0, 10).reduce((s, x) => s + x.c, 0);
    console.log(`      ... và ${dDist.recordset.length - 10} ngày khác (${hidden} records)`);
  }

  const needAudit = await backupPool.request().query(`
    SELECT COUNT(*) as c FROM RE_SALE_20260410.dbo.Audits b
    WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Audits d WHERE d.Id = b.Id)
  `);
  const needImg = await backupPool.request().query(`
    SELECT COUNT(*) as c FROM RE_SALE_20260410.dbo.Images b
    WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Images d WHERE d.Id = b.Id)
  `);
  console.log(`\n   ⚠️  Cần INSERT: ${needAudit.recordset[0].c} Audits, ${needImg.recordset[0].c} Images`);
}

// ─── INSERT Stores (schema động) ───
async function insertStores(backupPool, dbxmtdPool) {
  console.log("\n📋 Bước 1: INSERT Stores...");

  const needed = await backupPool.request().query(`
    SELECT COUNT(*) as c FROM RE_SALE_20260410.dbo.Stores b
    WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Stores d WHERE d.Id = b.Id)
  `);
  console.log(`   Cần INSERT ${needed.recordset[0].c} Stores...`);

  if (needed.recordset[0].c === 0) {
    console.log("   ⏭️  Đã đủ Stores");
    return;
  }

  const cols = await getColumns(dbxmtdPool, "DBXMTD", "Stores");
  console.log(`   Schema: ${cols.join(", ")}`);

  try {
    await dbxmtdPool.request().query(`
      SET IDENTITY_INSERT DBXMTD.dbo.Stores ON;
      INSERT INTO DBXMTD.dbo.Stores (${cols.join(", ")})
      SELECT ${cols.join(", ")}
      FROM RE_SALE_20260410.dbo.Stores b
      WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Stores d WHERE d.Id = b.Id);
      SET IDENTITY_INSERT DBXMTD.dbo.Stores OFF;
    `);
    console.log("   ✅ Inserted Stores");
  } catch (e) {
    console.log(`   ❌ Lỗi: ${e.message}`);
  }
}

// ─── INSERT Users (schema động) ───
async function insertUsers(backupPool, dbxmtdPool) {
  console.log("\n📋 Bước 2: INSERT Users...");

  const needed = await backupPool.request().query(`
    SELECT COUNT(*) as c FROM RE_SALE_20260410.dbo.Users b
    WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Users d WHERE d.Id = b.Id)
  `);
  console.log(`   Cần INSERT ${needed.recordset[0].c} Users...`);

  if (needed.recordset[0].c === 0) {
    console.log("   ⏭️  Đã đủ Users");
    return;
  }

  const cols = await getColumns(dbxmtdPool, "DBXMTD", "Users");
  console.log(`   Schema: ${cols.join(", ")}`);

  try {
    await dbxmtdPool.request().query(`
      SET IDENTITY_INSERT DBXMTD.dbo.Users ON;
      INSERT INTO DBXMTD.dbo.Users (${cols.join(", ")})
      SELECT ${cols.join(", ")}
      FROM RE_SALE_20260410.dbo.Users b
      WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Users d WHERE d.Id = b.Id);
      SET IDENTITY_INSERT DBXMTD.dbo.Users OFF;
    `);
    console.log("   ✅ Inserted Users");
  } catch (e) {
    console.log(`   ❌ Lỗi: ${e.message}`);
  }
}

// ─── INSERT Audits ───
async function insertAudits(backupPool, dbxmtdPool) {
  console.log("\n📋 Bước 3: INSERT Audits...");

  const countResult = await backupPool.request().query(`
    SELECT COUNT(*) as c FROM RE_SALE_20260410.dbo.Audits b
    WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Audits d WHERE d.Id = b.Id)
  `);
  const count = countResult.recordset[0].c;
  console.log(`   Cần INSERT ${count} Audits...`);

  if (count === 0) {
    console.log("   ⏭️  Không có Audits mới");
    return 0;
  }

  const cols = await getColumns(dbxmtdPool, "DBXMTD", "Audits");
  console.log(`   Schema: ${cols.join(", ")}`);

  const start = Date.now();
  try {
    await dbxmtdPool.request().query(`
      SET IDENTITY_INSERT DBXMTD.dbo.Audits ON;
      INSERT INTO DBXMTD.dbo.Audits (${cols.join(", ")})
      SELECT ${cols.join(", ")}
      FROM RE_SALE_20260410.dbo.Audits b
      WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Audits d WHERE d.Id = b.Id);
      SET IDENTITY_INSERT DBXMTD.dbo.Audits OFF;
    `);
    console.log(`   ✅ Inserted ${count} Audits trong ${((Date.now() - start) / 1000).toFixed(1)}s`);
    return count;
  } catch (e) {
    console.log(`   ❌ Lỗi: ${e.message}`);
    return 0;
  }
}

// ─── INSERT Images ───
async function insertImages(backupPool, dbxmtdPool) {
  console.log("\n📋 Bước 4: INSERT Images...");

  const countResult = await backupPool.request().query(`
    SELECT COUNT(*) as c FROM RE_SALE_20260410.dbo.Images b
    WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Images d WHERE d.Id = b.Id)
  `);
  const count = countResult.recordset[0].c;
  console.log(`   Cần INSERT ${count} Images...`);

  if (count === 0) {
    console.log("   ⏭️  Không có Images mới");
    return 0;
  }

  const cols = await getColumns(dbxmtdPool, "DBXMTD", "Images");
  const start = Date.now();
  try {
    await dbxmtdPool.request().query(`
      SET IDENTITY_INSERT DBXMTD.dbo.Images ON;
      INSERT INTO DBXMTD.dbo.Images (${cols.join(", ")})
      SELECT ${cols.join(", ")}
      FROM RE_SALE_20260410.dbo.Images b
      WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Images d WHERE d.Id = b.Id);
      SET IDENTITY_INSERT DBXMTD.dbo.Images OFF;
    `);
    console.log(`   ✅ Inserted ${count} Images trong ${((Date.now() - start) / 1000).toFixed(1)}s`);
    return count;
  } catch (e) {
    console.log(`   ❌ Lỗi: ${e.message}`);
    return 0;
  }
}

// ─── StoreSurveys & StoreSurveyProducts ───
async function syncStoreSurveys(backupPool, dbxmtdPool) {
  for (const [t, name] of [["StoreSurveys", "StoreSurveys"], ["StoreSurveyProducts", "StoreSurveyProducts"]]) {
    try {
      await backupPool.request().query(`SELECT TOP 1 Id FROM RE_SALE_20260410.dbo.${t}`);
    } catch {
      console.log(`   ⏭️  Bảng ${t} không tồn tại trong backup`);
      continue;
    }

    const countS = await backupPool.request().query(`
      SELECT COUNT(*) as c FROM RE_SALE_20260410.dbo.${t} b
      WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.${t} d WHERE d.Id = b.Id)
    `);
    console.log(`\n   Cần INSERT ${countS.recordset[0].c} ${t}...`);

    if (countS.recordset[0].c === 0) {
      console.log(`   ⏭️  Không có ${t} mới`);
      continue;
    }

    const cols = await getColumns(dbxmtdPool, "DBXMTD", t);
    const start = Date.now();
    try {
      await dbxmtdPool.request().query(`
        SET IDENTITY_INSERT DBXMTD.dbo.${t} ON;
        INSERT INTO DBXMTD.dbo.${t} (${cols.join(", ")})
        SELECT ${cols.join(", ")}
        FROM RE_SALE_20260410.dbo.${t} b
        WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.${t} d WHERE d.Id = b.Id);
        SET IDENTITY_INSERT DBXMTD.dbo.${t} OFF;
      `);
      console.log(`   ✅ Inserted ${countS.recordset[0].c} ${t} trong ${((Date.now() - start) / 1000).toFixed(1)}s`);
    } catch (e) {
      console.log(`   ❌ Lỗi: ${e.message}`);
    }
  }
}

// ─── Tổng kết ───
async function showSummary(backupPool, dbxmtdPool) {
  console.log("\n📊 Tổng kết sau merge:");

  for (const t of ["Stores", "Users", "Audits", "Images", "StoreSurveys", "StoreSurveyProducts"]) {
    try {
      const bc = await backupPool.request().query(`SELECT COUNT(*) as c FROM RE_SALE_20260410.dbo.${t}`);
      const dc = await dbxmtdPool.request().query(`SELECT COUNT(*) as c FROM DBXMTD.dbo.${t}`);
      const diff = dc.recordset[0].c - bc.recordset[0].c;
      const mark = diff === 0 ? "✅" : "⚠️";
      console.log(`   ${mark} ${t}: DBXMTD=${dc.recordset[0].c}, Backup=${bc.recordset[0].c}`);
    } catch {}
  }

  const dist = await dbxmtdPool.request().query(`
    SELECT CAST(AuditDate AS DATE) as d, COUNT(*) as c
    FROM DBXMTD.dbo.Audits GROUP BY CAST(AuditDate AS DATE) ORDER BY d DESC
  `);
  const total = dist.recordset.reduce((s, x) => s + x.c, 0);
  console.log(`\n📅 Phân bổ ngày (sau merge): Tổng=${total} records across ${dist.recordset.length} ngày`);
  for (const r of dist.recordset.slice(0, 15)) {
    console.log(`   ${r.d}: ${r.c}`);
  }
  if (dist.recordset.length > 15) {
    const hidden = total - dist.recordset.slice(0, 15).reduce((s, x) => s + x.c, 0);
    console.log(`   ... và ${dist.recordset.length - 15} ngày khác (${hidden} records)`);
  }
}

// ─── MAIN ───
async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("   MERGE AN TOÀN: RE_SALE_20260410 → DBXMTD");
  console.log("   Chỉ INSERT bản ghi mới - KHÔNG UPDATE - KHÔNG XÓA");
  console.log("═══════════════════════════════════════════════════════");

  let backupPool = null;
  let dbxmtdPool = null;

  try {
    backupPool = await connectDB(BACKUP_CONFIG, "RE_SALE_20260410 (Backup)");
    dbxmtdPool = await connectDB(DBXMTD_CONFIG, "DBXMTD (Hiện tại)");

    await diagnose(backupPool, dbxmtdPool);

    await insertStores(backupPool, dbxmtdPool);
    await insertUsers(backupPool, dbxmtdPool);
    const insertedAudits = await insertAudits(backupPool, dbxmtdPool);
    const insertedImages = await insertImages(backupPool, dbxmtdPool);
    await syncStoreSurveys(backupPool, dbxmtdPool);

    await showSummary(backupPool, dbxmtdPool);

    console.log("\n═══════════════════════════════════════════════════════");
    console.log(`   ✅ HOÀN TẤT!`);
    console.log(`   Audits: +${insertedAudits} (data cũ KHÔNG bị ảnh hưởng)`);
    console.log(`   Images: +${insertedImages}`);
    console.log("═══════════════════════════════════════════════════════");
  } catch (err) {
    console.error("\n❌ Lỗi:", err.message);
    process.exit(1);
  } finally {
    if (backupPool) await backupPool.close();
    if (dbxmtdPool) await dbxmtdPool.close();
    console.log("🔌 Đã đóng kết nối");
  }
}

main();
