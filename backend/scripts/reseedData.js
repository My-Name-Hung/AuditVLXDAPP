/**
 * Script to cleanup and reseed sample data
 * Usage: node scripts/reseedData.js
 */

require("dotenv").config();
const { getPool, sql } = require("../config/database");
const seedSampleData = require("../utils/seedSampleData");

async function cleanupAndReseed() {
  try {
    console.log("🚀 Starting cleanup and reseed process...");
    console.log("==================================================");

    const pool = await getPool();
    console.log("✅ Database connection established");

    // Clean up old audit data for first 2 users
    console.log("\n🧹 Cleaning up old audit data for test users...");
    const cleanupUsers = await pool.request().query(`
      SELECT Id, FullName FROM Users 
      WHERE FullName IN ('LÂM TẤT TOẠI', 'NGUYỄN PHƯƠNG SƠN')
    `);

    if (cleanupUsers.recordset.length > 0) {
      for (const user of cleanupUsers.recordset) {
        // Count existing data
        const auditCount = await pool
          .request()
          .input("UserId", sql.Int, user.Id)
          .query("SELECT COUNT(*) as Count FROM Audits WHERE UserId = @UserId");

        const imageCount = await pool
          .request()
          .input("UserId", sql.Int, user.Id).query(`
            SELECT COUNT(*) as Count FROM Images 
            WHERE AuditId IN (SELECT Id FROM Audits WHERE UserId = @UserId)
          `);

        const auditCountNum = auditCount.recordset[0]?.Count || 0;
        const imageCountNum = imageCount.recordset[0]?.Count || 0;

        if (auditCountNum > 0 || imageCountNum > 0) {
          console.log(
            `   📊 Found ${auditCountNum} audits and ${imageCountNum} images for ${user.FullName}`
          );

          // Delete images first
          await pool.request().input("UserId", sql.Int, user.Id).query(`
              DELETE FROM Images 
              WHERE AuditId IN (
                SELECT Id FROM Audits WHERE UserId = @UserId
              )
            `);

          // Delete audits
          await pool
            .request()
            .input("UserId", sql.Int, user.Id)
            .query("DELETE FROM Audits WHERE UserId = @UserId");

          console.log(
            `   ✅ Cleaned up ${auditCountNum} audits and ${imageCountNum} images for user: ${user.FullName}`
          );
        } else {
          console.log(
            `   ℹ️  No existing data to clean for user: ${user.FullName}`
          );
        }
      }
    } else {
      console.log("   ⚠️  Test users not found, skipping cleanup");
    }

    console.log("\n🌱 Starting to seed new sample data...");
    console.log("==================================================");
    await seedSampleData(true); // Skip cleanup since we already did it

    console.log("\n✅ Cleanup and reseed completed successfully!");
    console.log("==================================================");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during cleanup and reseed:", error);
    process.exit(1);
  }
}

// Run the script
cleanupAndReseed();
