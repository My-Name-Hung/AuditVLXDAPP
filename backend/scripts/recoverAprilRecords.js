/**
 * Script KHÔI PHỤC: Lấy lại records ngày 11/04 và 13/04 từ RE_SALE_20260410
 *
 * Vấn đề: Script merge trước đó dùng NOT EXISTS nên bỏ qua 85 records ngày 11&13/04
 * Giải pháp: INSERT ngược 85 records đó từ backup vào DBXMTD
 *
 * Chạy: node scripts/recoverAprilRecords.js
 */

const sql = require("mssql");

const DBXMTD_CONFIG = {
  server: "113.161.208.240",
  port: 3433,
  user: "sa",
  password: "XMTD@@@2025",
  database: "DBXMTD",
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

const BACKUP_CONFIG = {
  server: "113.161.208.240",
  port: 3433,
  user: "sa",
  password: "XMTD@@@2025",
  database: "RE_SALE_20260410",
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
};

async function connectDB(config, name) {
  const pool = await sql.connect(config);
  console.log(`✅ Kết nối: ${name}`);
  return pool;
}

async function main() {
  let backupPool = null;
  let dbxmtdPool = null;

  try {
    backupPool = await connectDB(BACKUP_CONFIG, "RE_SALE_20260410 (Backup)");
    dbxmtdPool = await connectDB(DBXMTD_CONFIG, "DBXMTD (Hiện tại)");

    // ─── Kiểm tra hiện tại ───
    console.log("\n🔍 Kiểm tra tình trạng...");

    const nowApril11 = await dbxmtdPool.request().query(`
      SELECT COUNT(*) as c FROM DBXMTD.dbo.Audits
      WHERE CAST(AuditDate AS DATE) = '2026-04-11'
    `);
    const nowApril13 = await dbxmtdPool.request().query(`
      SELECT COUNT(*) as c FROM DBXMTD.dbo.Audits
      WHERE CAST(AuditDate AS DATE) = '2026-04-13'
    `);
    console.log(`   DBXMTD hiện tại: April 11 = ${nowApril11.recordset[0].c}, April 13 = ${nowApril13.recordset[0].c}`);

    const bkApril11 = await backupPool.request().query(`
      SELECT COUNT(*) as c FROM RE_SALE_20260410.dbo.Audits
      WHERE CAST(AuditDate AS DATE) = '2026-04-11'
    `);
    const bkApril13 = await backupPool.request().query(`
      SELECT COUNT(*) as c FROM RE_SALE_20260410.dbo.Audits
      WHERE CAST(AuditDate AS DATE) = '2026-04-13'
    `);
    console.log(`   Backup có:       April 11 = ${bkApril11.recordset[0].c}, April 13 = ${bkApril13.recordset[0].c}`);

    // ─── 1. Khôi phục Audits April 11 ───
    console.log("\n📋 Khôi phục Audits ngày 11/04...");

    // INSERT April 11 từ backup
    const count11 = await backupPool.request().query(`
      SELECT COUNT(*) as c FROM RE_SALE_20260410.dbo.Audits
      WHERE CAST(AuditDate AS DATE) = '2026-04-11'
    `);
    console.log(`   Cần INSERT ${count11.recordset[0].c} Audits April 11`);

    if (count11.recordset[0].c > 0) {
      await dbxmtdPool.request().query(`
        SET IDENTITY_INSERT DBXMTD.dbo.Audits ON;
        INSERT INTO DBXMTD.dbo.Audits (Id, UserId, StoreId, Result, Notes, AuditDate, CreatedAt, UpdatedAt)
        SELECT Id, UserId, StoreId, Result, Notes, AuditDate, CreatedAt, UpdatedAt
        FROM RE_SALE_20260410.dbo.Audits
        WHERE CAST(AuditDate AS DATE) = '2026-04-11';
        SET IDENTITY_INSERT DBXMTD.dbo.Audits OFF;
      `);
      console.log(`   ✅ Đã INSERT April 11`);
    }

    // ─── 2. Khôi phục Audits April 13 ───
    console.log("\n📋 Khôi phục Audits ngày 13/04...");

    const count13 = await backupPool.request().query(`
      SELECT COUNT(*) as c FROM RE_SALE_20260410.dbo.Audits
      WHERE CAST(AuditDate AS DATE) = '2026-04-13'
    `);
    console.log(`   Cần INSERT ${count13.recordset[0].c} Audits April 13`);

    if (count13.recordset[0].c > 0) {
      await dbxmtdPool.request().query(`
        SET IDENTITY_INSERT DBXMTD.dbo.Audits ON;
        INSERT INTO DBXMTD.dbo.Audits (Id, UserId, StoreId, Result, Notes, AuditDate, CreatedAt, UpdatedAt)
        SELECT Id, UserId, StoreId, Result, Notes, AuditDate, CreatedAt, UpdatedAt
        FROM RE_SALE_20260410.dbo.Audits
        WHERE CAST(AuditDate AS DATE) = '2026-04-13';
        SET IDENTITY_INSERT DBXMTD.dbo.Audits OFF;
      `);
      console.log(`   ✅ Đã INSERT April 13`);
    }

    // ─── 3. Khôi phục Images liên quan ───
    console.log("\n📋 Khôi phục Images của April 11 & 13...");

    const imgApril = await backupPool.request().query(`
      SELECT COUNT(*) as c FROM RE_SALE_20260410.dbo.Images i
      INNER JOIN RE_SALE_20260410.dbo.Audits a ON i.AuditId = a.Id
      WHERE CAST(a.AuditDate AS DATE) IN ('2026-04-11', '2026-04-13')
    `);
    console.log(`   Backup có ${imgApril.recordset[0].c} Images April 11+13`);

    if (imgApril.recordset[0].c > 0) {
      await dbxmtdPool.request().query(`
        SET IDENTITY_INSERT DBXMTD.dbo.Images ON;
        INSERT INTO DBXMTD.dbo.Images (Id, AuditId, ImageUrl, ReferenceImageUrl, Latitude, Longitude, CapturedAt, CreatedAt, UpdatedAt)
        SELECT i.Id, i.AuditId, i.ImageUrl, i.ReferenceImageUrl, i.Latitude, i.Longitude, i.CapturedAt, i.CreatedAt, i.UpdatedAt
        FROM RE_SALE_20260410.dbo.Images i
        INNER JOIN RE_SALE_20260410.dbo.Audits a ON i.AuditId = a.Id
        WHERE CAST(a.AuditDate AS DATE) IN ('2026-04-11', '2026-04-13')
        AND NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Images x WHERE x.Id = i.Id);
        SET IDENTITY_INSERT DBXMTD.dbo.Images OFF;
      `);
      console.log(`   ✅ Đã INSERT Images April 11+13`);
    }

    // ─── Tổng kết ───
    console.log("\n📊 Kiểm tra sau khôi phục:");

    const finalApril11 = await dbxmtdPool.request().query(`
      SELECT COUNT(*) as c FROM DBXMTD.dbo.Audits
      WHERE CAST(AuditDate AS DATE) = '2026-04-11'
    `);
    const finalApril13 = await dbxmtdPool.request().query(`
      SELECT COUNT(*) as c FROM DBXMTD.dbo.Audits
      WHERE CAST(AuditDate AS DATE) = '2026-04-13'
    `);
    const total = await dbxmtdPool.request().query(`SELECT COUNT(*) as c FROM DBXMTD.dbo.Audits`);

    console.log(`   ✅ April 11: ${finalApril11.recordset[0].c} records`);
    console.log(`   ✅ April 13: ${finalApril13.recordset[0].c} records`);
    console.log(`   Tổng Audits trong DBXMTD: ${total.recordset[0].c}`);

    const dist = await dbxmtdPool.request().query(`
      SELECT TOP 5 CAST(AuditDate AS DATE) as d, COUNT(*) as c
      FROM DBXMTD.dbo.Audits
      GROUP BY CAST(AuditDate AS DATE)
      ORDER BY d DESC
    `);
    console.log("\n   📅 5 ngày gần nhất:");
    for (const r of dist.recordset) {
      console.log(`      ${r.d}: ${r.c}`);
    }

    console.log("\n═══════════════════════════════════════════════════");
    console.log("   ✅ KHÔI PHỤC HOÀN TẤT!");
    console.log("═══════════════════════════════════════════════════");
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
