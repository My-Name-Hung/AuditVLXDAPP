const ExcelJS = require("exceljs");
const Store = require("../models/Store");
const User = require("../models/User");
const Territory = require("../models/Territory");
const { getPool, sql } = require("../config/database");

// Import Stores from Excel
const importStores = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Excel file is required" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      return res.status(400).json({ error: "Excel file is empty" });
    }

    const results = {
      success: [],
      errors: [],
      total: 0,
      successCount: 0,
      errorCount: 0,
    };

    // Get all territories and users for mapping
    const territories = await Territory.findAll();
    const usersResult = await User.findAll({ limit: 10000, offset: 0 }); // Get all users
    const users = Array.isArray(usersResult) ? usersResult : [];

    const territoryMap = {};
    territories.forEach((t) => {
      if (t.TerritoryName) {
        territoryMap[t.TerritoryName.toLowerCase().trim()] = t.Id;
      }
    });

    const userMap = {};
    users.forEach((u) => {
      if (u.FullName) {
        userMap[u.FullName.toLowerCase().trim()] = u.Id;
      }
      if (u.UserCode) {
        userMap[u.UserCode.toLowerCase().trim()] = u.Id;
      }
      if (u.Username) {
        userMap[u.Username.toLowerCase().trim()] = u.Id;
      }
    });

    // Read all rows first to validate and prepare data
    const rowsData = [];
    worksheet.eachRow((row, rowIndex) => {
      if (rowIndex === 1) return; // Skip header

      const rowData = {
        rowNumber: rowIndex,
        storeName: row.getCell(1)?.value?.toString()?.trim(),
        address: row.getCell(2)?.value?.toString()?.trim(),
        phone: row.getCell(3)?.value?.toString()?.trim() || null,
        email: row.getCell(4)?.value?.toString()?.trim() || null,
        rank: row.getCell(5)?.value ? parseInt(row.getCell(5).value) : null,
        taxCode: row.getCell(6)?.value?.toString()?.trim() || null,
        partnerName: row.getCell(7)?.value?.toString()?.trim() || null,
        territoryName: row.getCell(8)?.value?.toString()?.trim() || null,
        userName: row.getCell(9)?.value?.toString()?.trim() || null,
        notes: row.getCell(10)?.value?.toString()?.trim() || null,
      };

      results.total++;
      rowsData.push(rowData);
    });

    // Validate all rows first
    const validRows = [];
    for (const rowData of rowsData) {
      // Validate required fields
      if (!rowData.storeName || !rowData.address) {
        results.errors.push({
          row: rowData.rowNumber,
          storeName: rowData.storeName || "",
          error: "Tên cửa hàng và Địa chỉ là bắt buộc",
        });
        results.errorCount++;
        continue;
      }

      // Validate rank
      if (rowData.rank && ![1, 2].includes(rowData.rank)) {
        results.errors.push({
          row: rowData.rowNumber,
          storeName: rowData.storeName,
          error: "Cấp cửa hàng phải là 1 hoặc 2",
        });
        results.errorCount++;
        continue;
      }

      // Map territory
      let territoryId = null;
      if (rowData.territoryName) {
        const territoryKey = rowData.territoryName.toLowerCase().trim();
        territoryId = territoryMap[territoryKey];
        if (!territoryId) {
          results.errors.push({
            row: rowData.rowNumber,
            storeName: rowData.storeName,
            error: `Không tìm thấy địa bàn phụ trách: "${rowData.territoryName}". Vui lòng kiểm tra lại tên địa bàn trong file Excel.`,
          });
          results.errorCount++;
          continue;
        }
      }

      // Map user (support FullName, UserCode, or Username)
      let userId = null;
      if (rowData.userName) {
        const userKey = rowData.userName.toLowerCase().trim();
        userId = userMap[userKey];
        if (!userId) {
          results.errors.push({
            row: rowData.rowNumber,
            storeName: rowData.storeName,
            error: `Không tìm thấy nhân viên: "${rowData.userName}". Vui lòng kiểm tra lại tên nhân viên, mã nhân viên (UserCode) hoặc tên đăng nhập (Username) trong file Excel.`,
          });
          results.errorCount++;
          continue;
        }
      }

      validRows.push({ ...rowData, territoryId, userId });
    }

    // Generate all StoreCodes at once to avoid race condition
    const storeCodes = await Store.generateMultipleStoreCodes(validRows.length);

    // Create stores sequentially to avoid duplicate StoreCode
    for (let i = 0; i < validRows.length; i++) {
      const rowData = validRows[i];
      const storeCode = storeCodes[i];

      try {
        // Create store with pre-generated StoreCode
        const pool = await getPool();
        const request = pool.request();
        request.input("StoreCode", sql.VarChar(50), storeCode);
        request.input("StoreName", sql.NVarChar(200), rowData.storeName);
        request.input("Address", sql.NVarChar(500), rowData.address);
        request.input("Phone", sql.VarChar(20), rowData.phone);
        request.input("Email", sql.NVarChar(200), rowData.email);
        request.input("Status", sql.VarChar(20), "not_audited");
        
        if (rowData.rank !== undefined && rowData.rank !== null) {
          request.input("Rank", sql.Int, rowData.rank);
        }
        if (rowData.taxCode) {
          request.input("TaxCode", sql.VarChar(50), rowData.taxCode);
        }
        if (rowData.partnerName) {
          request.input("PartnerName", sql.NVarChar(200), rowData.partnerName);
        }
        if (rowData.territoryId) {
          request.input("TerritoryId", sql.Int, rowData.territoryId);
        }
        if (rowData.userId) {
          request.input("UserId", sql.Int, rowData.userId);
        }

        let query = `
          INSERT INTO Stores (StoreCode, StoreName, Address, Phone, Email, Status`;
        let values = `@StoreCode, @StoreName, @Address, @Phone, @Email, @Status`;
        
        if (rowData.rank !== undefined && rowData.rank !== null) {
          query += `, Rank`;
          values += `, @Rank`;
        }
        if (rowData.taxCode) {
          query += `, TaxCode`;
          values += `, @TaxCode`;
        }
        if (rowData.partnerName) {
          query += `, PartnerName`;
          values += `, @PartnerName`;
        }
        if (rowData.territoryId) {
          query += `, TerritoryId`;
          values += `, @TerritoryId`;
        }
        if (rowData.userId) {
          query += `, UserId`;
          values += `, @UserId`;
        }

        query += `, CreatedAt, UpdatedAt)
          OUTPUT INSERTED.*
          VALUES (${values}, GETDATE(), GETDATE())`;

        const result = await request.query(query);
        const createdStore = result.recordset[0];

        // Auto-generate and update Link after store is created
        if (createdStore && createdStore.Id) {
          const link = `https://ximang.netlify.app/stores/${createdStore.Id}`;
          const updateRequest = pool.request();
          updateRequest.input('Id', sql.Int, createdStore.Id);
          updateRequest.input('Link', sql.NVarChar(500), link);
          
          await updateRequest.query(`
            UPDATE Stores 
            SET Link = @Link 
            WHERE Id = @Id
          `);
          
          createdStore.Link = link;
        }

        results.success.push({
          row: rowData.rowNumber,
          storeName: createdStore.StoreName,
          storeCode: createdStore.StoreCode,
          link: createdStore.Link,
        });
        results.successCount++;
      } catch (error) {
        results.errors.push({
          row: rowData.rowNumber,
          storeName: rowData.storeName,
          error: error.message || "Lỗi khi tạo cửa hàng",
        });
        results.errorCount++;
      }
    }

    // Save import history
    const pool = await getPool();
    const historyRequest = pool.request();
    historyRequest.input("Type", sql.VarChar(50), "stores");
    historyRequest.input("Total", sql.Int, results.total);
    historyRequest.input("SuccessCount", sql.Int, results.successCount);
    historyRequest.input("ErrorCount", sql.Int, results.errorCount);
    historyRequest.input("UserId", sql.Int, req.user.id);

    await historyRequest.query(`
      INSERT INTO ImportHistory (Type, Total, SuccessCount, ErrorCount, UserId, CreatedAt)
      VALUES (@Type, @Total, @SuccessCount, @ErrorCount, @UserId, GETDATE())
    `);

    res.json({
      message: "Import completed",
      results,
    });
  } catch (error) {
    console.error("Import stores error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Import Users from Excel
const importUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Excel file is required" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      return res.status(400).json({ error: "Excel file is empty" });
    }

    const results = {
      success: [],
      errors: [],
      total: 0,
      successCount: 0,
      errorCount: 0,
    };

    // Read all rows first to validate and prepare data
    const rowsData = [];
    worksheet.eachRow((row, rowIndex) => {
      if (rowIndex === 1) return; // Skip header

      const rowData = {
        rowNumber: rowIndex,
        username: row.getCell(1)?.value?.toString()?.trim(),
        fullName: row.getCell(2)?.value?.toString()?.trim(),
        email: row.getCell(3)?.value?.toString()?.trim() || null,
        phone: row.getCell(4)?.value?.toString()?.trim() || null,
        role:
          row.getCell(5)?.value?.toString()?.trim()?.toLowerCase() || "sales",
      };

      results.total++;
      rowsData.push(rowData);
    });

    // Validate all rows first
    const validRows = [];
    for (const rowData of rowsData) {
      // Validate required fields
      if (!rowData.username || !rowData.fullName) {
        results.errors.push({
          row: rowData.rowNumber,
          username: rowData.username || "",
          error: "Tên đăng nhập và Tên nhân viên là bắt buộc",
        });
        results.errorCount++;
        continue;
      }

      // Validate role
      if (!["admin", "sales"].includes(rowData.role)) {
        results.errors.push({
          row: rowData.rowNumber,
          username: rowData.username,
          error: "Vai trò phải là admin hoặc sales",
        });
        results.errorCount++;
        continue;
      }

      validRows.push(rowData);
    }

    // Generate all UserCodes at once to avoid race condition
    const userCodes = await User.generateMultipleUserCodes(validRows.length);

    // Create users sequentially to avoid duplicate UserCode
    for (let i = 0; i < validRows.length; i++) {
      const rowData = validRows[i];
      const userCode = userCodes[i];

      try {
        // Create user with pre-generated UserCode
        const pool = await getPool();
        const request = pool.request();
        request.input('UserCode', sql.VarChar(50), userCode);
        request.input('Username', sql.NVarChar(100), rowData.username);
        request.input('Password', sql.NVarChar(255), require("bcryptjs").hashSync("123456", 10));
        request.input('FullName', sql.NVarChar(200), rowData.fullName);
        request.input('Email', sql.NVarChar(200), rowData.email);
        request.input('Phone', sql.VarChar(20), rowData.phone);
        request.input('Role', sql.VarChar(50), rowData.role);
        request.input('IsChangePassword', sql.Bit, true);

        const result = await request.query(`
          INSERT INTO Users (UserCode, Username, Password, FullName, Email, Phone, Role, IsChangePassword, CreatedAt, UpdatedAt)
          OUTPUT INSERTED.*
          VALUES (@UserCode, @Username, @Password, @FullName, @Email, @Phone, @Role, @IsChangePassword, GETDATE(), GETDATE())
        `);

        const createdUser = result.recordset[0];
        results.success.push({
          row: rowData.rowNumber,
          username: createdUser.Username,
          userCode: createdUser.UserCode,
          fullName: createdUser.FullName,
        });
        results.successCount++;
      } catch (error) {
        let errorMessage = "Lỗi khi tạo nhân viên";
        if (error.message && (error.message.includes("already exists") || error.message.includes("UNIQUE"))) {
          errorMessage = "Tên đăng nhập đã tồn tại";
        } else {
          errorMessage = error.message || "Lỗi khi tạo nhân viên";
        }
        results.errors.push({
          row: rowData.rowNumber,
          username: rowData.username,
          error: errorMessage,
        });
        results.errorCount++;
      }
    }

    // Save import history
    const pool = await getPool();
    const historyRequest = pool.request();
    historyRequest.input("Type", sql.VarChar(50), "users");
    historyRequest.input("Total", sql.Int, results.total);
    historyRequest.input("SuccessCount", sql.Int, results.successCount);
    historyRequest.input("ErrorCount", sql.Int, results.errorCount);
    historyRequest.input("UserId", sql.Int, req.user.id);

    await historyRequest.query(`
      INSERT INTO ImportHistory (Type, Total, SuccessCount, ErrorCount, UserId, CreatedAt)
      VALUES (@Type, @Total, @SuccessCount, @ErrorCount, @UserId, GETDATE())
    `);

    res.json({
      message: "Import completed",
      results,
    });
  } catch (error) {
    console.error("Import users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get Import History
const getImportHistory = async (req, res) => {
  try {
    const { type } = req.query; // 'stores' or 'users'

    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT 
        ih.*,
        u.FullName as UserFullName,
        u.UserCode
      FROM ImportHistory ih
      LEFT JOIN Users u ON ih.UserId = u.Id
      WHERE 1=1
    `;

    if (type) {
      request.input("Type", sql.VarChar(50), type);
      query += " AND ih.Type = @Type";
    }

    query += " ORDER BY ih.CreatedAt DESC";

    const result = await request.query(query);

    res.json(result.recordset);
  } catch (error) {
    console.error("Get import history error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  importStores,
  importUsers,
  getImportHistory,
};
