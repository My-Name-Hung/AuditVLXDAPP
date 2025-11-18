-- Migration: Add OpenDate column to Stores table
-- This column stores the date when a store is opened for audit

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Stores]')
      AND name = 'OpenDate'
)
BEGIN
    ALTER TABLE Stores
    ADD OpenDate DATE NULL;

    PRINT 'Added OpenDate column to Stores table';
END
ELSE
BEGIN
    PRINT 'OpenDate column already exists on Stores table';
END


