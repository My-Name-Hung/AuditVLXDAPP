// Load .env FIRST before any other imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { getPool, sql } = require('../config/database');

async function runMigration() {
  const pool = await getPool();

  try {
    console.log('🔍 Checking current Phone column type...');

    // Check current column type
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Stores' AND COLUMN_NAME = 'Phone'
    `);

    const currentType = result.recordset[0];
    if (!currentType) {
      console.error('❌ Phone column not found in Stores table.');
      process.exit(1);
    }
    console.log(`   Current: ${currentType.DATA_TYPE}(${currentType.CHARACTER_MAXIMUM_LENGTH})`);

    if (currentType.DATA_TYPE === 'nvarchar' && currentType.CHARACTER_MAXIMUM_LENGTH >= 100) {
      console.log('✅ Phone column is already NVARCHAR(100) or larger. No changes needed.');
      process.exit(0);
    }

    console.log('🚀 Running migration: Update Stores.Phone to NVARCHAR(100)...');

    await pool.request().query(`
      ALTER TABLE Stores
      ALTER COLUMN Phone NVARCHAR(100) NULL;
    `);

    console.log('✅ Migration completed successfully!');
    console.log('   Phone column is now NVARCHAR(100) - supports up to 3 phone numbers separated by spaces.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.originalError) {
      console.error('   DB Error:', error.originalError.message);
    }
    process.exit(1);
  } finally {
    await pool.close();
  }
}

runMigration();
