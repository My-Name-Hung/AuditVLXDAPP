-- Migration: Add Notes column to Stores table
-- This migration adds a Notes column to store additional notes/comments for stores

USE DBXMTD;
GO

-- Add Notes column if it doesn't exist
IF NOT EXISTS (
    SELECT 1 
    FROM sys.columns 
    WHERE object_id = OBJECT_ID('Stores') 
    AND name = 'Notes'
)
BEGIN
    ALTER TABLE Stores
    ADD Notes NVARCHAR(1000) NULL;
    
    PRINT 'Column Notes added to Stores table';
END
ELSE
BEGIN
    PRINT 'Column Notes already exists in Stores table';
END
GO

