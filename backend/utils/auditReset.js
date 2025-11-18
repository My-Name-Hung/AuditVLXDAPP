const { getPool, sql } = require("../config/database");

/**
 * Delete every audit record (and cascading images) and reset all stores.
 */
const resetAllStoreAudits = async () => {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    const request = new sql.Request(transaction);

    const auditDeleteResult = await request.query(`
      DELETE FROM Audits;
    `);

    const auditsDeleted = auditDeleteResult.rowsAffected?.[0] || 0;

    const storeUpdateResult = await request.query(`
      UPDATE Stores
      SET Status = 'not_audited',
          FailedReason = NULL,
          UpdatedAt = GETDATE();
    `);

    const storesUpdated = storeUpdateResult.rowsAffected?.[0] || 0;

    await transaction.commit();

    return { auditsDeleted, storesUpdated };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

/**
 * Delete audit records (and cascading images) for a specific store
 * and reset its status.
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

    const auditDeleteResult = await request.query(`
      DELETE FROM Audits
      WHERE StoreId = @StoreId;
    `);

    const auditsDeleted = auditDeleteResult.rowsAffected?.[0] || 0;

    const storeUpdateResult = await request.query(`
      UPDATE Stores
      SET Status = 'not_audited',
          FailedReason = NULL,
          UpdatedAt = GETDATE()
      WHERE Id = @StoreId;
    `);

    const storesUpdated = storeUpdateResult.rowsAffected?.[0] || 0;

    await transaction.commit();

    return { auditsDeleted, storesUpdated };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  resetAllStoreAudits,
  resetStoreAuditById,
};
