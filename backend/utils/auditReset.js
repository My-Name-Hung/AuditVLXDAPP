const { getPool, sql } = require("../config/database");

/**
 * Delete every audit record (and cascading images) and reset all stores.
 * This function ONLY deletes data from Audits and Images tables.
 * Other tables (Users, Stores, Territories, StoreUsers, ImportHistory) are NOT affected.
 */
const resetAllStoreAudits = async () => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    const request = new sql.Request(transaction);

    // Count images before deletion for logging
    const imagesCountResult = await request.query(`
      SELECT COUNT(*) as ImageCount FROM Images;
    `);
    const imagesDeleted = imagesCountResult.recordset[0]?.ImageCount || 0;

    // Delete all audits - Images will be automatically deleted due to CASCADE DELETE
    // This ensures ONLY Audits and Images are deleted, no other tables are affected
    const auditDeleteResult = await request.query(`
      DELETE FROM Audits;
    `);

    const auditsDeleted = auditDeleteResult.rowsAffected?.[0] || 0;

    // Reset store statuses (only update, NOT delete)
    // This ensures Stores data is preserved, only status is reset
    const storeUpdateResult = await request.query(`
      UPDATE Stores
      SET Status = 'not_audited',
          FailedReason = NULL,
          UpdatedAt = GETDATE();
    `);

    const storesUpdated = storeUpdateResult.rowsAffected?.[0] || 0;

    await transaction.commit();

    return { auditsDeleted, imagesDeleted, storesUpdated };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Delete audit records (and cascading images) for a specific store
 * and reset its status.
 * This function ONLY deletes data from Audits and Images tables for the specified store.
 * Other tables are NOT affected.
 * @param {number} storeId
 */
const resetStoreAuditById = async (storeId) => {
  if (!storeId) {
    throw new Error("storeId is required to reset audits");
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    const request = new sql.Request(transaction);
    request.input("StoreId", sql.Int, storeId);

    // Count images before deletion for logging
    const imagesCountResult = await request.query(`
      SELECT COUNT(*) as ImageCount 
      FROM Images i
      INNER JOIN Audits a ON i.AuditId = a.Id
      WHERE a.StoreId = @StoreId;
    `);
    const imagesDeleted = imagesCountResult.recordset[0]?.ImageCount || 0;

    // Delete audits for this store - Images will be automatically deleted due to CASCADE DELETE
    // This ensures ONLY Audits and Images are deleted, no other tables are affected
    const auditDeleteResult = await request.query(`
      DELETE FROM Audits
      WHERE StoreId = @StoreId;
    `);

    const auditsDeleted = auditDeleteResult.rowsAffected?.[0] || 0;

    // Reset store status (only update, NOT delete)
    // This ensures Store data is preserved, only status is reset
    const storeUpdateResult = await request.query(`
      UPDATE Stores
      SET Status = 'not_audited',
          FailedReason = NULL,
          UpdatedAt = GETDATE()
      WHERE Id = @StoreId;
    `);

    const storesUpdated = storeUpdateResult.rowsAffected?.[0] || 0;

    await transaction.commit();

    return { auditsDeleted, imagesDeleted, storesUpdated };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  resetAllStoreAudits,
  resetStoreAuditById,
};
