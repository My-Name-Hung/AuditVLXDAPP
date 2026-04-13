/**
 * Script HOÀN TÁC MERGE: Xóa records vừa merge vào DBXMTD
 *
 * Nguyên tắc: Xóa records mới được insert từ RE_SALE_20260410
 * Giữ lại data gốc ban đầu trong DBXMTD
 *
 * ⚠️  CHẠY SCRIPT NÀY = MẤT TOÀN BỘ DATA MỚI TỪ BACKUP
 * Chỉ chạy khi muốn hoàn tác hoàn toàn merge
 *
 * Chạy: node scripts/undoMerge.js
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

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("   ⚠️  HOÀN TÁC MERGE - CẢNH BÁO DỮ LIỆU");
  console.log("   Script này sẽ XÓA records mới được merge vào");
  console.log("   Giữ lại data gốc trước khi merge");
  console.log("═══════════════════════════════════════════════════════");

  let backupPool = null;
  let dbxmtdPool = null;

  try {
    backupPool = await connectDB(BACKUP_CONFIG, "RE_SALE_20260410 (Backup)");
    dbxmtdPool = await connectDB(DBXMTD_CONFIG, "DBXMTD (Hiện tại)");

    // ─── Bước 1: Đếm trước ───
    console.log("\n🔍 Tình trạng hiện tại...");

    const dbTotal = await dbxmtdPool.request().query(`SELECT COUNT(*) as c FROM DBXMTD.dbo.Audits`);
    const bkTotal = await backupPool.request().query(`SELECT COUNT(*) as c FROM RE_SALE_20260410.dbo.Audits`);
    console.log(`   DBXMTD Audits hiện tại: ${dbTotal.recordset[0].c}`);
    console.log(`   Backup RE_SALE Audits:   ${bkTotal.recordset[0].c}`);
    console.log(`   Chênh lệch: ${dbTotal.recordset[0].c - bkTotal.recordset[0].c}`);

    // Tính số records cần xóa = DBXMTD - Backup
    const toDeleteAudit = await dbxmtdPool.request().query(`
      SELECT COUNT(*) as c FROM DBXMTD.dbo.Audits a
      WHERE NOT EXISTS (
        SELECT 1 FROM RE_SALE_20260410.dbo.Audits b WHERE b.Id = a.Id
      )
    `);
    const toDeleteImg = await dbxmtdPool.request().query(`
      SELECT COUNT(*) as c FROM DBXMTD.dbo.Images i
      WHERE NOT EXISTS (
        SELECT 1 FROM RE_SALE_20260410.dbo.Images b WHERE b.Id = i.Id
      )
    `);
    console.log(`\n   Sẽ XÓA: ${toDeleteAudit.recordset[0].c} Audits, ${toDeleteImg.recordset[0].c} Images`);

    // ─── Bước 2: Xóa Images mới ───
    if (toDeleteImg.recordset[0].c > 0) {
      console.log("\n🗑️  Xóa Images mới...");
      const start = Date.now();
      const r = await dbxmtdPool.request().query(`
        DELETE FROM DBXMTD.dbo.Images
        WHERE NOT EXISTS (
          SELECT 1 FROM RE_SALE_20260410.dbo.Images b WHERE b.Id = DBXMTD.dbo.Images.Id
        )
      `);
      console.log(`   ✅ Đã xóa ${r.rowsAffected[0]} Images trong ${((Date.now() - start) / 1000).toFixed(1)}s`);
    } else {
      console.log("\n🗑️  Không có Images mới để xóa");
    }

    // ─── Bước 3: Xóa Audits mới ───
    if (toDeleteAudit.recordset[0].c > 0) {
      console.log("\n🗑️  Xóa Audits mới...");
      const start = Date.now();
      const r = await dbxmtdPool.request().query(`
        DELETE FROM DBXMTD.dbo.Audits
        WHERE NOT EXISTS (
          SELECT 1 FROM RE_SALE_20260410.dbo.Audits b WHERE b.Id = DBXMTD.dbo.Audits.Id
        )
      `);
      console.log(`   ✅ Đã xóa ${r.rowsAffected[0]} Audits trong ${((Date.now() - start) / 1000).toFixed(1)}s`);
    } else {
      console.log("\n🗑️  Không có Audits mới để xóa");
    }

    // ─── Bước 4: Xóa Stores mới (nếu có) ───
    const toDeleteStore = await dbxmtdPool.request().query(`
      SELECT COUNT(*) as c FROM DBXMTD.dbo.Stores s
      WHERE NOT EXISTS (
        SELECT 1 FROM RE_SALE_20260410.dbo.Stores b WHERE b.Id = s.Id
      )
    `);
    if (toDeleteStore.recordset[0].c > 0) {
      console.log(`\n🗑️  Xóa ${toDeleteStore.recordset[0].c} Stores mới...`);
      await dbxmtdPool.request().query(`
        DELETE FROM DBXMTD.dbo.Stores
        WHERE NOT EXISTS (
          SELECT 1 FROM RE_SALE_20260410.dbo.Stores b WHERE b.Id = DBXMTD.dbo.Stores.Id
        )
      `);
      console.log("   ✅ Đã xóa Stores mới");
    }

    // ─── Bước 5: Xóa Users mới (nếu có) ───
    const toDeleteUser = await dbxmtdPool.request().query(`
      SELECT COUNT(*) as c FROM DBXMTD.dbo.Users u
      WHERE NOT EXISTS (
        SELECT 1 FROM RE_SALE_20260410.dbo.Users b WHERE b.Id = u.Id
      )
    `);
    if (toDeleteUser.recordset[0].c > 0) {
      console.log(`\n🗑️  Xóa ${toDeleteUser.recordset[0].c} Users mới...`);
      await dbxmtdPool.request().query(`
        DELETE FROM DBXMTD.dbo.Users
        WHERE NOT EXISTS (
          SELECT 1 FROM RE_SALE_20260410.dbo.Users b WHERE b.Id = DBXMTD.dbo.Users.Id
        )
      `);
      console.log("   ✅ Đã xóa Users mới");
    }

    // ─── Bước 6: Kiểm tra sau hoàn tác ───
    console.log("\n📊 Kiểm tra sau hoàn tác:");

    const afterTotal = await dbxmtdPool.request().query(`SELECT COUNT(*) as c FROM DBXMTD.dbo.Audits`);
    const afterImg = await dbxmtdPool.request().query(`SELECT COUNT(*) as c FROM DBXMTD.dbo.Images`);
    console.log(`   DBXMTD Audits: ${afterTotal.recordset[0].c}`);
    console.log(`   DBXMTD Images: ${afterImg.recordset[0].c}`);

    // So sánh với backup
    const bkAudit = await backupPool.request().query(`SELECT COUNT(*) as c FROM RE_SALE_20260410.dbo.Audits`);
    const bkImg = await backupPool.request().query(`SELECT COUNT(*) as c FROM RE_SALE_20260410.dbo.Images`);
    console.log(`   Backup Audits:  ${bkAudit.recordset[0].c}`);
    console.log(`   Backup Images:  ${bkImg.recordset[0].c}`);

    const diff = afterTotal.recordset[0].c - bkAudit.recordset[0].c;
    if (diff === 0) {
      console.log("\n   ✅ DBXMTD khớp với Backup - hoàn tác thành công!");
    } else {
      console.log(`\n   ⚠️  Chênh lệch: ${diff} records`);
    }

    // Phân bổ ngày
    const dist = await dbxmtdPool.request().query(`
      SELECT CAST(AuditDate AS DATE) as d, COUNT(*) as c
      FROM DBXMTD.dbo.Audits GROUP BY CAST(AuditDate AS DATE) ORDER BY d DESC
    `);
    const total = dist.recordset.reduce((s, x) => s + x.c, 0);
    console.log(`\n📅 Phân bổ ngày: Tổng=${total} records across ${dist.recordset.length} ngày`);
    for (const r of dist.recordset) {
      console.log(`   ${r.d}: ${r.c}`);
    }

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("   ✅ HOÀN TÁC HOÀN TẤT!");
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
