/**
 * Helper functions for managing store status
 * This module provides utilities to calculate and update store status
 * based on audit and image data
 */

const Store = require("../models/Store");
const { getPool } = require("../config/database");
/**
 * Recalculate and update a store's status based on its latest audit.
 * Priority is determined by the most recent audit entry for the store.
 *
 * @param {number} storeId
 * @returns {Promise<Object>}
 */
async function updateStoreStatusFromData(storeId) {
  return Store.refreshStatusFromLatest(storeId);
}

/**
 * Update status for all stores in the database
 * Useful for batch updates or after data migration
 *
 * @returns {Promise<Object>} - Summary of updates
 */
async function updateAllStoreStatuses() {
  const pool = await getPool();

  // Get all stores
  const storesResult = await pool.request().query(`
    SELECT Id FROM Stores
  `);

  const stores = storesResult.recordset;
  let updated = 0;
  let errors = 0;

  for (const store of stores) {
    try {
      await updateStoreStatusFromData(store.Id);
      updated++;
    } catch (error) {
      console.error(`Error updating store ${store.Id}:`, error);
      errors++;
    }
  }

  return {
    total: stores.length,
    updated,
    errors,
  };
}

module.exports = {
  updateStoreStatusFromData,
  updateAllStoreStatuses,
};
