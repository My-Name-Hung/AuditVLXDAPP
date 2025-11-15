/**
 * Script to update Store Status for all existing stores
 * This script calculates and updates the status based on audit and image data
 * 
 * Usage: node scripts/updateStoreStatus.js
 */

const { getPool, sql } = require('../config/database');

async function updateAllStoreStatuses() {
  try {
    console.log('🔄 Starting to update store statuses...');
    const pool = await getPool();

    // Step 1: Set all NULL statuses to 'not_audited'
    console.log('📝 Step 1: Setting NULL statuses to "not_audited"...');
    const nullUpdateResult = await pool.request().query(`
      UPDATE Stores
      SET Status = 'not_audited'
      WHERE Status IS NULL
    `);
    console.log(`✅ Updated ${nullUpdateResult.rowsAffected[0]} stores with NULL status`);

    // Step 2: Update stores with 'pass' result to 'passed' (highest priority)
    console.log('📝 Step 2: Updating stores with "pass" result to "passed"...');
    const passUpdateResult = await pool.request().query(`
      UPDATE s
      SET s.Status = 'passed'
      FROM Stores s
      INNER JOIN Audits a ON s.Id = a.StoreId
      WHERE a.Result = 'pass'
    `);
    console.log(`✅ Updated ${passUpdateResult.rowsAffected[0]} stores to "passed"`);

    // Step 3: Update stores with 'fail' result to 'failed' (highest priority)
    console.log('📝 Step 3: Updating stores with "fail" result to "failed"...');
    const failUpdateResult = await pool.request().query(`
      UPDATE s
      SET s.Status = 'failed'
      FROM Stores s
      INNER JOIN Audits a ON s.Id = a.StoreId
      WHERE a.Result = 'fail'
    `);
    console.log(`✅ Updated ${failUpdateResult.rowsAffected[0]} stores to "failed"`);

    // Step 4: Update stores with audits and images to 'audited' (if not already passed/failed)
    console.log('📝 Step 4: Updating stores with audits and images to "audited"...');
    const auditedUpdateResult = await pool.request().query(`
      UPDATE s
      SET s.Status = 'audited'
      FROM Stores s
      INNER JOIN Audits a ON s.Id = a.StoreId
      INNER JOIN Images i ON a.Id = i.AuditId
      WHERE s.Status NOT IN ('passed', 'failed')
    `);
    console.log(`✅ Updated ${auditedUpdateResult.rowsAffected[0]} stores to "audited"`);

    // Get summary
    const summaryResult = await pool.request().query(`
      SELECT Status, COUNT(*) as Count
      FROM Stores
      GROUP BY Status
      ORDER BY Status
    `);

    console.log('\n📊 Store Status Summary:');
    console.log('========================');
    summaryResult.recordset.forEach(row => {
      console.log(`  ${row.Status || 'NULL'}: ${row.Count} stores`);
    });

    console.log('\n✅ Store status update completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating store statuses:', error);
    process.exit(1);
  }
}

// Run the script
updateAllStoreStatuses();

