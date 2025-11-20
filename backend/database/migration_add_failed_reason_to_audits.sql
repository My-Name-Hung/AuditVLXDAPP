-- Migration: Add FailedReason column to Audits table if missing
-- This script is safe to run multiple times

-- Check if FailedReason column exists in Audits table
IF NOT EXISTS (
    SELECT * 
    FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[Audits]') 
    AND name = 'FailedReason'
)
BEGIN
    PRINT 'Adding FailedReason column to Audits table...';
    ALTER TABLE Audits
    ADD FailedReason NVARCHAR(1000) NULL;
    PRINT 'FailedReason column added to Audits table successfully.';
END
ELSE
BEGIN
    PRINT 'FailedReason column already exists in Audits table.';
END
GO

-- Verify the column was added
IF EXISTS (
    SELECT * 
    FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[Audits]') 
    AND name = 'FailedReason'
)
BEGIN
    PRINT 'Verification: FailedReason column exists in Audits table.';
END
ELSE
BEGIN
    PRINT 'ERROR: FailedReason column was not added to Audits table.';
END
GO

