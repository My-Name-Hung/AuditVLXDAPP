-- Migration: Move TerritoryId from Users to Stores
-- This migration removes TerritoryId from Users table and adds it to Stores table

-- Step 1: Add TerritoryId to Stores table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stores]') AND name = 'TerritoryId')
BEGIN
    ALTER TABLE Stores ADD TerritoryId INT NULL;
    PRINT 'Added TerritoryId column to Stores table';
END
ELSE
BEGIN
    PRINT 'TerritoryId column already exists in Stores table';
END

-- Step 2: Add foreign key constraint from Stores to Territories
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Stores_Territories')
BEGIN
    ALTER TABLE Stores 
    ADD CONSTRAINT FK_Stores_Territories 
    FOREIGN KEY (TerritoryId) REFERENCES Territories(Id);
    PRINT 'Added foreign key constraint FK_Stores_Territories';
END
ELSE
BEGIN
    PRINT 'Foreign key constraint FK_Stores_Territories already exists';
END

-- Step 3: Create index on Stores.TerritoryId for better performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Stores_TerritoryId' AND object_id = OBJECT_ID(N'[dbo].[Stores]'))
BEGIN
    CREATE INDEX IX_Stores_TerritoryId ON Stores(TerritoryId);
    PRINT 'Created index IX_Stores_TerritoryId';
END
ELSE
BEGIN
    PRINT 'Index IX_Stores_TerritoryId already exists';
END

-- Step 4: Remove foreign key constraint from Users to Territories
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Users_Territories')
BEGIN
    ALTER TABLE Users DROP CONSTRAINT FK_Users_Territories;
    PRINT 'Removed foreign key constraint FK_Users_Territories';
END
ELSE
BEGIN
    PRINT 'Foreign key constraint FK_Users_Territories does not exist';
END

-- Step 5: Remove index on Users.TerritoryId
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_TerritoryId' AND object_id = OBJECT_ID(N'[dbo].[Users]'))
BEGIN
    DROP INDEX IX_Users_TerritoryId ON Users;
    PRINT 'Removed index IX_Users_TerritoryId';
END
ELSE
BEGIN
    PRINT 'Index IX_Users_TerritoryId does not exist';
END

-- Step 6: Remove TerritoryId column from Users table
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = 'TerritoryId')
BEGIN
    ALTER TABLE Users DROP COLUMN TerritoryId;
    PRINT 'Removed TerritoryId column from Users table';
END
ELSE
BEGIN
    PRINT 'TerritoryId column does not exist in Users table';
END

PRINT 'Migration completed successfully!';

