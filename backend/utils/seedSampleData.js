const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const { getPool, sql } = require("../config/database");
const User = require("../models/User");
const Store = require("../models/Store");
const Audit = require("../models/Audit");
const Image = require("../models/Image");
const Territory = require("../models/Territory");
const {
  uploadImageWithWatermarkBase64,
} = require("../services/cloudinaryService");

/**
 * Read example image from assets folder and convert to base64
 * Returns base64 string of the example.jpg image
 */
function readExampleImageAsBase64() {
  try {
    // Try multiple possible paths
    const possiblePaths = [
      path.join(process.cwd(), "backend", "assets", "example", "example.jpg"),
      path.join(process.cwd(), "assets", "example", "example.jpg"),
    ];

    // Find the first existing path
    let finalPath = null;
    for (const imagePath of possiblePaths) {
      if (fs.existsSync(imagePath)) {
        finalPath = imagePath;
        break;
      }
    }

    // Check if file exists
    if (!finalPath) {
      throw new Error(
        `Example image not found. Tried paths: ${possiblePaths.join(", ")}`
      );
    }

    // Read image file as buffer
    const imageBuffer = fs.readFileSync(finalPath);

    // Convert to base64
    const base64String = imageBuffer.toString("base64");
    console.log(`✅ Loaded example image from: ${finalPath}`);
    return base64String;
  } catch (error) {
    console.error("Error reading example image:", error);
    throw error;
  }
}

/**
 * Upload sample image with watermark
 * Uses the example.jpg from backend/assets/example/example.jpg
 *
 * NOTE: This function is ONLY for test data seeding.
 * Real image uploads will come from the mobile app frontend,
 * which will use the uploadImageWithWatermark function from cloudinaryService.
 */
async function uploadSampleImageWithWatermark(latitude, longitude, capturedAt) {
  try {
    // Read example image from assets folder
    const imageBase64 = readExampleImageAsBase64();
    const base64Image = `data:image/jpeg;base64,${imageBase64}`;

    // Upload to Cloudinary with watermark
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
  {
    name: "VLXD Bình Nguyên",
    address: "123 Đường Nguyễn Huệ, Quận 1, TPHCM",
    lat: 10.7769,
    lon: 106.7009,
  },
  {
    name: "VLXD Huỳnh Đức",
    address: "456 Đường Võ Văn Tần, Quận 3, TPHCM",
    lat: 10.7831,
    lon: 106.6907,
  },
  {
    name: "VLXD Minh Nhựt",
    address: "789 Đường Lê Lợi, Quận 1, TPHCM",
    lat: 10.7756,
    lon: 106.7019,
  },
  {
    name: "CH Hai Bé",
    address: "321 Đường Nguyễn Thị Minh Khai, Quận 3, TPHCM",
    lat: 10.787,
    lon: 106.6914,
  },
  {
    name: "CH Trí Cường",
    address: "654 Đường Cách Mạng Tháng 8, Quận 10, TPHCM",
    lat: 10.772,
    lon: 106.6683,
  },
  {
    name: "CH Quách Ngân",
    address: "987 Đường Lý Thường Kiệt, Quận 10, TPHCM",
    lat: 10.7736,
    lon: 106.6678,
  },
  {
    name: "CH Kỳ An",
    address: "147 Đường Nguyễn Văn Cừ, Quận 5, TPHCM",
    lat: 10.7559,
    lon: 106.667,
  },
  {
    name: "CH Minh Phát",
    address: "258 Đường Trần Hưng Đạo, Quận 5, TPHCM",
    lat: 10.7526,
    lon: 106.6674,
  },
  {
    name: "CH Nhựt Vy",
    address: "369 Đường Nguyễn Trãi, Quận 1, TPHCM",
    lat: 10.7694,
    lon: 106.6942,
  },
  {
    name: "VLXD Phúc Thịnh",
    address: "741 Đường Pasteur, Quận 3, TPHCM",
    lat: 10.7889,
    lon: 106.6911,
  },
  {
    name: "VLXD Xuân Thùy",
    address: "852 Đường Điện Biên Phủ, Quận Bình Thạnh, TPHCM",
    lat: 10.8019,
    lon: 106.7148,
  },
  {
    name: "VLXD Đông Phương",
    address: "963 Đường Xô Viết Nghệ Tĩnh, Quận Bình Thạnh, TPHCM",
    lat: 10.8105,
    lon: 106.7141,
  },
  {
    name: "CH Thành Công",
    address: "159 Đường Hoàng Văn Thụ, Quận Tân Bình, TPHCM",
    lat: 10.8014,
    lon: 106.6525,
  },
  {
    name: "CH Vạn Lợi",
    address: "357 Đường Cộng Hòa, Quận Tân Bình, TPHCM",
    lat: 10.8011,
    lon: 106.6446,
  },
  {
    name: "VLXD Hưng Thịnh",
    address: "468 Đường Phạm Văn Đồng, Quận Bình Thạnh, TPHCM",
    lat: 10.8429,
    lon: 106.742,
  },
  {
    name: "CH An Phát",
    address: "159 Đường Lê Đức Thọ, Quận Gò Vấp, TPHCM",
    lat: 10.85,
    lon: 106.67,
  },
  {
    name: "VLXD Thành Đạt",
    address: "357 Đường Quang Trung, Quận Gò Vấp, TPHCM",
    lat: 10.84,
    lon: 106.68,
  },
  {
    name: "CH Phú Thịnh",
    address: "468 Đường Nguyễn Oanh, Quận Gò Vấp, TPHCM",
    lat: 10.83,
    lon: 106.69,
  },
  {
    name: "VLXD Đức Thành",
    address: "789 Đường Lê Văn Thọ, Quận 12, TPHCM",
    lat: 10.86,
    lon: 106.64,
  },
  {
    name: "CH Minh Khang",
    address: "321 Đường Tân Hương, Quận Tân Phú, TPHCM",
    lat: 10.76,
    lon: 106.63,
  },
];

async function seedSampleData(skipCleanup = false) {
  try {
    const pool = await getPool();
    console.log("🌱 Starting to seed sample data...");

    // Clean up old audit data for first 2 users (LÂM TẤT TOẠI and NGUYỄN PHƯƠNG SƠN)
    // This ensures fresh data with updated watermark is created
    if (!skipCleanup) {
      console.log("🧹 Cleaning up old audit data for test users...");
      const cleanupUsers = await pool.request().query(`
        SELECT Id, FullName FROM Users 
        WHERE FullName IN ('LÂM TẤT TOẠI', 'NGUYỄN PHƯƠNG SƠN')
      `);

      if (cleanupUsers.recordset.length > 0) {
        for (const user of cleanupUsers.recordset) {
          // Count existing data before deletion
          const auditCount = await pool
            .request()
            .input("UserId", sql.Int, user.Id)
            .query(
              "SELECT COUNT(*) as Count FROM Audits WHERE UserId = @UserId"
            );

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

            // Delete images first (foreign key constraint)
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
    } else {
      console.log("   ⏭️  Skipping cleanup (already done externally)");
    }

    // Get territories
    const territories = await Territory.findAll();
    const territoryMap = {};
    territories.forEach((t) => {
      territoryMap[t.TerritoryName] = t.Id;
    });

    // Create users (no longer need TerritoryId)
    const createdUsers = [];
    const userTerritoryMap = {}; // Map user to territory for later use with stores
    
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
          `ℹ️  User "${userData.fullName}" already exists`
        );

        // Get full user data including FullName
        const fullUserData = await pool
          .request()
          .input("Id", sql.Int, existingUser.recordset[0].Id)
          .query("SELECT * FROM Users WHERE Id = @Id");

        createdUsers.push(fullUserData.recordset[0]);
        userTerritoryMap[fullUserData.recordset[0].Id] = territoryId;
        continue;
      }

      const username = userData.fullName
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[()]/g, "");
      const hashedPassword = await bcrypt.hash("123456", 10);
      const userCode = await User.generateUserCode();

      const user = await User.create({
        Username: username,
        Password: hashedPassword,
        FullName: userData.fullName,
        Email: `${username}@example.com`,
        Phone: "0123456789",
        Role: "user",
        IsChangePassword: 1
      });

      createdUsers.push(user);
      userTerritoryMap[user.Id] = territoryId;
      console.log(`✅ Created user: ${userData.fullName}`);
    }

    // Create stores and assign to users (with TerritoryId from assigned user)
    const createdStores = [];
    for (let storeIndex = 0; storeIndex < sampleStores.length; storeIndex++) {
      const storeData = sampleStores[storeIndex];
      // Check if store already exists
      const existingStore = await pool
        .request()
        .input("StoreName", sql.NVarChar(200), storeData.name)
        .query("SELECT Id FROM Stores WHERE StoreName = @StoreName");

      let store;
      if (existingStore.recordset.length > 0) {
        store = existingStore.recordset[0];
        // Update existing store with Rank, TaxCode, PartnerName if they are NULL
        const updateResult = await pool
          .request()
          .input("StoreId", sql.Int, store.Id)
          .input("Rank", sql.Int, storeData.name.includes("VLXD") ? 1 : 2)
          .input("TaxCode", sql.VarChar(50), storeData.name.includes("VLXD") 
            ? `010${String(storeIndex + 1).padStart(7, '0')}${(storeIndex % 10)}`
            : `020${String(storeIndex + 1).padStart(7, '0')}${(storeIndex % 10)}`)
          .input("PartnerName", sql.NVarChar(200), storeData.name.includes("VLXD")
            ? `Công ty TNHH ${storeData.name}`
            : `Ông/Bà ${storeData.name}`)
          .query(`
            UPDATE Stores 
            SET Rank = @Rank, TaxCode = @TaxCode, PartnerName = @PartnerName, UpdatedAt = GETDATE()
            WHERE Id = @StoreId AND (Rank IS NULL OR TaxCode IS NULL OR PartnerName IS NULL)
          `);
      } else {
        // Store will be created without TerritoryId first, then updated when assigned to user
        const storeCode = await Store.generateStoreCode();
        const result = await pool
          .request()
          .input("StoreCode", sql.VarChar(50), storeCode)
          .input("StoreName", sql.NVarChar(200), storeData.name)
          .input("Address", sql.NVarChar(500), storeData.address)
          .input("Phone", sql.VarChar(20), "0123456789")
          .input("Email", sql.NVarChar(200), `${storeCode}@example.com`)
          .input("Latitude", sql.Decimal(10, 8), storeData.lat || 10.762622)
          .input("Longitude", sql.Decimal(11, 8), storeData.lon || 106.660172)
          // Add Rank, TaxCode, PartnerName for sample data
          // Rank: 1 for stores with "VLXD" in name (Đơn vị, tổ chức), 2 for others (Cá nhân)
          .input("Rank", sql.Int, storeData.name.includes("VLXD") ? 1 : 2)
          .input("TaxCode", sql.VarChar(50), storeData.name.includes("VLXD") 
            ? `010${String(storeIndex + 1).padStart(7, '0')}${(storeIndex % 10)}`
            : `020${String(storeIndex + 1).padStart(7, '0')}${(storeIndex % 10)}`)
          .input("PartnerName", sql.NVarChar(200), storeData.name.includes("VLXD")
            ? `Công ty TNHH ${storeData.name}`
            : `Ông/Bà ${storeData.name}`)
          .query(`
            INSERT INTO Stores (StoreCode, StoreName, Address, Phone, Email, Latitude, Longitude, Rank, TaxCode, PartnerName, CreatedAt, UpdatedAt)
            OUTPUT INSERTED.*
            VALUES (@StoreCode, @StoreName, @Address, @Phone, @Email, @Latitude, @Longitude, @Rank, @TaxCode, @PartnerName, GETDATE(), GETDATE())
          `);
        store = result.recordset[0];
        console.log(`✅ Created store: ${storeData.name}`);
      }

      createdStores.push(store);
    }

    // Assign stores to users - User 1 gets first 12 stores, User 2 gets next 8 stores
    // Also assign TerritoryId to stores based on the assigned user's territory
    const user1StoresToAssign = createdStores.slice(0, 12);
    const user2StoresToAssign = createdStores.slice(12, 20);
    const user1TerritoryId = userTerritoryMap[createdUsers[0].Id];
    const user2TerritoryId = userTerritoryMap[createdUsers[1].Id];

    for (const store of user1StoresToAssign) {
      await pool
        .request()
        .input("StoreId", sql.Int, store.Id)
        .input("UserId", sql.Int, createdUsers[0].Id)
        .input("TerritoryId", sql.Int, user1TerritoryId)
        .query("UPDATE Stores SET UserId = @UserId, TerritoryId = @TerritoryId WHERE Id = @StoreId");
      // Update UserId and TerritoryId in the array
      store.UserId = createdUsers[0].Id;
      store.TerritoryId = user1TerritoryId;
    }

    for (const store of user2StoresToAssign) {
      await pool
        .request()
        .input("StoreId", sql.Int, store.Id)
        .input("UserId", sql.Int, createdUsers[1].Id)
        .input("TerritoryId", sql.Int, user2TerritoryId)
        .query("UPDATE Stores SET UserId = @UserId, TerritoryId = @TerritoryId WHERE Id = @StoreId");
      // Update UserId and TerritoryId in the array
      store.UserId = createdUsers[1].Id;
      store.TerritoryId = user2TerritoryId;
    }

    console.log(`\n📸 Creating audits and images for test users...`);
    console.log(
      `   👤 Active users: ${createdUsers[0].FullName}, ${createdUsers[1].FullName}`
    );
    console.log(
      `   🏪 User 1 stores: ${user1StoresToAssign.length}, User 2 stores: ${user2StoresToAssign.length}`
    );

    // Create audits with images for first 2 users (LÂM TẤT TOẠI and NGUYỄN PHƯƠNG SƠN)
    const activeUsers = createdUsers.slice(0, 2);
    const dates = [
      new Date("2025-11-01"),
      new Date("2025-11-02"),
      new Date("2025-11-03"),
      new Date("2025-11-04"),
      new Date("2025-11-05"),
      new Date("2025-11-06"),
      new Date("2025-11-07"),
    ];

    // Notes variations
    const notesVariations = [
      "Checkin thành công",
      "Cửa hàng hoạt động bình thường",
      "Đã kiểm tra hàng hóa",
      "Cửa hàng đầy đủ sản phẩm",
      "Đã chụp ảnh minh chứng",
      "Kiểm tra định kỳ",
      "Cửa hàng sạch sẽ, gọn gàng",
    ];

    // User 1: LÂM TẤT TOẠI - Visit each store only once, spread across 7 days
    const user1StoreList = user1StoresToAssign; // Use the stores we just assigned

    // Shuffle stores to randomize order
    const shuffledUser1Stores = [...user1StoreList].sort(
      () => Math.random() - 0.5
    );

    console.log(
      `   📝 Creating ${shuffledUser1Stores.length} audits for ${activeUsers[0].FullName}...`
    );
    let auditCount1 = 0;
    for (
      let storeIndex = 0;
      storeIndex < shuffledUser1Stores.length;
      storeIndex++
    ) {
      const store = shuffledUser1Stores[storeIndex];
      const storeData =
        sampleStores.find((s) => s.name === store.StoreName) || sampleStores[0];

      // Distribute stores across 7 days
      const dayIndex = storeIndex % 7;
      const auditDate = dates[dayIndex];

      // Different checkin times: 8 AM to 5 PM
      const hourOffset = 8 + (storeIndex % 8);
      const minuteOffset = (storeIndex * 7) % 60;
      const capturedAt = new Date(
        auditDate.getTime() +
          hourOffset * 60 * 60 * 1000 +
          minuteOffset * 60 * 1000
      );

      try {
        const audit = await Audit.create({
          UserId: activeUsers[0].Id,
          StoreId: store.Id,
          Result: "pass",
          Notes: notesVariations[storeIndex % notesVariations.length],
          AuditDate: auditDate,
        });

        // Create image for audit with watermark using store's coordinates
        // NOTE: This is only for test data. Real uploads will come from mobile app frontend
        const imageUrl = await uploadSampleImageWithWatermark(
          storeData.lat || store.Latitude || 10.762622,
          storeData.lon || store.Longitude || 106.660172,
          capturedAt
        );

        await Image.create({
          AuditId: audit.Id,
          ImageUrl: imageUrl,
          ReferenceImageUrl: null,
          Latitude: storeData.lat || store.Latitude || 10.762622,
          Longitude: storeData.lon || store.Longitude || 106.660172,
          CapturedAt: capturedAt,
        });

        auditCount1++;
      } catch (error) {
        console.error(
          `   ❌ Error creating audit for store ${store.StoreName}:`,
          error.message
        );
      }
    }
    console.log(
      `   ✅ Created ${auditCount1} audits with images for ${activeUsers[0].FullName}`
    );

    // User 2: NGUYỄN PHƯƠNG SƠN - Visit each store only once, spread across 7 days
    const user2StoreList = user2StoresToAssign; // Use the stores we just assigned

    // Shuffle stores to randomize order
    const shuffledUser2Stores = [...user2StoreList].sort(
      () => Math.random() - 0.5
    );

    console.log(
      `   📝 Creating ${shuffledUser2Stores.length} audits for ${activeUsers[1].FullName}...`
    );
    let auditCount2 = 0;
    for (
      let storeIndex = 0;
      storeIndex < shuffledUser2Stores.length;
      storeIndex++
    ) {
      const store = shuffledUser2Stores[storeIndex];
      const storeData =
        sampleStores.find((s) => s.name === store.StoreName) ||
        sampleStores[12];

      // Distribute stores across 7 days
      const dayIndex = storeIndex % 7;
      const auditDate = dates[dayIndex];

      // Different checkin times: 7 AM to 6 PM
      const hourOffset = 7 + (storeIndex % 11);
      const minuteOffset = (storeIndex * 5) % 60;
      const capturedAt = new Date(
        auditDate.getTime() +
          hourOffset * 60 * 60 * 1000 +
          minuteOffset * 60 * 1000
      );

      try {
        const audit = await Audit.create({
          UserId: activeUsers[1].Id,
          StoreId: store.Id,
          Result: "pass",
          Notes: notesVariations[storeIndex % notesVariations.length],
          AuditDate: auditDate,
        });

        // Create image for audit with watermark using store's coordinates
        // NOTE: This is only for test data. Real uploads will come from mobile app frontend
        const imageUrl = await uploadSampleImageWithWatermark(
          storeData.lat || store.Latitude || 10.762622,
          storeData.lon || store.Longitude || 106.660172,
          capturedAt
        );

        await Image.create({
          AuditId: audit.Id,
          ImageUrl: imageUrl,
          ReferenceImageUrl: null,
          Latitude: storeData.lat || store.Latitude || 10.762622,
          Longitude: storeData.lon || store.Longitude || 106.660172,
          CapturedAt: capturedAt,
        });

        auditCount2++;
      } catch (error) {
        console.error(
          `   ❌ Error creating audit for store ${store.StoreName}:`,
          error.message
        );
      }
    }
    console.log(
      `   ✅ Created ${auditCount2} audits with images for ${activeUsers[1].FullName}`
    );

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
