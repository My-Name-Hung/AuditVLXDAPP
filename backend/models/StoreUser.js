const { getPool, sql } = require('../config/database');

class StoreUser {
  /**
   * Check if a user is assigned to a store
   * @param {number} userId - User ID
   * @param {number} storeId - Store ID
   * @returns {Promise<boolean>}
   */
  static async isUserAssignedToStore(userId, storeId) {
    const pool = await getPool();
    const request = pool.request();
    request.input('UserId', sql.Int, userId);
    request.input('StoreId', sql.Int, storeId);

    const result = await request.query(`
      SELECT COUNT(*) as Count
      FROM StoreUsers
      WHERE UserId = @UserId AND StoreId = @StoreId
    `);

    return result.recordset[0].Count > 0;
  }

  /**
   * Check if user can audit store (either assigned in StoreUsers or is the primary user in Stores.UserId)
   * @param {number} userId - User ID
   * @param {number} storeId - Store ID
   * @returns {Promise<boolean>}
   */
  static async canUserAuditStore(userId, storeId) {
    const pool = await getPool();
    const request = pool.request();
    request.input('UserId', sql.Int, userId);
    request.input('StoreId', sql.Int, storeId);

    const result = await request.query(`
      SELECT 
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM StoreUsers 
            WHERE UserId = @UserId AND StoreId = @StoreId
          ) THEN 1
          WHEN EXISTS (
            SELECT 1 FROM Stores 
            WHERE Id = @StoreId AND UserId = @UserId
            AND NOT EXISTS (
              SELECT 1 FROM StoreUsers WHERE StoreId = @StoreId
            )
          ) THEN 1
          ELSE 0
        END as CanAudit
    `);

    return result.recordset[0].CanAudit === 1;
  }

  /**
   * Get all users assigned to a store
   * @param {number} storeId - Store ID
   * @returns {Promise<Array>}
   */
  static async getUsersByStoreId(storeId) {
    const pool = await getPool();
    const request = pool.request();
    request.input('StoreId', sql.Int, storeId);

    const result = await request.query(`
      SELECT 
        su.Id,
        su.StoreId,
        su.UserId,
        su.CreatedAt,
        u.FullName,
        u.UserCode,
        u.Username,
        u.Email,
        u.Phone,
        u.Role,
        u.Position
      FROM StoreUsers su
      INNER JOIN Users u ON su.UserId = u.Id
      WHERE su.StoreId = @StoreId
      ORDER BY su.CreatedAt ASC
    `);

    return result.recordset;
  }

  /**
   * Get all stores assigned to a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>}
   */
  static async getStoresByUserId(userId) {
    const pool = await getPool();
    const request = pool.request();
    request.input('UserId', sql.Int, userId);

    const result = await request.query(`
      SELECT 
        su.Id,
        su.StoreId,
        su.UserId,
        su.CreatedAt,
        s.StoreCode,
        s.StoreName,
        s.Address,
        s.Status
      FROM StoreUsers su
      INNER JOIN Stores s ON su.StoreId = s.Id
      WHERE su.UserId = @UserId
      ORDER BY su.CreatedAt ASC
    `);

    return result.recordset;
  }

  /**
   * Assign users to a store (replace all existing assignments)
   * @param {number} storeId - Store ID
   * @param {Array<number>} userIds - Array of User IDs
   * @returns {Promise<Array>}
   */
  static async assignUsersToStore(storeId, userIds) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      // Delete existing assignments
      const deleteRequest = new sql.Request(transaction);
      deleteRequest.input('StoreId', sql.Int, storeId);
      await deleteRequest.query('DELETE FROM StoreUsers WHERE StoreId = @StoreId');

      // Insert new assignments
      const assignments = [];
      for (const userId of userIds) {
        if (!userId) continue; // Skip null/undefined

        const insertRequest = new sql.Request(transaction);
        insertRequest.input('StoreId', sql.Int, storeId);
        insertRequest.input('UserId', sql.Int, userId);

        const result = await insertRequest.query(`
          INSERT INTO StoreUsers (StoreId, UserId, CreatedAt)
          OUTPUT INSERTED.*
          VALUES (@StoreId, @UserId, GETDATE())
        `);

        assignments.push(result.recordset[0]);
      }

      await transaction.commit();
      return assignments;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Add a single user to a store (if not already assigned)
   * @param {number} storeId - Store ID
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>}
   */
  static async addUserToStore(storeId, userId) {
    const pool = await getPool();
    const request = pool.request();
    request.input('StoreId', sql.Int, storeId);
    request.input('UserId', sql.Int, userId);

    try {
      const result = await request.query(`
        INSERT INTO StoreUsers (StoreId, UserId, CreatedAt)
        OUTPUT INSERTED.*
        VALUES (@StoreId, @UserId, GETDATE())
      `);

      return result.recordset[0] || null;
    } catch (error) {
      // If duplicate, return null (user already assigned)
      if (error.number === 2627) { // Unique constraint violation
        return null;
      }
      throw error;
    }
  }

  /**
   * Remove a user from a store
   * @param {number} storeId - Store ID
   * @param {number} userId - User ID
   * @returns {Promise<boolean>}
   */
  static async removeUserFromStore(storeId, userId) {
    const pool = await getPool();
    const request = pool.request();
    request.input('StoreId', sql.Int, storeId);
    request.input('UserId', sql.Int, userId);

    const result = await request.query(`
      DELETE FROM StoreUsers
      WHERE StoreId = @StoreId AND UserId = @UserId
    `);

    return result.rowsAffected[0] > 0;
  }

  /**
   * Sync Stores.UserId to StoreUsers (for backward compatibility)
   * Call this after creating/updating a store with UserId
   * @param {number} storeId - Store ID
   * @param {number|null} userId - User ID (can be null)
   * @returns {Promise<void>}
   */
  static async syncPrimaryUser(storeId, userId) {
    if (!userId) {
      // If UserId is null, don't sync (keep existing StoreUsers assignments)
      return;
    }

    const pool = await getPool();
    const request = pool.request();
    request.input('StoreId', sql.Int, storeId);
    request.input('UserId', sql.Int, userId);

    // Check if StoreUsers is empty for this store
    const checkRequest = pool.request();
    checkRequest.input('StoreId', sql.Int, storeId);
    const checkResult = await checkRequest.query(`
      SELECT COUNT(*) as Count
      FROM StoreUsers
      WHERE StoreId = @StoreId
    `);

    // Only sync if StoreUsers is empty (backward compatibility)
    if (checkResult.recordset[0].Count === 0) {
      try {
        await request.query(`
          INSERT INTO StoreUsers (StoreId, UserId, CreatedAt)
          VALUES (@StoreId, @UserId, GETDATE())
        `);
      } catch (error) {
        // Ignore duplicate key errors
        if (error.number !== 2627) {
          throw error;
        }
      }
    }
  }
}

module.exports = StoreUser;

