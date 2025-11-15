const ExcelJS = require('exceljs');
const Store = require('../models/Store');
const User = require('../models/User');
const Territory = require('../models/Territory');
const { getPool, sql } = require('../config/database');

// Import Stores from Excel
const importStores = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Excel file is required' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      return res.status(400).json({ error: 'Excel file is empty' });
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
    const users = await User.findAll({ limit: 10000, offset: 0 }); // Get all users

    const territoryMap = {};
    territories.forEach(t => {
      territoryMap[t.TerritoryName?.toLowerCase()] = t.Id;
    });

    const userMap = {};
    users.forEach(u => {
      userMap[u.FullName?.toLowerCase()] = u.Id;
      userMap[u.UserCode?.toLowerCase()] = u.Id;
    });

    // Read rows (skip header row)
    let rowNumber = 1;
    worksheet.eachRow((row, rowIndex) => {
      if (rowIndex === 1) return; // Skip header

      rowNumber = rowIndex;
      const rowData = {
        rowNumber,
        storeName: row.getCell(1)?.value?.toString()?.trim(),
        address: row.getCell(2)?.value?.toString()?.trim(),
        phone: row.getCell(3)?.value?.toString()?.trim() || null,
        email: row.getCell(4)?.value?.toString()?.trim() || null,
        rank: row.getCell(5)?.value ? parseInt(row.getCell(5).value) : null,
        taxCode: row.getCell(6)?.value?.toString()?.trim() || null,
        partnerName: row.getCell(7)?.value?.toString()?.trim() || null,
        territoryName: row.getCell(8)?.value?.toString()?.trim() || null,
        userName: row.getCell(9)?.value?.toString()?.trim() || null,
      };

      results.total++;

      // Validate required fields
      if (!rowData.storeName || !rowData.address) {
        results.errors.push({
          row: rowNumber,
          storeName: rowData.storeName || '',
          error: 'Tên cửa hàng và Địa chỉ là bắt buộc',
        });
        results.errorCount++;
        return;
      }

      // Validate rank
      if (rowData.rank && ![1, 2].includes(rowData.rank)) {
        results.errors.push({
          row: rowNumber,
          storeName: rowData.storeName,
          error: 'Cấp cửa hàng phải là 1 hoặc 2',
        });
        results.errorCount++;
        return;
      }

      // Map territory
      let territoryId = null;
      if (rowData.territoryName) {
        territoryId = territoryMap[rowData.territoryName.toLowerCase()];
        if (!territoryId) {
          results.errors.push({
            row: rowNumber,
            storeName: rowData.storeName,
            error: `Không tìm thấy địa bàn: ${rowData.territoryName}`,
          });
          results.errorCount++;
          return;
        }
      }

      // Map user
      let userId = null;
      if (rowData.userName) {
        userId = userMap[rowData.userName.toLowerCase()];
        if (!userId) {
          results.errors.push({
            row: rowNumber,
            storeName: rowData.storeName,
            error: `Không tìm thấy nhân viên: ${rowData.userName}`,
          });
          results.errorCount++;
          return;
        }
      }

      // Create store promise
      const createPromise = Store.create({
        StoreName: rowData.storeName,
        Address: rowData.address,
        Phone: rowData.phone,
        Email: rowData.email,
        Rank: rowData.rank,
        TaxCode: rowData.taxCode,
        PartnerName: rowData.partnerName,
        TerritoryId: territoryId,
        UserId: userId,
        Status: 'not_audited',
        // Latitude and Longitude will be null - auto updated from mobile app
      })
        .then((store) => {
          results.success.push({
            row: rowNumber,
            storeName: store.StoreName,
            storeCode: store.StoreCode,
            link: store.Link,
          });
          results.successCount++;
        })
        .catch((error) => {
          results.errors.push({
            row: rowNumber,
            storeName: rowData.storeName,
            error: error.message || 'Lỗi khi tạo cửa hàng',
          });
          results.errorCount++;
        });
      
      promises.push(createPromise);
    });

    // Wait for all async operations to complete
    await Promise.all(promises);

    // Save import history
    const pool = await getPool();
    const historyRequest = pool.request();
    historyRequest.input('Type', sql.VarChar(50), 'stores');
    historyRequest.input('Total', sql.Int, results.total);
    historyRequest.input('SuccessCount', sql.Int, results.successCount);
    historyRequest.input('ErrorCount', sql.Int, results.errorCount);
    historyRequest.input('UserId', sql.Int, req.user.id);

    await historyRequest.query(`
      INSERT INTO ImportHistory (Type, Total, SuccessCount, ErrorCount, UserId, CreatedAt)
      VALUES (@Type, @Total, @SuccessCount, @ErrorCount, @UserId, GETDATE())
    `);

    res.json({
      message: 'Import completed',
      results,
    });
  } catch (error) {
    console.error('Import stores error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Import Users from Excel
const importUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Excel file is required' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.getWorksheet(1);

    if (!worksheet) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }

    const results = {
      success: [],
      errors: [],
      total: 0,
      successCount: 0,
      errorCount: 0,
    };

    // Read rows (skip header row)
    let rowNumber = 1;
    worksheet.eachRow((row, rowIndex) => {
      if (rowIndex === 1) return; // Skip header

      rowNumber = rowIndex;
      const rowData = {
        rowNumber,
        username: row.getCell(1)?.value?.toString()?.trim(),
        fullName: row.getCell(2)?.value?.toString()?.trim(),
        email: row.getCell(3)?.value?.toString()?.trim() || null,
        phone: row.getCell(4)?.value?.toString()?.trim() || null,
        role: row.getCell(5)?.value?.toString()?.trim()?.toLowerCase() || 'sales',
      };

      results.total++;

      // Validate required fields
      if (!rowData.username || !rowData.fullName) {
        results.errors.push({
          row: rowNumber,
          username: rowData.username || '',
          error: 'Tên đăng nhập và Tên nhân viên là bắt buộc',
        });
        results.errorCount++;
        return;
      }

      // Validate role
      if (!['admin', 'sales'].includes(rowData.role)) {
        results.errors.push({
          row: rowNumber,
          username: rowData.username,
          error: 'Vai trò phải là admin hoặc sales',
        });
        results.errorCount++;
        return;
      }

      // Create user with default password promise
      const createPromise = User.create({
        Username: rowData.username,
        Password: require('bcryptjs').hashSync('123456', 10), // Default password
        FullName: rowData.fullName,
        Email: rowData.email,
        Phone: rowData.phone,
        Role: rowData.role,
        IsChangePassword: true,
      })
        .then((user) => {
          results.success.push({
            row: rowNumber,
            username: user.Username,
            userCode: user.UserCode,
            fullName: user.FullName,
          });
          results.successCount++;
        })
        .catch((error) => {
          let errorMessage = 'Lỗi khi tạo nhân viên';
          if (error.message && error.message.includes('already exists')) {
            errorMessage = 'Tên đăng nhập đã tồn tại';
          }
          results.errors.push({
            row: rowNumber,
            username: rowData.username,
            error: errorMessage,
          });
          results.errorCount++;
        });
      
      promises.push(createPromise);
    });

    // Wait for all async operations to complete
    await Promise.all(promises);

    // Save import history
    const pool = await getPool();
    const historyRequest = pool.request();
    historyRequest.input('Type', sql.VarChar(50), 'users');
    historyRequest.input('Total', sql.Int, results.total);
    historyRequest.input('SuccessCount', sql.Int, results.successCount);
    historyRequest.input('ErrorCount', sql.Int, results.errorCount);
    historyRequest.input('UserId', sql.Int, req.user.id);

    await historyRequest.query(`
      INSERT INTO ImportHistory (Type, Total, SuccessCount, ErrorCount, UserId, CreatedAt)
      VALUES (@Type, @Total, @SuccessCount, @ErrorCount, @UserId, GETDATE())
    `);

    res.json({
      message: 'Import completed',
      results,
    });
  } catch (error) {
    console.error('Import users error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
      request.input('Type', sql.VarChar(50), type);
      query += ' AND ih.Type = @Type';
    }

    query += ' ORDER BY ih.CreatedAt DESC';

    const result = await request.query(query);

    res.json(result.recordset);
  } catch (error) {
    console.error('Get import history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  importStores,
  importUsers,
  getImportHistory,
};

