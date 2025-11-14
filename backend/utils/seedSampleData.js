const bcrypt = require("bcryptjs");
const { getPool, sql } = require("../config/database");
const User = require("../models/User");
const Store = require("../models/Store");
const Audit = require("../models/Audit");
const Image = require("../models/Image");
const Territory = require("../models/Territory");
const {
  uploadImageWithWatermarkBase64,
} = require("../services/cloudinaryService");
const sharp = require("sharp");

/**
 * Create a simple placeholder image as base64
 * Returns a valid 800x600 white JPEG image in base64
 * Uses sharp to create a valid JPEG image
 */
async function createPlaceholderImageBase64() {
  try {
    // Create a valid 800x600 white JPEG image using sharp
    const imageBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }, // White background
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Convert to base64
    const base64String = imageBuffer.toString("base64");
    return base64String;
  } catch (error) {
    console.error("Error creating placeholder image:", error);
    // Fallback to a minimal valid JPEG base64 if sharp fails
    // This is a valid 1x1 white JPEG
    return "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA";
  }
}

/**
 * Upload sample image with watermark
 */
async function uploadSampleImageWithWatermark(latitude, longitude, capturedAt) {
  try {
    // Create a valid JPEG image using sharp
    const placeholderBase64 = await createPlaceholderImageBase64();

    // Ensure the base64 string doesn't include data URI prefix
    const cleanBase64 = placeholderBase64.replace(
      /^data:image\/jpeg;base64,/,
      ""
    );
    const base64Image = `data:image/jpeg;base64,${cleanBase64}`;

    const uploadResult = await uploadImageWithWatermarkBase64(base64Image, {
      latitude,
      longitude,
      timestamp: capturedAt.getTime(),
    });

    return uploadResult.secure_url;
  } catch (error) {
    console.error("Error uploading sample image with watermark:", error);
    // Fallback: Create a URL with watermark parameters as query string
    // This way we can still track the metadata even if upload fails
    const day = String(capturedAt.getDate()).padStart(2, "0");
    const month = String(capturedAt.getMonth() + 1).padStart(2, "0");
    const year = capturedAt.getFullYear();
    const hours = String(capturedAt.getHours()).padStart(2, "0");
    const minutes = String(capturedAt.getMinutes()).padStart(2, "0");
    const seconds = String(capturedAt.getSeconds()).padStart(2, "0");
    const timeString = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    return `https://res.cloudinary.com/demo/image/upload/sample.jpg?lat=${latitude}&lon=${longitude}&time=${encodeURIComponent(
      timeString
    )}&t=${Date.now()}`;
  }
}

// Sample data based on the image - 26 users
const sampleUsers = [
  { fullName: "LÂM TẤT TOẠI", territory: "Trung tâm Tiêu Thụ" },
  { fullName: "NGUYỄN PHƯƠNG SƠN", territory: "TPHCM" },
  { fullName: "LÊ HỒNG TRƯỜNG", territory: "Bắc Mekong + Miền Đông" },
  { fullName: "LƯƠNG TẤN HƯNG (CT)", territory: "Nam Mekong" },
  { fullName: "PHẠM VŨ LINH", territory: "Nam Mekong" },
  { fullName: "LƯƠNG VIỆT KHẢI (CT)", territory: "Miền Đông" },
  { fullName: "TRƯƠNG MINH ĐƯƠNG", territory: "Trà Vinh" },
  { fullName: "NGUYỄN MINH LÝ", territory: "Đồng Tháp" },
  { fullName: "VÕ TẤN PHÁT", territory: "An Giang" },
  { fullName: "THI QUỐC ĐẠT", territory: "Tiền Giang" },
  { fullName: "DANH HOÀNG ANH", territory: "Kiên Giang" },
  { fullName: "PHAN KIM HÙNG (CT)", territory: "Vĩnh Long" },
  { fullName: "HUỲNH CHÍ NAM", territory: "Cà Mau" },
  { fullName: "NGUYỄN PHI PHÀM", territory: "Sóc Trăng" },
  { fullName: "TRỊNH NGỌC CHANH", territory: "TPHCM" },
  { fullName: "LÊ NHẬT QUANG", territory: "Long An" },
  { fullName: "LÊ HOÀNG KHANG", territory: "Bạc Liêu" },
  { fullName: "NGUYỄN QUỐC DŨNG", territory: "TPHCM" },
  { fullName: "NGUYỄN ĐỨC CƯỜNG", territory: "Đồng Nai" },
  { fullName: "LÊ NGỌC ANH", territory: "Bình Dương" },
  { fullName: "NGUYỄN BÙI ANH ĐỒNG", territory: "Đồng Nai" },
  { fullName: "PHAN NGỌC VƯƠNG", territory: "Bình Phước + ĐắK Nông" },
  { fullName: "TÔ THỂ HIỂN", territory: "Tây Ninh" },
  { fullName: "NGUYỄN VĂN VINH", territory: "Cần Thơ" },
  { fullName: "NGUYỄN THÀNH TRUNG", territory: "Tiền Giang (Tín Nghĩa Mỹ)" },
  { fullName: "THẠCH XEM", territory: "Bến Tre" },
];

const sampleStores = [
  { name: "VLXD Bình Nguyên", address: "123 Đường ABC, Quận 1, TPHCM" },
  { name: "VLXD Huỳnh Đức", address: "456 Đường XYZ, Quận 2, TPHCM" },
  { name: "VLXD Minh Nhựt", address: "789 Đường DEF, Quận 3, TPHCM" },
  { name: "CH Hai Bé", address: "321 Đường GHI, Quận 4, TPHCM" },
  { name: "CH Trí Cường", address: "654 Đường JKL, Quận 5, TPHCM" },
  { name: "CH Quách Ngân", address: "987 Đường MNO, Quận 6, TPHCM" },
  { name: "CH Kỳ An", address: "147 Đường PQR, Quận 7, TPHCM" },
  { name: "CH Minh Phát", address: "258 Đường STU, Quận 8, TPHCM" },
  { name: "CH Nhựt Vy", address: "369 Đường VWX, Quận 9, TPHCM" },
  { name: "VLXD Phúc Thịnh", address: "741 Đường YZA, Quận 10, TPHCM" },
  { name: "VLXD Xuân Thùy", address: "852 Đường BCD, Quận 11, TPHCM" },
  { name: "VLXD Đông Phương", address: "963 Đường EFG, Quận 12, TPHCM" },
  { name: "CH Thành Công", address: "159 Đường HIJ, Quận Bình Thạnh, TPHCM" },
  { name: "CH Vạn Lợi", address: "357 Đường KLM, Quận Tân Bình, TPHCM" },
  { name: "VLXD Hưng Thịnh", address: "468 Đường NOP, Quận Phú Nhuận, TPHCM" },
];

async function seedSampleData() {
  try {
    const pool = await getPool();
    console.log("🌱 Starting to seed sample data...");

    // Get territories
    const territories = await Territory.findAll();
    const territoryMap = {};
    territories.forEach((t) => {
      territoryMap[t.TerritoryName] = t.Id;
    });

    // Create users
    const createdUsers = [];
    for (const userData of sampleUsers) {
      const territoryId = territoryMap[userData.territory];
      if (!territoryId) {
        console.warn(
          `⚠️  Territory "${userData.territory}" not found, skipping user ${userData.fullName}`
        );
        continue;
      }

      // Check if user already exists
      const existingUser = await pool
        .request()
        .input("FullName", sql.NVarChar(200), userData.fullName)
        .query("SELECT Id FROM Users WHERE FullName = @FullName");

      if (existingUser.recordset.length > 0) {
        console.log(
          `ℹ️  User "${userData.fullName}" already exists, updating territory...`
        );
        await pool
          .request()
          .input("Id", sql.Int, existingUser.recordset[0].Id)
          .input("TerritoryId", sql.Int, territoryId)
          .query("UPDATE Users SET TerritoryId = @TerritoryId WHERE Id = @Id");
        createdUsers.push(existingUser.recordset[0]);
        continue;
      }

      const username = userData.fullName
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()]/g, "");
      const hashedPassword = await bcrypt.hash("123456", 10);
      const userCode = await User.generateUserCode();

      const user = await pool
        .request()
        .input("UserCode", sql.VarChar(50), userCode)
        .input("Username", sql.NVarChar(100), username)
        .input("Password", sql.NVarChar(255), hashedPassword)
        .input("FullName", sql.NVarChar(200), userData.fullName)
        .input("Email", sql.NVarChar(200), `${username}@example.com`)
        .input("Phone", sql.VarChar(20), "0123456789")
        .input("Role", sql.VarChar(50), "user")
        .input("TerritoryId", sql.Int, territoryId)
        .input("IsChangePassword", sql.Bit, 1).query(`
           INSERT INTO Users (UserCode, Username, Password, FullName, Email, Phone, Role, TerritoryId, IsChangePassword, CreatedAt, UpdatedAt)
           OUTPUT INSERTED.*
           VALUES (@UserCode, @Username, @Password, @FullName, @Email, @Phone, @Role, @TerritoryId, @IsChangePassword, GETDATE(), GETDATE())
         `);

      createdUsers.push(user.recordset[0]);
      console.log(`✅ Created user: ${userData.fullName}`);
    }

    // Create stores and assign to users
    const createdStores = [];
    let storeIndex = 0;
    for (const storeData of sampleStores) {
      // Check if store already exists
      const existingStore = await pool
        .request()
        .input("StoreName", sql.NVarChar(200), storeData.name)
        .query("SELECT Id FROM Stores WHERE StoreName = @StoreName");

      let store;
      if (existingStore.recordset.length > 0) {
        store = existingStore.recordset[0];
      } else {
        const storeCode = await Store.generateStoreCode();
        const result = await pool
          .request()
          .input("StoreCode", sql.VarChar(50), storeCode)
          .input("StoreName", sql.NVarChar(200), storeData.name)
          .input("Address", sql.NVarChar(500), storeData.address)
          .input("Phone", sql.VarChar(20), "0123456789")
          .input("Email", sql.NVarChar(200), `${storeCode}@example.com`)
          .input("Latitude", sql.Decimal(10, 8), 10.762622)
          .input("Longitude", sql.Decimal(11, 8), 106.660172).query(`
            INSERT INTO Stores (StoreCode, StoreName, Address, Phone, Email, Latitude, Longitude, CreatedAt, UpdatedAt)
            OUTPUT INSERTED.*
            VALUES (@StoreCode, @StoreName, @Address, @Phone, @Email, @Latitude, @Longitude, GETDATE(), GETDATE())
          `);
        store = result.recordset[0];
        console.log(`✅ Created store: ${storeData.name}`);
      }

      // Assign store to user (round-robin)
      const userId = createdUsers[storeIndex % createdUsers.length].Id;
      await pool
        .request()
        .input("StoreId", sql.Int, store.Id)
        .input("UserId", sql.Int, userId)
        .query("UPDATE Stores SET UserId = @UserId WHERE Id = @StoreId");

      createdStores.push({ ...store, UserId: userId });
      storeIndex++;
    }

    // Create audits with images for first 2 users (LÂM TẤT TOẠI and NGUYỄN PHƯƠNG SƠN)
    const activeUsers = createdUsers.slice(0, 2);
    const dates = [
      new Date("2025-11-01"),
      new Date("2025-11-02"),
      new Date("2025-11-03"),
      new Date("2025-11-04"),
      new Date("2025-11-05"),
    ];

    // User 1: LÂM TẤT TOẠI - 5 days, 11 stores
    const user1Stores = createdStores
      .filter((s) => s.UserId === activeUsers[0].Id)
      .slice(0, 11);
    for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
      const auditDate = dates[dayIndex];
      const storesForDay = user1Stores
        .slice(dayIndex * 2, (dayIndex + 1) * 2 + 1)
        .filter(Boolean);

      for (const store of storesForDay) {
        const audit = await Audit.create({
          UserId: activeUsers[0].Id,
          StoreId: store.Id,
          Result: "pass",
          Notes: "Checkin thành công",
          AuditDate: auditDate,
        });

        // Create image for audit with watermark
        const capturedAt = new Date(auditDate.getTime() + 9 * 60 * 60 * 1000); // 9 AM
        const imageUrl = await uploadSampleImageWithWatermark(
          10.762622,
          106.660172,
          capturedAt
        );

        await Image.create({
          AuditId: audit.Id,
          ImageUrl: imageUrl,
          ReferenceImageUrl: null,
          Latitude: 10.762622,
          Longitude: 106.660172,
          CapturedAt: capturedAt,
        });
      }
    }

    // User 2: NGUYỄN PHƯƠNG SƠN - 5 days, 13 stores
    const user2Stores = createdStores.filter(
      (s) => s.UserId === activeUsers[1].Id
    );
    for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
      const auditDate = dates[dayIndex];
      const storesForDay = user2Stores
        .slice(dayIndex * 2, (dayIndex + 1) * 2 + 1)
        .filter(Boolean);

      for (const store of storesForDay) {
        const audit = await Audit.create({
          UserId: activeUsers[1].Id,
          StoreId: store.Id,
          Result: "pass",
          Notes: "Checkin thành công",
          AuditDate: auditDate,
        });

        // Create image for audit with watermark
        const capturedAt2 = new Date(auditDate.getTime() + 10 * 60 * 60 * 1000); // 10 AM
        const imageUrl2 = await uploadSampleImageWithWatermark(
          10.762622,
          106.660172,
          capturedAt2
        );

        await Image.create({
          AuditId: audit.Id,
          ImageUrl: imageUrl2,
          ReferenceImageUrl: null,
          Latitude: 10.762622,
          Longitude: 106.660172,
          CapturedAt: capturedAt2,
        });
      }
    }

    // Add more stores to user 2 to reach 13
    const additionalStores = createdStores
      .filter(
        (s) => s.UserId !== activeUsers[0].Id && s.UserId !== activeUsers[1].Id
      )
      .slice(0, 2);
    for (const store of additionalStores) {
      await pool
        .request()
        .input("StoreId", sql.Int, store.Id)
        .input("UserId", sql.Int, activeUsers[1].Id)
        .query("UPDATE Stores SET UserId = @UserId WHERE Id = @StoreId");
    }

    // Create more audits for user 2 to reach 13 stores
    const user2AllStores = createdStores.filter(
      (s) => s.UserId === activeUsers[1].Id
    );
    for (let i = 0; i < 2; i++) {
      const store = user2AllStores[user2Stores.length + i];
      if (store) {
        const audit = await Audit.create({
          UserId: activeUsers[1].Id,
          StoreId: store.Id,
          Result: "pass",
          Notes: "Checkin thành công",
          AuditDate: dates[0],
        });

        // Create image for audit with watermark
        const capturedAt3 = new Date(dates[0].getTime() + 11 * 60 * 60 * 1000);
        const imageUrl3 = await uploadSampleImageWithWatermark(
          10.762622,
          106.660172,
          capturedAt3
        );

        await Image.create({
          AuditId: audit.Id,
          ImageUrl: imageUrl3,
          ReferenceImageUrl: null,
          Latitude: 10.762622,
          Longitude: 106.660172,
          CapturedAt: capturedAt3,
        });
      }
    }

    console.log("✅ Sample data seeded successfully!");
    console.log(`   - Created ${createdUsers.length} users`);
    console.log(`   - Created ${createdStores.length} stores`);
    console.log(`   - Created audits with images for 2 active users`);
  } catch (error) {
    console.error("❌ Error seeding sample data:", error);
    throw error;
  }
}

module.exports = seedSampleData;
