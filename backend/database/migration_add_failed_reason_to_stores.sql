-- Migration: Add FailedReason field to Stores table
-- This field stores the reason when a store is marked as "failed"
-- It should be NULL for stores with other statuses

-- Check if column already exists before adding
IF NOT EXISTS (
    SELECT * 
    FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[Stores]') 
    AND name = 'FailedReason'
)
BEGIN
    ALTER TABLE Stores
    ADD FailedReason NVARCHAR(1000) NULL;
    
    PRINT 'FailedReason column added to Stores table successfully';
END
ELSE
BEGIN
    PRINT 'FailedReason column already exists in Stores table';
END
GO

