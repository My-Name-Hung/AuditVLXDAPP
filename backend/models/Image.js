const { getPool, sql } = require('../config/database');

class Image {
  static async create(imageData) {
    const pool = await getPool();
    const { AuditId, ImageUrl, ReferenceImageUrl, Latitude, Longitude, CapturedAt } = imageData;

    const request = pool.request();
    request.input('AuditId', sql.Int, AuditId);
    request.input('ImageUrl', sql.NVarChar(500), ImageUrl);
    request.input('ReferenceImageUrl', sql.NVarChar(500), ReferenceImageUrl);
    request.input('Latitude', sql.Decimal(10, 8), Latitude);
    request.input('Longitude', sql.Decimal(11, 8), Longitude);
    request.input('CapturedAt', sql.DateTime, CapturedAt || new Date());

    const result = await request.query(`
      INSERT INTO Images (AuditId, ImageUrl, ReferenceImageUrl, Latitude, Longitude, CapturedAt, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.*
      VALUES (@AuditId, @ImageUrl, @ReferenceImageUrl, @Latitude, @Longitude, @CapturedAt, GETDATE(), GETDATE())
    `);

    return result.recordset[0];
  }

  static async findByAuditId(auditId) {
    const pool = await getPool();
    const request = pool.request();
    request.input('AuditId', sql.Int, auditId);

    const result = await request.query(`
      SELECT * FROM Images WHERE AuditId = @AuditId
      ORDER BY CapturedAt DESC
    `);

    return result.recordset;
  }

  static async findById(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input('Id', sql.Int, id);

    const result = await request.query(`
      SELECT * FROM Images WHERE Id = @Id
    `);

    return result.recordset[0];
  }
}

module.exports = Image;

