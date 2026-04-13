-- Migration: Update NewProductImportQuantity from DECIMAL to NVARCHAR
-- Version 2: Simplified version that works better with SQL Server batch parsing
-- 
-- IMPORTANT: This script uses GO statements to separate batches.
-- Run this entire script in SSMS or SQLCMD.

-- Check current column type
DECLARE @CurrentDataType NVARCHAR(50);
SELECT @CurrentDataType = DATA_TYPE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'StoreSurveys' 
    AND COLUMN_NAME = 'NewProductImportQuantity';

IF @CurrentDataType IS NULL
BEGIN
    PRINT 'Column does not exist. Creating as NVARCHAR(500)...';
    ALTER TABLE StoreSurveys ADD NewProductImportQuantity NVARCHAR(500) NULL;
    PRINT 'Column created successfully.';
END
ELSE IF @CurrentDataType = 'nvarchar'
BEGIN
    PRINT 'Column is already NVARCHAR. No migration needed.';
END
ELSE IF @CurrentDataType = 'decimal' OR @CurrentDataType = 'numeric'
BEGIN
    PRINT 'Starting migration from DECIMAL to NVARCHAR...';
    
    -- Clean up temp column if exists
    IF EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'StoreSurveys' 
            AND COLUMN_NAME = 'NewProductImportQuantity_temp'
    )
    BEGIN
        PRINT 'Cleaning up previous temp column...';
        ALTER TABLE StoreSurveys DROP COLUMN NewProductImportQuantity_temp;
    END

    -- Add temp column
    PRINT 'Adding temporary column...';
    ALTER TABLE StoreSurveys ADD NewProductImportQuantity_temp NVARCHAR(500) NULL;
    PRINT 'Temp column added.';
END
GO

-- Now update data (this is a separate batch, so SQL Server will recognize the new column)
IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'StoreSurveys' 
        AND COLUMN_NAME = 'NewProductImportQuantity_temp'
)
BEGIN
    PRINT 'Converting existing values...';
    DECLARE @RowCount INT;
    
    UPDATE StoreSurveys
    SET NewProductImportQuantity_temp = 
        CASE 
            WHEN NewProductImportQuantity IS NOT NULL 
            THEN CAST(CAST(NewProductImportQuantity AS DECIMAL(18,2)) AS NVARCHAR(500))
            ELSE NULL
        END;
    
    SET @RowCount = @@ROWCOUNT;
    PRINT 'Converted ' + CAST(@RowCount AS NVARCHAR(10)) + ' row(s).';
END
GO

-- Drop old column and rename temp (separate batch)
IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'StoreSurveys' 
        AND COLUMN_NAME = 'NewProductImportQuantity'
        AND DATA_TYPE IN ('decimal', 'numeric')
)
AND EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'StoreSurveys' 
        AND COLUMN_NAME = 'NewProductImportQuantity_temp'
)
BEGIN
    PRINT 'Dropping old DECIMAL column...';
    ALTER TABLE StoreSurveys DROP COLUMN NewProductImportQuantity;
    PRINT 'Old column dropped.';
    
    PRINT 'Renaming temp column...';
    EXEC sp_rename 'StoreSurveys.NewProductImportQuantity_temp', 'NewProductImportQuantity', 'COLUMN';
    PRINT 'Column renamed.';
    PRINT '';
    PRINT '✅ Migration completed successfully!';
END
GO

-- Verification
PRINT '';
PRINT '=== Verification ===';
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'StoreSurveys' 
    AND COLUMN_NAME = 'NewProductImportQuantity';
GO

