const { getPool, sql } = require("../config/database");

class Store {
  static async create(storeData) {
    const pool = await getPool();
    const {
      StoreName,
      Address,
      Phone,
      Email,
      Latitude,
      Longitude,
      TerritoryId,
      UserId,
      Status,
      Rank,
      TaxCode,
      PartnerName,
      OpenDate,
    } = storeData;

    // Generate StoreCode
    const storeCode = await this.generateStoreCode();

    const request = pool.request();
    request.input("StoreCode", sql.VarChar(50), storeCode);
    request.input("StoreName", sql.NVarChar(200), StoreName);
    request.input("Address", sql.NVarChar(500), Address);
    request.input("Phone", sql.VarChar(20), Phone);
    request.input("Email", sql.NVarChar(200), Email);
    // Latitude and Longitude can be null - will be auto updated when user takes photo
    if (Latitude !== undefined && Latitude !== null) {
      request.input("Latitude", sql.Decimal(10, 8), Latitude);
    }
    if (Longitude !== undefined && Longitude !== null) {
      request.input("Longitude", sql.Decimal(11, 8), Longitude);
    }
    if (TerritoryId !== undefined && TerritoryId !== null) {
      request.input("TerritoryId", sql.Int, TerritoryId);
    }
    if (UserId !== undefined && UserId !== null) {
      request.input("UserId", sql.Int, UserId);
    }
    // Default status is 'not_audited' if not provided
    request.input("Status", sql.VarChar(20), Status || 'not_audited');
    if (Rank !== undefined && Rank !== null) {
      request.input("Rank", sql.Int, Rank);
    }
    if (TaxCode !== undefined && TaxCode !== null) {
      request.input("TaxCode", sql.VarChar(50), TaxCode);
    }
    if (PartnerName !== undefined && PartnerName !== null) {
      request.input("PartnerName", sql.NVarChar(200), PartnerName);
    }
    if (OpenDate !== undefined && OpenDate !== null) {
      request.input("OpenDate", sql.Date, OpenDate);
    }

    let query = `
      INSERT INTO Stores (StoreCode, StoreName, Address, Phone, Email, Status`;
    let values = `@StoreCode, @StoreName, @Address, @Phone, @Email, @Status`;
    
    // Add Latitude and Longitude only if provided
    if (Latitude !== undefined && Latitude !== null) {
      query += `, Latitude`;
      values += `, @Latitude`;
    }
    if (Longitude !== undefined && Longitude !== null) {
      query += `, Longitude`;
      values += `, @Longitude`;
    }

    if (TerritoryId !== undefined && TerritoryId !== null) {
      query += `, TerritoryId`;
      values += `, @TerritoryId`;
    }
    if (UserId !== undefined && UserId !== null) {
      query += `, UserId`;
      values += `, @UserId`;
    }
    if (Rank !== undefined && Rank !== null) {
      query += `, Rank`;
      values += `, @Rank`;
    }
    if (TaxCode !== undefined && TaxCode !== null) {
      query += `, TaxCode`;
      values += `, @TaxCode`;
    }
    if (PartnerName !== undefined && PartnerName !== null) {
      query += `, PartnerName`;
      values += `, @PartnerName`;
    }
    if (OpenDate !== undefined && OpenDate !== null) {
      query += `, OpenDate`;
      values += `, @OpenDate`;
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

    return createdStore;
  }

  static async findById(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input("Id", sql.Int, id);

    const result = await request.query(`
      SELECT * FROM Stores WHERE Id = @Id
    `);

    return result.recordset[0];
  }

  static async findAll(filters = {}) {
    const pool = await getPool();
    let query = `
      SELECT 
        s.*,
        t.TerritoryName,
        u.FullName as UserFullName,
        u.UserCode
      FROM Stores s
      LEFT JOIN Territories t ON s.TerritoryId = t.Id
      LEFT JOIN Users u ON s.UserId = u.Id
      WHERE 1=1
    `;
    const request = pool.request();

    if (filters.Status) {
      query += ' AND s.Status = @Status';
      request.input('Status', sql.VarChar(20), filters.Status);
    }

    if (filters.TerritoryId) {
      query += ' AND s.TerritoryId = @TerritoryId';
      request.input('TerritoryId', sql.Int, filters.TerritoryId);
    }

    if (filters.UserId) {
      query += ' AND s.UserId = @UserId';
      request.input('UserId', sql.Int, filters.UserId);
    }

    if (filters.Rank !== undefined && filters.Rank !== null) {
      query += ' AND s.Rank = @Rank';
      request.input('Rank', sql.Int, filters.Rank);
    }

    if (filters.storeName) {
      query += ' AND (s.StoreName LIKE @StoreName OR s.StoreCode LIKE @StoreName)';
      request.input('StoreName', sql.NVarChar(200), `%${filters.storeName}%`);
    }

    if (filters.userName) {
      query += ' AND u.FullName LIKE @UserName';
      request.input('UserName', sql.NVarChar(200), `%${filters.userName}%`);
    }

    query += ' ORDER BY s.StoreCode ASC';

    // Add pagination
    if (filters.limit !== undefined && filters.offset !== undefined) {
      query += ` OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY`;
      request.input('Offset', sql.Int, filters.offset);
      request.input('Limit', sql.Int, filters.limit);
    }

    // Set timeout to 60 seconds
    request.timeout = 60000;
    const result = await request.query(query);
    return result.recordset;
  }

  static async count(filters = {}) {
    const pool = await getPool();
    let query = `
      SELECT COUNT(*) as Total
      FROM Stores s
      LEFT JOIN Territories t ON s.TerritoryId = t.Id
      LEFT JOIN Users u ON s.UserId = u.Id
      WHERE 1=1
    `;
    const request = pool.request();

    if (filters.Status) {
      query += ' AND s.Status = @Status';
      request.input('Status', sql.VarChar(20), filters.Status);
    }

    if (filters.TerritoryId) {
      query += ' AND s.TerritoryId = @TerritoryId';
      request.input('TerritoryId', sql.Int, filters.TerritoryId);
    }

    if (filters.UserId) {
      query += ' AND s.UserId = @UserId';
      request.input('UserId', sql.Int, filters.UserId);
    }

    if (filters.Rank !== undefined && filters.Rank !== null) {
      query += ' AND s.Rank = @Rank';
      request.input('Rank', sql.Int, filters.Rank);
    }

    if (filters.storeName) {
      query += ' AND (s.StoreName LIKE @StoreName OR s.StoreCode LIKE @StoreName)';
      request.input('StoreName', sql.NVarChar(200), `%${filters.storeName}%`);
    }

    if (filters.userName) {
      query += ' AND u.FullName LIKE @UserName';
      request.input('UserName', sql.NVarChar(200), `%${filters.userName}%`);
    }

    // Set timeout to 60 seconds
    request.timeout = 60000;
    const result = await request.query(query);
    return result.recordset[0].Total;
  }

  static async updateStatus(storeId, status, failedReason = null) {
    const pool = await getPool();
    const request = pool.request();
    request.input('Id', sql.Int, storeId);
    request.input('Status', sql.VarChar(20), status);
    
    // If status is not 'failed', set FailedReason to NULL
    // If status is 'failed', set FailedReason to the provided value (can be null if not provided)
    if (status === 'failed') {
      request.input('FailedReason', sql.NVarChar(1000), failedReason || null);
    } else {
      request.input('FailedReason', sql.NVarChar(1000), null);
    }

    const result = await request.query(`
      UPDATE Stores 
      SET Status = @Status, 
          FailedReason = @FailedReason,
          UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE Id = @Id
    `);

    return result.recordset[0];
  }

  static async generateStoreCode() {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();
      const request = new sql.Request(transaction);
      
      // Use UPDLOCK to prevent concurrent reads
      const result = await request.query(`
        SELECT TOP 1 StoreCode 
        FROM Stores WITH (UPDLOCK, ROWLOCK)
        WHERE StoreCode LIKE 'CH%' 
        ORDER BY StoreCode DESC
      `);

      let nextNumber = 1;
      if (result.recordset.length > 0) {
        const lastCode = result.recordset[0].StoreCode;
        nextNumber = parseInt(lastCode.substring(2)) + 1;
      }

      const newCode = `CH${nextNumber.toString().padStart(6, "0")}`;
      await transaction.commit();
      return newCode;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async generateMultipleStoreCodes(count) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();
      const request = new sql.Request(transaction);
      
      // Use UPDLOCK to prevent concurrent reads
      const result = await request.query(`
        SELECT TOP 1 StoreCode 
        FROM Stores WITH (UPDLOCK, ROWLOCK)
        WHERE StoreCode LIKE 'CH%' 
        ORDER BY StoreCode DESC
      `);

      let startNumber = 1;
      if (result.recordset.length > 0) {
        const lastCode = result.recordset[0].StoreCode;
        startNumber = parseInt(lastCode.substring(2)) + 1;
      }

      const codes = [];
      for (let i = 0; i < count; i++) {
        const number = startNumber + i;
        codes.push(`CH${number.toString().padStart(6, "0")}`);
      }

      await transaction.commit();
      return codes;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = Store;
