const { getPool, sql } = require('../config/database');

class Territory {
  static async findAll() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT * FROM Territories
      ORDER BY TerritoryName ASC
    `);
    return result.recordset;
  }

  static async findById(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input('Id', sql.Int, id);
    const result = await request.query(`
      SELECT * FROM Territories WHERE Id = @Id
    `);
    return result.recordset[0];
  }

  static async findByName(name) {
    const pool = await getPool();
    const request = pool.request();
    request.input('TerritoryName', sql.NVarChar(200), name);
    const result = await request.query(`
      SELECT * FROM Territories WHERE TerritoryName = @TerritoryName
    `);
    return result.recordset[0];
  }

  static async create(territoryName) {
    const pool = await getPool();
    const request = pool.request();
    request.input('TerritoryName', sql.NVarChar(200), territoryName);

    const result = await request.query(`
      INSERT INTO Territories (TerritoryName, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.*
      VALUES (@TerritoryName, GETDATE(), GETDATE())
    `);

    return result.recordset[0];
  }
}

module.exports = Territory;

