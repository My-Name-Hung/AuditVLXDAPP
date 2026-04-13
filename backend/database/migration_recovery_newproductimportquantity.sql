-- Recovery Script: Fix NewProductImportQuantity column after failed migration
-- Use this script if the migration failed and left the database in an inconsistent state
-- This script will check the current state and fix it

PRINT '=== Recovery Script for NewProductImportQuantity Column ===';
PRINT '';

-- Check current state
DECLARE @OriginalColumnExists BIT = 0;
DECLARE @TempColumnExists BIT = 0;
DECLARE @OriginalDataType NVARCHAR(50);
DECLARE @TempDataType NVARCHAR(50);

SELECT @OriginalColumnExists = CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END,
       @OriginalDataType = MAX(DATA_TYPE)
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'StoreSurveys' 
    AND COLUMN_NAME = 'NewProductImportQuantity';

SELECT @TempColumnExists = CASE WHEN COUNT(*) > 0 THEN 1 ELSE 0 END,
       @TempDataType = MAX(DATA_TYPE)
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'StoreSurveys' 
    AND COLUMN_NAME = 'NewProductImportQuantity_temp';

PRINT 'Current State:';
PRINT '  Original column (NewProductImportQuantity): ' + 
    CASE WHEN @OriginalColumnExists = 1 THEN 'EXISTS (' + @OriginalDataType + ')' ELSE 'NOT EXISTS' END;
PRINT '  Temp column (NewProductImportQuantity_temp): ' + 
    CASE WHEN @TempColumnExists = 1 THEN 'EXISTS (' + @TempDataType + ')' ELSE 'NOT EXISTS' END;
PRINT '';

-- Scenario 1: Both columns exist - rename temp to original and drop original
IF @OriginalColumnExists = 1 AND @TempColumnExists = 1
BEGIN
    PRINT 'Scenario 1: Both columns exist.';
    PRINT 'Recovery: Renaming temp column to original, then dropping old original...';
    
    BEGIN TRANSACTION;
    BEGIN TRY
        -- Drop original column first
        ALTER TABLE StoreSurveys DROP COLUMN NewProductImportQuantity;
        PRINT '  ✅ Dropped original column.';
        
        -- Rename temp to original
        EXEC sp_rename 'StoreSurveys.NewProductImportQuantity_temp', 'NewProductImportQuantity', 'COLUMN';
        PRINT '  ✅ Renamed temp column to original.';
        
        COMMIT TRANSACTION;
        PRINT '';
        PRINT '✅ Recovery completed successfully!';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        PRINT '❌ Recovery failed: ' + ERROR_MESSAGE();
        RAISERROR('Recovery failed. See error messages above.', 16, 1);
    END CATCH
END
-- Scenario 2: Only temp column exists - rename it to original
ELSE IF @OriginalColumnExists = 0 AND @TempColumnExists = 1
BEGIN
    PRINT 'Scenario 2: Only temp column exists (original was dropped).';
    PRINT 'Recovery: Renaming temp column to original...';
    
    BEGIN TRY
        EXEC sp_rename 'StoreSurveys.NewProductImportQuantity_temp', 'NewProductImportQuantity', 'COLUMN';
        PRINT '  ✅ Renamed temp column to original.';
        PRINT '';
        PRINT '✅ Recovery completed successfully!';
    END TRY
    BEGIN CATCH
        PRINT '❌ Recovery failed: ' + ERROR_MESSAGE();
        RAISERROR('Recovery failed. See error messages above.', 16, 1);
    END CATCH
END
-- Scenario 3: Only original exists (DECIMAL) - need to run full migration
ELSE IF @OriginalColumnExists = 1 AND @TempColumnExists = 0 AND (@OriginalDataType = 'decimal' OR @OriginalDataType = 'numeric')
BEGIN
    PRINT 'Scenario 3: Only original DECIMAL column exists.';
    PRINT 'Recovery: Running full migration...';
    PRINT '';
    PRINT 'Please run the main migration script: migration_update_newproductimportquantity_to_nvarchar.sql';
END
-- Scenario 4: Only original exists (NVARCHAR) - already correct
ELSE IF @OriginalColumnExists = 1 AND @TempColumnExists = 0 AND @OriginalDataType = 'nvarchar'
BEGIN
    PRINT 'Scenario 4: Column is already NVARCHAR. No recovery needed.';
    PRINT '✅ Database is in correct state.';
END
-- Scenario 5: Neither column exists - create it
ELSE IF @OriginalColumnExists = 0 AND @TempColumnExists = 0
BEGIN
    PRINT 'Scenario 5: Neither column exists.';
    PRINT 'Recovery: Creating column as NVARCHAR(500)...';
    
    BEGIN TRY
        ALTER TABLE StoreSurveys
        ADD NewProductImportQuantity NVARCHAR(500) NULL;
        PRINT '  ✅ Column created successfully.';
        PRINT '';
        PRINT '✅ Recovery completed successfully!';
    END TRY
    BEGIN CATCH
        PRINT '❌ Recovery failed: ' + ERROR_MESSAGE();
        RAISERROR('Recovery failed. See error messages above.', 16, 1);
    END CATCH
END
ELSE
BEGIN
    PRINT '⚠️  Unexpected state. Please check manually.';
    PRINT 'Original: ' + CAST(@OriginalColumnExists AS NVARCHAR(1)) + ' (' + ISNULL(@OriginalDataType, 'N/A') + ')';
    PRINT 'Temp: ' + CAST(@TempColumnExists AS NVARCHAR(1)) + ' (' + ISNULL(@TempDataType, 'N/A') + ')';
END

-- Final verification
PRINT '';
PRINT '=== Final Verification ===';
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'StoreSurveys' 
    AND COLUMN_NAME IN ('NewProductImportQuantity', 'NewProductImportQuantity_temp')
ORDER BY COLUMN_NAME;

