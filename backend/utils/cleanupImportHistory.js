const { getPool, sql } = require('../config/database');

/**
 * Cleanup import history older than 2 days
 * This function should be called periodically (e.g., via cron job or scheduled task)
 */
async function cleanupImportHistory() {
  try {
    const pool = await getPool();
    const request = pool.request();
    
    // Delete import history older than 2 days
    const result = await request.query(`
      DELETE FROM ImportHistory
      WHERE CreatedAt < DATEADD(DAY, -2, GETDATE())
    `);
    
    const deletedCount = result.rowsAffected[0];
    console.log(`Cleaned up ${deletedCount} import history records older than 2 days`);
    
    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up import history:', error);
    throw error;
  }
}

module.exports = {
  cleanupImportHistory,
};

