-- Migration: Update Stores.Phone column to support multiple phone numbers
-- Supports storing up to 3 phone numbers separated by spaces
-- Example: "0348843765 034884366 0705007516"

ALTER TABLE Stores
ALTER COLUMN Phone NVARCHAR(100) NULL;
GO

PRINT 'Migration completed: Stores.Phone updated to NVARCHAR(100)';
