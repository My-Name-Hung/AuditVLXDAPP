/**
 * Script to seed core accounts (e.g., Admin)
 * Usage: node scripts/reseedData.js
 */

require("dotenv").config();
const { getPool, sql } = require("../config/database");
const { seedAdminUser } = require("../utils/seedAdmin"); 


async function cleanupAndReseed() {
    try {
        console.log("🚀 Starting core seed process...");
        console.log("==================================================");

        const pool = await getPool();
        console.log("✅ Database connection established");

        // --- BƯỚC MỚI: TẠO HOẶC KIỂM TRA TÀI KHOẢN ADMIN ---
        console.log("\n👤 Seeding/Checking Admin User...");
        console.log("==================================================");
        // Gọi hàm seedAdminUser để tạo hoặc kiểm tra tài khoản admin
        await seedAdminUser();
        // ------------------------------------------------------

        console.log("\n✅ Core seeding completed successfully!");
        console.log("==================================================");
        process.exit(0);
    } catch (error) {
        console.error("❌ Error during core seed:", error);
        process.exit(1);
    }
}

// Run the script
cleanupAndReseed();