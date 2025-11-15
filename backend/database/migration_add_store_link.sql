-- Migration: Add Link column to Stores table
-- This migration adds a Link column to store the detail page URL for each store

USE DBXMTD;
GO

-- Add Link column if it doesn't exist
IF NOT EXISTS (
    SELECT 1 
    FROM sys.columns 
    WHERE object_id = OBJECT_ID('Stores') 
    AND name = 'Link'
)
BEGIN
    ALTER TABLE Stores
    ADD Link NVARCHAR(500) NULL;
    
    PRINT 'Column Link added to Stores table';
END
ELSE
BEGIN
    PRINT 'Column Link already exists in Stores table';
END
GO

-- Update existing stores with their detail links
UPDATE Stores
SET Link = CONCAT('https://ximang.netlify.app/stores/', Id)
WHERE Link IS NULL;

PRINT 'Updated existing stores with detail links';
GO

