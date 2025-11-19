const { getPool, sql } = require('../config/database');

class User {
  static async create(userData) {
    const pool = await getPool();
    const {
      Username,
      Password,
      FullName,
      Email,
      Phone,
      Role = 'user',
      Position = null,
      IsChangePassword = 0
    } = userData;

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
    request.input('Position', sql.NVarChar(200), Position);
    request.input('IsChangePassword', sql.Bit, IsChangePassword);

    const result = await request.query(`
      INSERT INTO Users (UserCode, Username, Password, FullName, Email, Phone, Role, Position, IsChangePassword, CreatedAt, UpdatedAt)
      OUTPUT INSERTED.*
      VALUES (@UserCode, @Username, @Password, @FullName, @Email, @Phone, @Role, @Position, @IsChangePassword, GETDATE(), GETDATE())
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

  static async findByUsernameOrUserCode(identifier) {
    const pool = await getPool();
    const request = pool.request();
    request.input('Identifier', sql.NVarChar(100), identifier);

    const result = await request.query(`
      SELECT * FROM Users WHERE Username = @Identifier OR UserCode = @Identifier
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

  static async findAll(filters = {}) {
    const pool = await getPool();
    let query = `
      SELECT Id, UserCode, Username, FullName, Email, Phone, Role, Position, IsChangePassword, CreatedAt, UpdatedAt
      FROM Users
      WHERE 1=1
    `;
    const request = pool.request();

    // Filter by search (UserCode or FullName)
    if (filters.search) {
      query += ' AND (UserCode LIKE @Search OR FullName LIKE @Search)';
      request.input('Search', sql.NVarChar(200), `%${filters.search}%`);
    }

    // Filter by Role
    if (filters.Role) {
      query += ' AND Role = @Role';
      request.input('Role', sql.VarChar(50), filters.Role);
    }

    query += ' ORDER BY UserCode ASC';

    // Add pagination
    if (filters.limit !== undefined && filters.offset !== undefined) {
      query += ` OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY`;
      request.input('Offset', sql.Int, filters.offset);
      request.input('Limit', sql.Int, filters.limit);
    }

    const result = await request.query(query);
    return result.recordset;
  }

  static async count(filters = {}) {
    const pool = await getPool();
    let query = `
      SELECT COUNT(*) as Total
      FROM Users
      WHERE 1=1
    `;
    const request = pool.request();

    // Filter by search (UserCode or FullName)
    if (filters.search) {
      query += ' AND (UserCode LIKE @Search OR FullName LIKE @Search)';
      request.input('Search', sql.NVarChar(200), `%${filters.search}%`);
    }

    // Filter by Role
    if (filters.Role) {
      query += ' AND Role = @Role';
      request.input('Role', sql.VarChar(50), filters.Role);
    }

    const result = await request.query(query);
    return result.recordset[0].Total;
  }

  static async updatePassword(userId, newPassword) {
    const pool = await getPool();
    const request = pool.request();
    request.input('Id', sql.Int, userId);
    request.input('Password', sql.NVarChar(255), newPassword);

    // Update password
    await request.query(`
      UPDATE Users 
      SET Password = @Password, IsChangePassword = 0, UpdatedAt = GETDATE()
      WHERE Id = @Id
    `);

    // Fetch updated user
    const selectRequest = pool.request();
    selectRequest.input('Id', sql.Int, userId);
    const result = await selectRequest.query(`
      SELECT * FROM Users WHERE Id = @Id
    `);

    return result.recordset[0];
  }

  static async generateUserCode() {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();
      const request = new sql.Request(transaction);
      
      // Use UPDLOCK to prevent concurrent reads
      const result = await request.query(`
        SELECT TOP 1 UserCode 
        FROM Users WITH (UPDLOCK, ROWLOCK)
        WHERE UserCode LIKE 'U%' 
        ORDER BY UserCode DESC
      `);

      let nextNumber = 1;
      if (result.recordset.length > 0) {
        const lastCode = result.recordset[0].UserCode;
        nextNumber = parseInt(lastCode.substring(1)) + 1;
      }

      const newCode = `U${nextNumber.toString().padStart(6, '0')}`;
      await transaction.commit();
      return newCode;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async generateMultipleUserCodes(count) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();
      const request = new sql.Request(transaction);
      
      // Use UPDLOCK to prevent concurrent reads
      const result = await request.query(`
        SELECT TOP 1 UserCode 
        FROM Users WITH (UPDLOCK, ROWLOCK)
        WHERE UserCode LIKE 'U%' 
        ORDER BY UserCode DESC
      `);

      let startNumber = 1;
      if (result.recordset.length > 0) {
        const lastCode = result.recordset[0].UserCode;
        startNumber = parseInt(lastCode.substring(1)) + 1;
      }

      const codes = [];
      for (let i = 0; i < count; i++) {
        const number = startNumber + i;
        codes.push(`U${number.toString().padStart(6, '0')}`);
      }

      await transaction.commit();
      return codes;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = User;

