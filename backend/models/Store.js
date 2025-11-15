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
    } = storeData;

    // Generate StoreCode
    const storeCode = await this.generateStoreCode();

    const request = pool.request();
    request.input("StoreCode", sql.VarChar(50), storeCode);
    request.input("StoreName", sql.NVarChar(200), StoreName);
    request.input("Address", sql.NVarChar(500), Address);
    request.input("Phone", sql.VarChar(20), Phone);
    request.input("Email", sql.NVarChar(200), Email);
    request.input("Latitude", sql.Decimal(10, 8), Latitude);
    request.input("Longitude", sql.Decimal(11, 8), Longitude);
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

    let query = `
      INSERT INTO Stores (StoreCode, StoreName, Address, Phone, Email, Latitude, Longitude, Status`;
    let values = `@StoreCode, @StoreName, @Address, @Phone, @Email, @Latitude, @Longitude, @Status`;

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

    query += `, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.*
      VALUES (${values}, GETDATE(), GETDATE())`;

    const result = await request.query(query);

    return result.recordset[0];
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

    query += ' ORDER BY s.CreatedAt DESC';

    const result = await request.query(query);
    return result.recordset;
  }

  static async updateStatus(storeId, status) {
    const pool = await getPool();
    const request = pool.request();
    request.input('Id', sql.Int, storeId);
    request.input('Status', sql.VarChar(20), status);

    const result = await request.query(`
      UPDATE Stores 
      SET Status = @Status, UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE Id = @Id
    `);

    return result.recordset[0];
  }

  static async generateStoreCode() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 1 StoreCode 
      FROM Stores 
      WHERE StoreCode LIKE 'CH%' 
      ORDER BY StoreCode DESC
    `);

    if (result.recordset.length === 0) {
      return "CH000001";
    }

    const lastCode = result.recordset[0].StoreCode;
    const number = parseInt(lastCode.substring(2)) + 1;
    return `CH${number.toString().padStart(6, "0")}`;
  }
}

module.exports = Store;
