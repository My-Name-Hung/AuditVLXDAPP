/**
 * Script merge data từ RE_SALE_20260410 (backup) vào DBXMTD (hiện tại)
 * Chỉ merge Audits có AuditDate < '2026-04-11' và Images liên quan
 * KHÔNG ghi đè data hiện có trong DBXMTD
 *
 * Chạy: node scripts/mergeBackupData.js
 */

const sql = require("mssql");

// ─── Cấu hình 2 database ───
const DBXMTD_CONFIG = {
  server: process.env.DB_SERVER || "113.161.208.240",
  port: parseInt(process.env.DB_PORT || "3433"),
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "XMTD@@@2025",
  database: "DBXMTD",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};

const BACKUP_CONFIG = {
  server: process.env.DB_SERVER || "113.161.208.240",
  port: parseInt(process.env.DB_PORT || "3433"),
  user: process.env.DB_USER || "sa",
  password: process.env.DB_PASSWORD || "XMTD@@@2025",
  database: "RE_SALE_20260410",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};

const CUTOFF_DATE = "2026-04-11"; // Chỉ merge data trước ngày này

async function connectDB(config, name) {
  try {
    const pool = await sql.connect(config);
    console.log(`✅ Kết nối thành công: ${name}`);
    return pool;
  } catch (err) {
    console.error(`❌ Kết nối thất bại: ${name}`, err.message);
    throw err;
  }
}

async function mergeAudits(backupPool, dbxmtdPool) {
  console.log("\n📋 Bước 1: Merge bảng Audits...");

  // Lấy Audits từ backup có AuditDate < cutoff
  const backupAudits = await backupPool.request().query(`
    SELECT Id, UserId, StoreId, Result, Notes, AuditDate, CreatedAt, UpdatedAt
    FROM Audits
    WHERE CAST(AuditDate AS DATE) < '${CUTOFF_DATE}'
  `);

  console.log(`   Tìm thấy ${backupAudits.recordset.length} Audits trong backup`);

  if (backupAudits.recordset.length === 0) {
    console.log("   ⏭️  Bỏ qua - không có Audits cần merge");
    return [];
  }

  // Lấy danh sách AuditId đã có trong DBXMTD
  const existingAudits = await dbxmtdPool.request().query("SELECT Id FROM Audits");
  const existingIds = new Set(existingAudits.recordset.map((r) => r.Id));

  // Lọc Audits chưa có trong DBXMTD
  const newAudits = backupAudits.recordset.filter((a) => !existingIds.has(a.Id));
  console.log(`   ${newAudits.length} Audits mới cần insert (đã loại ${backupAudits.recordset.length - newAudits.length} trùng lặp)`);

  if (newAudits.length === 0) {
    console.log("   ⏭️  Bỏ qua - tất cả đã tồn tại");
    return [];
  }

  // Insert từng Audit
  let insertedCount = 0;
  let errorCount = 0;

  for (const audit of newAudits) {
    try {
      await dbxmtdPool.request().query(`
        SET IDENTITY_INSERT Audits ON;
        INSERT INTO Audits (Id, UserId, StoreId, Result, Notes, AuditDate, CreatedAt, UpdatedAt)
        VALUES (
          ${audit.Id},
          ${audit.UserId},
          ${audit.StoreId},
          '${escapeString(audit.Result)}',
          ${audit.Notes ? `'${escapeString(audit.Notes)}'` : "NULL"},
          '${formatDate(audit.AuditDate)}',
          '${formatDate(audit.CreatedAt)}',
          '${formatDate(audit.UpdatedAt)}'
        );
        SET IDENTITY_INSERT Audits OFF;
      `);
      insertedCount++;
    } catch (err) {
      errorCount++;
      if (errorCount <= 5) {
        console.error(`   ⚠️  Lỗi insert Audit Id=${audit.Id}: ${err.message}`);
      }
    }
  }

  console.log(`   ✅ Đã insert ${insertedCount} Audits, ${errorCount} lỗi`);
  return newAudits;
}

async function mergeImages(backupPool, dbxmtdPool) {
  console.log("\n📋 Bước 2: Merge bảng Images...");

  // Lấy Images từ backup
  const backupImages = await backupPool.request().query(`
    SELECT Id, AuditId, ImageUrl, ReferenceImageUrl, Latitude, Longitude, CapturedAt, CreatedAt, UpdatedAt
    FROM Images
    WHERE AuditId IN (
      SELECT Id FROM Audits WHERE CAST(AuditDate AS DATE) < '${CUTOFF_DATE}'
    )
  `);

  console.log(`   Tìm thấy ${backupImages.recordset.length} Images trong backup`);

  if (backupImages.recordset.length === 0) {
    console.log("   ⏭️  Bỏ qua - không có Images cần merge");
    return;
  }

  // Lấy danh sách ImageId đã có trong DBXMTD
  const existingImages = await dbxmtdPool.request().query("SELECT Id FROM Images");
  const existingIds = new Set(existingImages.recordset.map((r) => r.Id));

  // Lọc Images chưa có trong DBXMTD
  const newImages = backupImages.recordset.filter((img) => !existingIds.has(img.Id));
  console.log(`   ${newImages.length} Images mới cần insert (đã loại ${backupImages.recordset.length - newImages.length} trùng lặp)`);

  if (newImages.length === 0) {
    console.log("   ⏭️  Bỏ qua - tất cả đã tồn tại");
    return;
  }

  let insertedCount = 0;
  let errorCount = 0;

  for (const img of newImages) {
    try {
      await dbxmtdPool.request().query(`
        SET IDENTITY_INSERT Images ON;
        INSERT INTO Images (Id, AuditId, ImageUrl, ReferenceImageUrl, Latitude, Longitude, CapturedAt, CreatedAt, UpdatedAt)
        VALUES (
          ${img.Id},
          ${img.AuditId},
          '${escapeString(img.ImageUrl)}',
          ${img.ReferenceImageUrl ? `'${escapeString(img.ReferenceImageUrl)}'` : "NULL"},
          ${img.Latitude !== null ? img.Latitude : "NULL"},
          ${img.Longitude !== null ? img.Longitude : "NULL"},
          '${formatDate(img.CapturedAt)}',
          '${formatDate(img.CreatedAt)}',
          '${formatDate(img.UpdatedAt)}'
        );
        SET IDENTITY_INSERT Images OFF;
      `);
      insertedCount++;
    } catch (err) {
      errorCount++;
      if (errorCount <= 5) {
        console.error(`   ⚠️  Lỗi insert Image Id=${img.Id}: ${err.message}`);
      }
    }
  }

  console.log(`   ✅ Đã insert ${insertedCount} Images, ${errorCount} lỗi`);
}

async function mergeStoreSurveys(backupPool, dbxmtdPool) {
  console.log("\n📋 Bước 3: Merge bảng StoreSurveys...");

  const backupSurveys = await backupPool.request().query(`
    SELECT * FROM StoreSurveys
    WHERE AuditId IN (
      SELECT Id FROM Audits WHERE CAST(AuditDate AS DATE) < '${CUTOFF_DATE}'
    )
  `);

  console.log(`   Tìm thấy ${backupSurveys.recordset.length} StoreSurveys trong backup`);

  if (backupSurveys.recordset.length === 0) {
    console.log("   ⏭️  Bỏ qua - không có StoreSurveys cần merge");
    return;
  }

  const existingSurveys = await dbxmtdPool.request().query("SELECT Id FROM StoreSurveys");
  const existingIds = new Set(existingSurveys.recordset.map((r) => r.Id));

  const newSurveys = backupSurveys.recordset.filter((s) => !existingIds.has(s.Id));
  console.log(`   ${newSurveys.length} StoreSurveys mới cần insert`);

  if (newSurveys.length === 0) {
    console.log("   ⏭️  Bỏ qua - tất cả đã tồn tại");
    return;
  }

  let insertedCount = 0;
  let errorCount = 0;

  for (const survey of newSurveys) {
    try {
      // Xây dựng INSERT statement động
      const cols = [];
      const vals = [];

      for (const [key, value] of Object.entries(survey)) {
        if (key === "Id") {
          cols.push("Id");
          vals.push(value);
        } else if (value !== null && value !== undefined) {
          cols.push(key);
          if (typeof value === "string") {
            vals.push(`'${escapeString(value)}'`);
          } else if (value instanceof Date) {
            vals.push(`'${formatDate(value)}'`);
          } else {
            vals.push(value);
          }
        }
      }

      await dbxmtdPool.request().query(`
        SET IDENTITY_INSERT StoreSurveys ON;
        INSERT INTO StoreSurveys (${cols.join(", ")}) VALUES (${vals.join(", ")});
        SET IDENTITY_INSERT StoreSurveys OFF;
      `);
      insertedCount++;
    } catch (err) {
      errorCount++;
      if (errorCount <= 5) {
        console.error(`   ⚠️  Lỗi insert StoreSurvey Id=${survey.Id}: ${err.message}`);
      }
    }
  }

  console.log(`   ✅ Đã insert ${insertedCount} StoreSurveys, ${errorCount} lỗi`);
}

async function mergeStoreSurveyProducts(backupPool, dbxmtdPool) {
  console.log("\n📋 Bước 4: Merge bảng StoreSurveyProducts...");

  const backupProducts = await backupPool.request().query(`
    SELECT * FROM StoreSurveyProducts
    WHERE StoreSurveyId IN (
      SELECT Id FROM StoreSurveys WHERE AuditId IN (
        SELECT Id FROM Audits WHERE CAST(AuditDate AS DATE) < '${CUTOFF_DATE}'
      )
    )
  `);

  console.log(`   Tìm thấy ${backupProducts.recordset.length} StoreSurveyProducts trong backup`);

  if (backupProducts.recordset.length === 0) {
    console.log("   ⏭️  Bỏ qua - không có StoreSurveyProducts cần merge");
    return;
  }

  const existingProducts = await dbxmtdPool.request().query("SELECT Id FROM StoreSurveyProducts");
  const existingIds = new Set(existingProducts.recordset.map((r) => r.Id));

  const newProducts = backupProducts.recordset.filter((p) => !existingIds.has(p.Id));
  console.log(`   ${newProducts.length} StoreSurveyProducts mới cần insert`);

  if (newProducts.length === 0) {
    console.log("   ⏭️  Bỏ qua - tất cả đã tồn tại");
    return;
  }

  let insertedCount = 0;
  let errorCount = 0;

  for (const product of newProducts) {
    try {
      const cols = [];
      const vals = [];

      for (const [key, value] of Object.entries(product)) {
        if (key === "Id") {
          cols.push("Id");
          vals.push(value);
        } else if (value !== null && value !== undefined) {
          cols.push(key);
          if (typeof value === "string") {
            vals.push(`'${escapeString(value)}'`);
          } else if (value instanceof Date) {
            vals.push(`'${formatDate(value)}'`);
          } else {
            vals.push(value);
          }
        }
      }

      await dbxmtdPool.request().query(`
        SET IDENTITY_INSERT StoreSurveyProducts ON;
        INSERT INTO StoreSurveyProducts (${cols.join(", ")}) VALUES (${vals.join(", ")});
        SET IDENTITY_INSERT StoreSurveyProducts OFF;
      `);
      insertedCount++;
    } catch (err) {
      errorCount++;
      if (errorCount <= 5) {
        console.error(`   ⚠️  Lỗi insert StoreSurveyProduct Id=${product.Id}: ${err.message}`);
      }
    }
  }

  console.log(`   ✅ Đã insert ${insertedCount} StoreSurveyProducts, ${errorCount} lỗi`);
}

async function showSummary(backupPool, dbxmtdPool) {
  console.log("\n📊 Tổng kết data sau khi merge:");

  const tables = ["Audits", "Images", "StoreSurveys", "StoreSurveyProducts"];
  for (const table of tables) {
    try {
      const backupCount = await backupPool.request().query(`SELECT COUNT(*) as cnt FROM ${table}`);
      const dbxmtdCount = await dbxmtdPool.request().query(`SELECT COUNT(*) as cnt FROM ${table}`);
      console.log(`   ${table}: DBXMTD=${dbxmtdCount.recordset[0].cnt}, Backup=${backupCount.recordset[0].cnt}`);
    } catch (err) {
      console.log(`   ${table}: Không thể đếm (${err.message})`);
    }
  }
}

// ─── Utility functions ───
function escapeString(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/'/g, "''").replace(/\\/g, "\\\\");
}

function formatDate(dateValue) {
  if (!dateValue) return "GETDATE()";
  const d = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(d.getTime())) return "GETDATE()";
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${mo}-${day} ${h}:${mi}:${s}`;
}

// ─── Main ───
async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("   MERGE DATA: RE_SALE_20260410 → DBXMTD");
  console.log(`   Cutoff date: ${CUTOFF_DATE} (AuditDate < ngày này)`);
  console.log("═══════════════════════════════════════════");

  let backupPool = null;
  let dbxmtdPool = null;

  try {
    // Kết nối cả 2 database
    backupPool = await connectDB(BACKUP_CONFIG, "RE_SALE_20260410 (Backup)");
    dbxmtdPool = await connectDB(DBXMTD_CONFIG, "DBXMTD (Hiện tại)");

    // Merge theo thứ tự: Audits → Images → StoreSurveys → StoreSurveyProducts
    await mergeAudits(backupPool, dbxmtdPool);
    await mergeImages(backupPool, dbxmtdPool);

    // Kiểm tra xem bảng StoreSurveys có tồn tại không
    try {
      await backupPool.request().query("SELECT 1 FROM StoreSurveys WHERE 1=0");
      await mergeStoreSurveys(backupPool, dbxmtdPool);
      await mergeStoreSurveyProducts(backupPool, dbxmtdPool);
    } catch (e) {
      if (e.message.includes("Invalid object name")) {
        console.log("\n📋 Bước 3+4: Bảng StoreSurveys/StoreSurveyProducts không tồn tại trong backup — bỏ qua");
      } else {
        throw e;
      }
    }

    await showSummary(backupPool, dbxmtdPool);

    console.log("\n═══════════════════════════════════════════");
    console.log("   ✅ MERGE HOÀN TẤT!");
    console.log("═══════════════════════════════════════════");
  } catch (err) {
    console.error("\n❌ Lỗi nghiêm trọng:", err.message);
    process.exit(1);
  } finally {
    if (backupPool) await backupPool.close();
    if (dbxmtdPool) await dbxmtdPool.close();
    console.log("🔌 Đã đóng kết nối database");
  }
}

main();
