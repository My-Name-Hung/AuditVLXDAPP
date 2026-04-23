require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { getPool, sql } = require('../config/database');

async function updateWorkPosition() {
  const pool = await getPool();

  try {
    console.log('=== Migration: Add WorkPosition column to Users ===\n');

    // Step 1: Check if column already exists
    console.log('Step 1: Checking if WorkPosition column exists...');
    const checkResult = await pool.request().query(`
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'Users'
        AND COLUMN_NAME = 'WorkPosition'
    `);

    if (checkResult.recordset.length === 0) {
      console.log('  → Adding WorkPosition column (NVARCHAR(200) NULL)...');
      await pool.request().query(`
        ALTER TABLE Users ADD WorkPosition NVARCHAR(200) NULL;
      `);
      console.log('  ✅ Column WorkPosition added.\n');
    } else {
      console.log('  ⏭  Column WorkPosition already exists. Skipping ADD.\n');
    }

    // Step 2: Update all existing users with default value
    console.log('Step 2: Updating WorkPosition for all existing users...');
    const updateResult = await pool.request().query(`
      UPDATE Users
      SET WorkPosition = N'Công ty Xi Măng Tây Đô',
          UpdatedAt = GETDATE()
      WHERE WorkPosition IS NULL
         OR LTRIM(RTRIM(WorkPosition)) = '';
    `);
    console.log(`  ✅ Updated ${updateResult.rowsAffected[0]} users.\n`);

    // Step 3: Preview results
    console.log('Step 3: Preview results (top 10 most recent users)...');
    const preview = await pool.request().query(`
      SELECT TOP 10
          Id,
          UserCode,
          FullName,
          Position       AS ChucVu,
          WorkPosition   AS ViTriCongTac
      FROM Users
      ORDER BY Id DESC;
    `);

    console.log(
      '  ' +
        ['Id', 'UserCode', 'FullName', 'ChucVu', 'ViTriCongTac'].join(
          ' | '
        ) +
        '\n  ' +
        '-'.repeat(100)
    );
    preview.recordset.forEach((row) => {
      const fullName = (row.FullName || '').padEnd(20).substring(0, 20);
      const position = (row.ChucVu || '').padEnd(15).substring(0, 15);
      const workPos = (row.WorkPosition || '').padEnd(30).substring(0, 30);
      console.log(
        `  ${String(row.Id).padStart(3)} | ${String(row.UserCode || '').padEnd(10)} | ${fullName} | ${position} | ${workPos}`
      );
    });

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    await pool.close();
  }
}

updateWorkPosition();
