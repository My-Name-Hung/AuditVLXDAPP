/**
 * Script XÓA DATA TỪ BACKUP RE_SALE_20260410
 *
 * Mục tiêu: Xóa Audits & Images ngày Nov 2025 -> Apr 10
 *           GIỮ LẠI April 11 & 13 (đã recover riêng trước đó)
 *
 * Lịch sử:
 *   1. recoverAprilRecords.js  -> INSERT April 11 & 13 vào DBXMTD (cùng ID gốc)
 *   2. mergeBackupData.js     -> NOT EXISTS nên bỏ qua (ID đã tồn tại)
 *   3. undoMerge.js           -> DBXMTD === Backup nên 0 xóa
 *
 * Hành động:
 *   - Xóa Audits: AuditDate < '2026-04-11'  (tức Nov 2025 -> Apr 10)
 *   - Xóa Images: liên quan đến Audits đã xóa
 *   - GIỮ April 11 & 13 (không xóa)
 *
 * Chạy: node scripts/deleteBackupData.js
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

async function connectDB(config, name) {
  const pool = await sql.connect(config);
  console.log(`✅ Kết nối: ${name}`);
  return pool;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("   ⚠️  XÓA DATA TỪ BACKUP");
  console.log("   Xóa Audits & Images: Nov 2025 -> Apr 10/2026");
  console.log("   GIỮ LẠI: April 11 & 13/2026");
  console.log("═══════════════════════════════════════════════════════");

  let pool = null;

  try {
    pool = await connectDB(DBXMTD_CONFIG, "DBXMTD");

    // ─── Kiểm tra trước ───
    console.log("\n🔍 Tình trạng hiện tại...");

    const totalAudits = await pool.request().query(`SELECT COUNT(*) as c FROM DBXMTD.dbo.Audits`);
    const totalImages = await pool.request().query(`SELECT COUNT(*) as c FROM DBXMTD.dbo.Images`);
    console.log(`   Tổng Audits:  ${totalAudits.recordset[0].c}`);
    console.log(`   Tổng Images:  ${totalImages.recordset[0].c}`);

    // Đếm sẽ xóa
    const toDeleteAudit = await pool.request().query(`
      SELECT COUNT(*) as c FROM DBXMTD.dbo.Audits
      WHERE CAST(AuditDate AS DATE) < '2026-04-11'
    `);
    const toKeepAudit = await pool.request().query(`
      SELECT COUNT(*) as c FROM DBXMTD.dbo.Audits
      WHERE CAST(AuditDate AS DATE) >= '2026-04-11'
    `);
    console.log(`\n   Sẽ XÓA:   ${toDeleteAudit.recordset[0].c} Audits (Nov 2025 -> Apr 10)`);
    console.log(`   Sẽ GIỮ:  ${toKeepAudit.recordset[0].c} Audits (Apr 11+)`

    );
    // Chi tiết giữ lại
    const keepDetail = await pool.request().query(`
      SELECT CAST(AuditDate AS DATE) as d, COUNT(*) as c
      FROM DBXMTD.dbo.Audits
      WHERE CAST(AuditDate AS DATE) >= '2026-04-11'
      GROUP BY CAST(AuditDate AS DATE)
      ORDER BY d
    `);
    console.log("\n   📅 Records sẽ GIỮ LẠI:");
    for (const r of keepDetail.recordset) {
      console.log(`      ${r.d}: ${r.c}`);
    }

    // ─── Xóa Images trước (FK constraint) ───
    console.log("\n🗑️  Bước 1: Xóa Images của Audits sắp xóa...");

    const imgToDelete = await pool.request().query(`
      SELECT COUNT(*) as c FROM DBXMTD.dbo.Images i
      INNER JOIN DBXMTD.dbo.Audits a ON i.AuditId = a.Id
      WHERE CAST(a.AuditDate AS DATE) < '2026-04-11'
    `);
    console.log(`   Sẽ xóa ${imgToDelete.recordset[0].c} Images...`);

    if (imgToDelete.recordset[0].c > 0) {
      const start = Date.now();
      const r = await pool.request().query(`
        DELETE FROM DBXMTD.dbo.Images
        WHERE AuditId IN (
          SELECT Id FROM DBXMTD.dbo.Audits
          WHERE CAST(AuditDate AS DATE) < '2026-04-11'
        )
      `);
      console.log(`   ✅ Đã xóa ${r.rowsAffected[0]} Images trong ${((Date.now() - start) / 1000).toFixed(1)}s`);
    } else {
      console.log("   ⏭️  Không có Images để xóa");
    }

    // ─── Xóa Audits ───
    console.log("\n🗑️  Bước 2: Xóa Audits Nov 2025 -> Apr 10...");

    if (toDeleteAudit.recordset[0].c > 0) {
      const start = Date.now();
      const r = await pool.request().query(`
        DELETE FROM DBXMTD.dbo.Audits
        WHERE CAST(AuditDate AS DATE) < '2026-04-11'
      `);
      console.log(`   ✅ Đã xóa ${r.rowsAffected[0]} Audits trong ${((Date.now() - start) / 1000).toFixed(1)}s`);
    } else {
      console.log("   ⏭️  Không có Audits để xóa");
    }

    // ─── Kiểm tra sau xóa ───
    console.log("\n📊 Kiểm tra sau xóa:");

    const afterAudits = await pool.request().query(`SELECT COUNT(*) as c FROM DBXMTD.dbo.Audits`);
    const afterImages = await pool.request().query(`SELECT COUNT(*) as c FROM DBXMTD.dbo.Images`);
    console.log(`   DBXMTD Audits:  ${afterAudits.recordset[0].c}`);
    console.log(`   DBXMTD Images:  ${afterImages.recordset[0].c}`);

    const dist = await pool.request().query(`
      SELECT CAST(AuditDate AS DATE) as d, COUNT(*) as c
      FROM DBXMTD.dbo.Audits GROUP BY CAST(AuditDate AS DATE) ORDER BY d
    `);
    console.log("\n   📅 Phân bổ ngày còn lại:");
    for (const r of dist.recordset) {
      console.log(`      ${r.d}: ${r.c}`);
    }

    const remaining = dist.recordset.reduce((s, x) => s + x.c, 0);
    console.log(`\n   Tổng còn lại: ${remaining} Audits`);

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("   ✅ HOÀN TẤT!");
    console.log(`   Đã xóa data backup (Nov 2025 -> Apr 10)`);
    console.log(`   Giữ lại April 11 & 13`);
    console.log("═══════════════════════════════════════════════════════");
  } catch (err) {
    console.error("\n❌ Lỗi:", err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
    console.log("🔌 Đã đóng kết nối");
  }
}

main();
