const { getPool, sql } = require('../config/database');

class CementProduct {
  static async findAll(filters = {}) {
    const pool = await getPool();
    let query = `
      SELECT * FROM CementProducts
      WHERE 1=1
    `;

    const request = pool.request();

    if (filters.search) {
      query += ' AND (Code LIKE @Search OR Name LIKE @Search)';
      request.input('Search', sql.NVarChar(500), `%${filters.search}%`);
    }

    query += ' ORDER BY Code ASC';

    const result = await request.query(query);
    return result.recordset;
  }

  static async findById(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input('Id', sql.Int, id);

    const result = await request.query(`
      SELECT * FROM CementProducts WHERE Id = @Id
    `);

    return result.recordset[0];
  }

  static async findByCode(code) {
    const pool = await getPool();
    const request = pool.request();
    request.input('Code', sql.VarChar(50), code);

    const result = await request.query(`
      SELECT * FROM CementProducts WHERE Code = @Code
    `);

    return result.recordset[0];
  }

  static async create(cementProductData) {
    const pool = await getPool();
    const { Code, Name } = cementProductData;

    const request = pool.request();
    request.input('Code', sql.VarChar(50), Code);
    request.input('Name', sql.NVarChar(500), Name);

    const result = await request.query(`
      INSERT INTO CementProducts (Code, Name, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.*
      VALUES (@Code, @Name, GETDATE(), GETDATE())
    `);

    return result.recordset[0];
  }

  static async update(id, cementProductData) {
    const pool = await getPool();
    const { Code, Name } = cementProductData;

    const request = pool.request();
    request.input('Id', sql.Int, id);
    request.input('Code', sql.VarChar(50), Code);
    request.input('Name', sql.NVarChar(500), Name);

    const result = await request.query(`
      UPDATE CementProducts
      SET Code = @Code,
          Name = @Name,
          UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE Id = @Id
    `);

    return result.recordset[0];
  }

  static async delete(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input('Id', sql.Int, id);

    await request.query(`
      DELETE FROM CementProducts WHERE Id = @Id
    `);

    return true;
  }

  static async bulkCreate(cementProducts) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();
      const request = new sql.Request(transaction);

      const inserted = [];

      for (const product of cementProducts) {
        request.input('Code', sql.VarChar(50), product.Code);
        request.input('Name', sql.NVarChar(500), product.Name);

        const result = await request.query(`
          IF NOT EXISTS (SELECT 1 FROM CementProducts WHERE Code = @Code)
          BEGIN
            INSERT INTO CementProducts (Code, Name, CreatedAt, UpdatedAt)
            OUTPUT INSERTED.*
            VALUES (@Code, @Name, GETDATE(), GETDATE())
          END
        `);

        if (result.recordset.length > 0) {
          inserted.push(result.recordset[0]);
        }
      }

      await transaction.commit();
      return inserted;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = CementProduct;

