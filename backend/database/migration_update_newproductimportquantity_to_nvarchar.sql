-- Migration: Update NewProductImportQuantity from DECIMAL to NVARCHAR
-- Date: 2025-01-XX
-- Description: Change NewProductImportQuantity column type from DECIMAL(18,2) to NVARCHAR(500)
--              to support both text and numbers in the field
-- 
-- IMPORTANT: Run this migration script on your SQL Server database before deploying the updated code.
-- This script will convert existing numeric values to strings and allow new text+number combinations.
-- This script is idempotent and can be run multiple times safely.

-- Check current column type
DECLARE @CurrentDataType NVARCHAR(50);
SELECT @CurrentDataType = DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'StoreSurveys' 
    AND COLUMN_NAME = 'NewProductImportQuantity';

-- If column doesn't exist, create it as NVARCHAR
IF @CurrentDataType IS NULL
BEGIN
    PRINT 'Column NewProductImportQuantity does not exist. Creating as NVARCHAR(500)...';
    ALTER TABLE StoreSurveys
    ADD NewProductImportQuantity NVARCHAR(500) NULL;
    PRINT 'Column created successfully.';
END
-- If already NVARCHAR, skip migration
ELSE IF @CurrentDataType = 'nvarchar'
BEGIN
    PRINT 'Column NewProductImportQuantity is already NVARCHAR. No migration needed.';
END
-- If DECIMAL, perform migration
ELSE IF @CurrentDataType = 'decimal' OR @CurrentDataType = 'numeric'
BEGIN
    PRINT 'Starting migration from DECIMAL to NVARCHAR...';
    
    -- Check if temp column already exists (from previous failed migration)
    DECLARE @TempColumnExists BIT = 0;
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'StoreSurveys' 
            AND COLUMN_NAME = 'NewProductImportQuantity_temp'
    )
    BEGIN
        SET @TempColumnExists = 1;
        PRINT 'Found temp column from previous migration. Will clean it up first.';
    END
    
    -- Full migration process (DDL statements work better outside transactions)
    BEGIN TRY
        -- Step 1: Clean up temp column if it exists
        IF @TempColumnExists = 1
        BEGIN
            PRINT 'Step 0: Cleaning up previous temp column...';
            ALTER TABLE StoreSurveys DROP COLUMN NewProductImportQuantity_temp;
            PRINT '  ✅ Temp column removed.';
        END

        -- Step 2: Add temporary column to store converted values
        PRINT 'Step 1: Adding temporary column...';
        ALTER TABLE StoreSurveys
        ADD NewProductImportQuantity_temp NVARCHAR(500) NULL;
        PRINT '  ✅ Temp column added.';

        -- Verify temp column exists and force metadata refresh
        IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'StoreSurveys' 
                AND COLUMN_NAME = 'NewProductImportQuantity_temp'
        )
        BEGIN
            RAISERROR('Failed to create temp column. Cannot proceed.', 16, 1);
            RETURN;
        END

        -- Step 3: Convert existing DECIMAL values to NVARCHAR (preserve numeric values as strings)
        -- Use dynamic SQL to force SQL Server to recognize the new column
        PRINT 'Step 2: Converting existing values...';
        DECLARE @RowCount INT;
        DECLARE @UpdateSQL NVARCHAR(MAX);
        
        -- Build dynamic SQL - this forces SQL Server to compile after column creation
        SET @UpdateSQL = N'
        UPDATE StoreSurveys
        SET NewProductImportQuantity_temp = 
            CASE 
                WHEN NewProductImportQuantity IS NOT NULL 
                THEN CAST(CAST(NewProductImportQuantity AS DECIMAL(18,2)) AS NVARCHAR(500))
                ELSE NULL
            END;
        SET @RowCountOut = @@ROWCOUNT;';
        
        DECLARE @RowCountOut INT;
        EXEC sp_executesql @UpdateSQL, N'@RowCountOut INT OUTPUT', @RowCountOut = @RowCountOut OUTPUT;
        SET @RowCount = @RowCountOut;
        PRINT '  ✅ Converted ' + CAST(@RowCount AS NVARCHAR(10)) + ' row(s).';

        -- Step 4: Drop the old DECIMAL column
        PRINT 'Step 3: Dropping old DECIMAL column...';
        ALTER TABLE StoreSurveys
        DROP COLUMN NewProductImportQuantity;
        PRINT '  ✅ Old column dropped.';

        -- Step 5: Rename the temporary column to the original name
        PRINT 'Step 4: Renaming temporary column...';
        EXEC sp_rename 'StoreSurveys.NewProductImportQuantity_temp', 'NewProductImportQuantity', 'COLUMN';
        PRINT '  ✅ Column renamed.';

        PRINT '';
        PRINT '✅ Migration completed successfully!';
        PRINT 'NewProductImportQuantity is now NVARCHAR(500).';

    END TRY
    BEGIN CATCH
        PRINT '';
        PRINT '❌ Migration failed.';
        PRINT 'Error: ' + ERROR_MESSAGE();
        PRINT 'Error Number: ' + CAST(ERROR_NUMBER() AS NVARCHAR(10));
        PRINT 'Error Line: ' + CAST(ERROR_LINE() AS NVARCHAR(10));
        
        -- Clean up temp column if it exists
        IF EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'StoreSurveys' 
                AND COLUMN_NAME = 'NewProductImportQuantity_temp'
        )
        BEGIN
            BEGIN TRY
                PRINT '';
                PRINT 'Attempting to clean up temp column...';
                ALTER TABLE StoreSurveys DROP COLUMN NewProductImportQuantity_temp;
                PRINT '  ✅ Temp column cleaned up.';
            END TRY
            BEGIN CATCH
                PRINT '  ⚠️  Could not clean up temp column: ' + ERROR_MESSAGE();
            END CATCH
        END
        
        -- Use RAISERROR instead of THROW for better compatibility
        RAISERROR('Migration failed. See error messages above.', 16, 1);
    END CATCH
END
ELSE
BEGIN
    PRINT 'Unexpected column type: ' + @CurrentDataType + '. Migration skipped.';
END

-- Verification query
PRINT '';
PRINT 'Verification:';
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'StoreSurveys' 
    AND COLUMN_NAME = 'NewProductImportQuantity';

