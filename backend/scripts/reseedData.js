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

    // Clean up old audit data for all users (since this is test data)
    console.log("\n🧹 Cleaning up old audit data...");
    
    // Count existing data
    const totalAudits = await pool.request().query("SELECT COUNT(*) as Count FROM Audits");
    const totalImages = await pool.request().query("SELECT COUNT(*) as Count FROM Images");
    
    const auditCountNum = totalAudits.recordset[0]?.Count || 0;
    const imageCountNum = totalImages.recordset[0]?.Count || 0;
    
    if (auditCountNum > 0 || imageCountNum > 0) {
      console.log(`   📊 Found ${auditCountNum} audits and ${imageCountNum} images to clean up`);
      
      // Delete all images first (foreign key constraint)
      await pool.request().query("DELETE FROM Images");
      console.log(`   ✅ Deleted ${imageCountNum} images`);
      
      // Delete all audits
      await pool.request().query("DELETE FROM Audits");
      console.log(`   ✅ Deleted ${auditCountNum} audits`);
      
      console.log("   ✅ Cleanup completed successfully");
    } else {
      console.log("   ℹ️  No existing data to clean");
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
