-- Migration: Check and Add FailedReason to Stores table if missing
-- This script is safe to run multiple times

-- Check if FailedReason column exists in Stores table
IF NOT EXISTS (
    SELECT * 
    FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[Stores]') 
    AND name = 'FailedReason'
)
BEGIN
    PRINT 'Adding FailedReason column to Stores table...';
    ALTER TABLE Stores
    ADD FailedReason NVARCHAR(1000) NULL;
    PRINT 'FailedReason column added successfully.';
END
ELSE
BEGIN
    PRINT 'FailedReason column already exists in Stores table.';
END
GO

-- Verify the column was added
IF EXISTS (
    SELECT * 
    FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[Stores]') 
    AND name = 'FailedReason'
)
BEGIN
    PRINT 'Verification: FailedReason column exists in Stores table.';
END
ELSE
BEGIN
    PRINT 'ERROR: FailedReason column was not added.';
END
GO

