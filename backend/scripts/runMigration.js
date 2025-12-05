const { getPool, sql } = require('../config/database');

async function runMigration() {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    console.log('Starting migration: Update NewProductImportQuantity to NVARCHAR...');
    
    // Step 1: Add temporary column
    console.log('Step 1: Adding temporary column...');
    await transaction.request().query(`
      ALTER TABLE StoreSurveys
      ADD NewProductImportQuantity_temp NVARCHAR(500) NULL;
    `);

    // Step 2: Convert existing DECIMAL values to NVARCHAR
    console.log('Step 2: Converting existing values...');
    await transaction.request().query(`
      UPDATE StoreSurveys
      SET NewProductImportQuantity_temp = 
          CASE 
              WHEN NewProductImportQuantity IS NOT NULL 
              THEN CAST(CAST(NewProductImportQuantity AS DECIMAL(18,2)) AS NVARCHAR(500))
              ELSE NULL
          END;
    `);

    // Step 3: Drop the old DECIMAL column
    console.log('Step 3: Dropping old column...');
    await transaction.request().query(`
      ALTER TABLE StoreSurveys
      DROP COLUMN NewProductImportQuantity;
    `);

    // Step 4: Rename the temporary column
    console.log('Step 4: Renaming temporary column...');
    await transaction.request().query(`
      EXEC sp_rename 'StoreSurveys.NewProductImportQuantity_temp', 'NewProductImportQuantity', 'COLUMN';
    `);

    await transaction.commit();
    console.log('✅ Migration completed successfully!');
    console.log('NewProductImportQuantity column is now NVARCHAR(500).');
    
    process.exit(0);
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    await pool.close();
  }
}

runMigration();

