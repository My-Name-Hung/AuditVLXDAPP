const { getPool, getBackupPool, sql } = require('../config/database');

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

  /**
   * Find all audits from both DBXMTD (live) and RE_SALE_20260410 (backup),
   * with deduplication — live DB rows take precedence.
   * Only used for READ operations (dashboard, reports).
   * DO NOT use for INSERT/UPDATE/DELETE.
   */
  static async findAllDual(filters = {}) {
    const { getPool: gp, getBackupPool: gbp } = require('../config/database');
    const pool = await gp();
    const backupPool = await gbp();

    const request = pool.request();
    const backupRequest = backupPool ? backupPool.request() : null;

    let mainQuery = `
      SELECT a.Id, a.UserId, a.StoreId, a.Result, a.Notes, a.AuditDate,
             a.FailedReason, a.CreatedAt, a.UpdatedAt,
             u.FullName as UserName, u.UserCode, s.StoreName, s.StoreCode
      FROM Audits a
      INNER JOIN Users u ON a.UserId = u.Id
      INNER JOIN Stores s ON a.StoreId = s.Id
      WHERE 1=1
    `;
    let backupQuery = null;

    if (filters.UserId) {
      mainQuery += ' AND a.UserId = @UserId';
      request.input('UserId', sql.Int, filters.UserId);
      if (backupRequest) {
        backupRequest.input('UserId', sql.Int, filters.UserId);
      }
    }
    if (filters.StoreId) {
      mainQuery += ' AND a.StoreId = @StoreId';
      request.input('StoreId', sql.Int, filters.StoreId);
      if (backupRequest) {
        backupRequest.input('StoreId', sql.Int, filters.StoreId);
      }
    }
    if (filters.Result) {
      mainQuery += ' AND a.Result = @Result';
      request.input('Result', sql.VarChar(20), filters.Result);
      if (backupRequest) {
        backupRequest.input('Result', sql.VarChar(20), filters.Result);
      }
    }
    if (filters.startDate) {
      mainQuery += ' AND CAST(a.AuditDate AS DATE) >= @startDate';
      request.input('startDate', sql.Date, filters.startDate);
      if (backupRequest) {
        backupRequest.input('startDate', sql.Date, filters.startDate);
      }
    }
    if (filters.endDate) {
      mainQuery += ' AND CAST(a.AuditDate AS DATE) <= @endDate';
      request.input('endDate', sql.Date, filters.endDate);
      if (backupRequest) {
        backupRequest.input('endDate', sql.Date, filters.endDate);
      }
    }

    mainQuery += ' ORDER BY a.AuditDate DESC, a.Id DESC';

    if (backupPool) {
      backupQuery = mainQuery.replace(/FROM \[RE_SALE_20260410\]\.dbo\./g, 'FROM [RE_SALE_20260410].[dbo].');
    }

    // Run both queries in parallel
    const [mainResult, backupResult] = await Promise.all([
      request.query(mainQuery),
      backupQuery && backupRequest
        ? backupRequest.query(backupQuery)
        : Promise.resolve({ recordset: [] }),
    ]);

    // Deduplicate: main DB rows take precedence
    const seen = new Set();
    const merged = [];

    for (const row of mainResult.recordset) {
      seen.add(row.Id);
      merged.push(row);
    }
    for (const row of backupResult.recordset) {
      if (!seen.has(row.Id)) {
        merged.push(row);
      }
    }

    return merged;
  }
}

module.exports = Audit;

