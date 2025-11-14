const { getPool, sql } = require('../config/database');

class Store {
  static async create(storeData) {
    const pool = await getPool();
    const { StoreName, Address, Phone, Email, Latitude, Longitude } = storeData;

    // Generate StoreCode
    const storeCode = await this.generateStoreCode();

    const request = pool.request();
    request.input('StoreCode', sql.VarChar(50), storeCode);
    request.input('StoreName', sql.NVarChar(200), StoreName);
    request.input('Address', sql.NVarChar(500), Address);
    request.input('Phone', sql.VarChar(20), Phone);
    request.input('Email', sql.NVarChar(200), Email);
    request.input('Latitude', sql.Decimal(10, 8), Latitude);
    request.input('Longitude', sql.Decimal(11, 8), Longitude);

    const result = await request.query(`
      INSERT INTO Stores (StoreCode, StoreName, Address, Phone, Email, Latitude, Longitude, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.*
      VALUES (@StoreCode, @StoreName, @Address, @Phone, @Email, @Latitude, @Longitude, GETDATE(), GETDATE())
    `);

    return result.recordset[0];
  }

  static async findById(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input('Id', sql.Int, id);

    const result = await request.query(`
      SELECT * FROM Stores WHERE Id = @Id
    `);

    return result.recordset[0];
  }

  static async findAll() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT * FROM Stores
      ORDER BY CreatedAt DESC
    `);

    return result.recordset;
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
      return 'CH000001';
    }

    const lastCode = result.recordset[0].StoreCode;
    const number = parseInt(lastCode.substring(2)) + 1;
    return `CH${number.toString().padStart(6, '0')}`;
  }
}

module.exports = Store;

