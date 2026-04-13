const { getPool, sql } = require('../config/database');

class Audit {
  static async create(auditData) {
    const pool = await getPool();
    const {
      UserId,
      StoreId,
      Result = "audited",
      Notes,
      AuditDate,
      FailedReason,
    } = auditData;

    const request = pool.request();
    request.input("UserId", sql.Int, UserId);
    request.input("StoreId", sql.Int, StoreId);
    request.input("Result", sql.VarChar(20), Result);
    request.input("Notes", sql.NVarChar(1000), Notes);
    request.input("AuditDate", sql.DateTime, AuditDate || new Date());
    request.input("FailedReason", sql.NVarChar(1000), FailedReason || null);

    const result = await request.query(`
      INSERT INTO Audits (UserId, StoreId, Result, Notes, AuditDate, FailedReason, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.*
      VALUES (@UserId, @StoreId, @Result, @Notes, @AuditDate, @FailedReason, GETDATE(), GETDATE())
    `);

    return result.recordset[0];
  }

  static async findById(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input('Id', sql.Int, id);

    const result = await request.query(`
      SELECT a.*, u.FullName as UserName, u.UserCode, s.StoreName, s.StoreCode
      FROM Audits a
      INNER JOIN Users u ON a.UserId = u.Id
      INNER JOIN Stores s ON a.StoreId = s.Id
      WHERE a.Id = @Id
    `);

    return result.recordset[0];
  }

  static async findAll(filters = {}) {
    const pool = await getPool();
    let query = `
      SELECT a.*, u.FullName as UserName, u.UserCode, s.StoreName, s.StoreCode
      FROM Audits a
      INNER JOIN Users u ON a.UserId = u.Id
      INNER JOIN Stores s ON a.StoreId = s.Id
      WHERE 1=1
    `;

    const request = pool.request();

    if (filters.UserId) {
      query += ' AND a.UserId = @UserId';
      request.input('UserId', sql.Int, filters.UserId);
    }

    if (filters.StoreId) {
      query += ' AND a.StoreId = @StoreId';
      request.input('StoreId', sql.Int, filters.StoreId);
    }

    if (filters.Result) {
      query += ' AND a.Result = @Result';
      request.input('Result', sql.VarChar(20), filters.Result);
    }

    query += ' ORDER BY a.CreatedAt DESC';

    const result = await request.query(query);
    return result.recordset;
  }

  static async updateResult(id, result, failedReason = null) {
    const pool = await getPool();
    const request = pool.request();
    request.input("Id", sql.Int, id);
    request.input("Result", sql.VarChar(20), result);
    request.input("FailedReason", sql.NVarChar(1000), failedReason || null);

    const resultQuery = await request.query(`
      UPDATE Audits
      SET Result = @Result,
          FailedReason = @FailedReason,
          UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE Id = @Id
    `);

    return resultQuery.recordset[0];
  }

  static async findLatestByStore(storeId) {
    const pool = await getPool();
    const request = pool.request();
    request.input("StoreId", sql.Int, storeId);

    const result = await request.query(`
      SELECT TOP 1 *
      FROM Audits
      WHERE StoreId = @StoreId
      ORDER BY AuditDate DESC, Id DESC
    `);

    return result.recordset[0] || null;
  }
}

module.exports = Audit;

