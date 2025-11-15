/**
 * Helper functions for managing store status
 * This module provides utilities to calculate and update store status
 * based on audit and image data
 */

const Store = require('../models/Store');
const { getPool, sql } = require('../config/database');

/**
 * Calculate the appropriate status for a store based on its audits and images
 * Priority: passed/failed > audited > not_audited
 * 
 * @param {number} storeId - The ID of the store
 * @returns {Promise<string>} - The calculated status
 */
async function calculateStoreStatus(storeId) {
  const pool = await getPool();
  const request = pool.request();
  request.input('StoreId', sql.Int, storeId);

  // Check if store has any audits with pass result
  const passResult = await request.query(`
    SELECT TOP 1 1
    FROM Audits
    WHERE StoreId = @StoreId AND Result = 'pass'
  `);

  if (passResult.recordset.length > 0) {
    return 'passed';
  }

  // Check if store has any audits with fail result
  const failResult = await request.query(`
    SELECT TOP 1 1
    FROM Audits
    WHERE StoreId = @StoreId AND Result = 'fail'
  `);

  if (failResult.recordset.length > 0) {
    return 'failed';
  }

  // Check if store has audits with images
  const auditedResult = await request.query(`
    SELECT TOP 1 1
    FROM Audits a
    INNER JOIN Images i ON a.Id = i.AuditId
    WHERE a.StoreId = @StoreId
  `);

  if (auditedResult.recordset.length > 0) {
    return 'audited';
  }

  // Default: not_audited
  return 'not_audited';
}

/**
 * Update store status based on its audits and images
 * This function recalculates and updates the status
 * 
 * @param {number} storeId - The ID of the store
 * @returns {Promise<Object>} - The updated store object
 */
async function updateStoreStatusFromData(storeId) {
  const status = await calculateStoreStatus(storeId);
  return await Store.updateStatus(storeId, status);
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
    errors
  };
}

module.exports = {
  calculateStoreStatus,
  updateStoreStatusFromData,
  updateAllStoreStatuses
};

