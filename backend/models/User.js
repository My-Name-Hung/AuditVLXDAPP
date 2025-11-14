const { getPool, sql } = require('../config/database');

class User {
  static async create(userData) {
    const pool = await getPool();
    const { Username, Password, FullName, Email, Phone, Role = 'user', IsChangePassword = 0 } = userData;

    // Generate UserCode
    const userCode = await this.generateUserCode();

    const request = pool.request();
    request.input('UserCode', sql.VarChar(50), userCode);
    request.input('Username', sql.NVarChar(100), Username);
    request.input('Password', sql.NVarChar(255), Password);
    request.input('FullName', sql.NVarChar(200), FullName);
    request.input('Email', sql.NVarChar(200), Email);
    request.input('Phone', sql.VarChar(20), Phone);
    request.input('Role', sql.VarChar(50), Role);
    request.input('IsChangePassword', sql.Bit, IsChangePassword);

    const result = await request.query(`
      INSERT INTO Users (UserCode, Username, Password, FullName, Email, Phone, Role, IsChangePassword, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.*
      VALUES (@UserCode, @Username, @Password, @FullName, @Email, @Phone, @Role, @IsChangePassword, GETDATE(), GETDATE())
    `);

    return result.recordset[0];
  }

  static async findByUsername(username) {
    const pool = await getPool();
    const request = pool.request();
    request.input('Username', sql.NVarChar(100), username);

    const result = await request.query(`
      SELECT * FROM Users WHERE Username = @Username
    `);

    return result.recordset[0];
  }

  static async findById(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input('Id', sql.Int, id);

    const result = await request.query(`
      SELECT * FROM Users WHERE Id = @Id
    `);

    return result.recordset[0];
  }

  static async findAll() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT Id, UserCode, Username, FullName, Email, Phone, Role, IsChangePassword, CreatedAt, UpdatedAt
      FROM Users
      ORDER BY CreatedAt DESC
    `);

    return result.recordset;
  }

  static async updatePassword(userId, newPassword) {
    const pool = await getPool();
    const request = pool.request();
    request.input('Id', sql.Int, userId);
    request.input('Password', sql.NVarChar(255), newPassword);

    const result = await request.query(`
      UPDATE Users 
      SET Password = @Password, IsChangePassword = 0, UpdatedAt = GETDATE()
      WHERE Id = @Id
      OUTPUT INSERTED.*
    `);

    return result.recordset[0];
  }

  static async generateUserCode() {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 1 UserCode 
      FROM Users 
      WHERE UserCode LIKE 'U%' 
      ORDER BY UserCode DESC
    `);

    if (result.recordset.length === 0) {
      return 'U000001';
    }

    const lastCode = result.recordset[0].UserCode;
    const number = parseInt(lastCode.substring(1)) + 1;
    return `U${number.toString().padStart(6, '0')}`;
  }
}

module.exports = User;

