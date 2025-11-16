-- Migration: Add indexes to improve query performance
-- Date: 2025-01-XX
-- This migration adds indexes to frequently queried columns to improve dashboard and store list performance

-- Index on Audits table for UserId and StoreId (used in dashboard queries)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Audits_UserId_StoreId' AND object_id = OBJECT_ID('Audits'))
BEGIN
    CREATE INDEX IX_Audits_UserId_StoreId ON Audits(UserId, StoreId);
    PRINT 'Created index IX_Audits_UserId_StoreId on Audits table';
END
ELSE
BEGIN
    PRINT 'Index IX_Audits_UserId_StoreId already exists on Audits table';
END

-- Index on Audits table for AuditDate (used in date filtering)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Audits_AuditDate' AND object_id = OBJECT_ID('Audits'))
BEGIN
    CREATE INDEX IX_Audits_AuditDate ON Audits(AuditDate);
    PRINT 'Created index IX_Audits_AuditDate on Audits table';
END
ELSE
BEGIN
    PRINT 'Index IX_Audits_AuditDate already exists on Audits table';
END

-- Index on Images table for AuditId (used in EXISTS subquery)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Images_AuditId' AND object_id = OBJECT_ID('Images'))
BEGIN
    CREATE INDEX IX_Images_AuditId ON Images(AuditId);
    PRINT 'Created index IX_Images_AuditId on Images table';
END
ELSE
BEGIN
    PRINT 'Index IX_Images_AuditId already exists on Images table';
END

-- Index on Images table for ImageUrl (used in filtering)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Images_ImageUrl' AND object_id = OBJECT_ID('Images'))
BEGIN
    CREATE INDEX IX_Images_ImageUrl ON Images(ImageUrl) WHERE ImageUrl IS NOT NULL;
    PRINT 'Created index IX_Images_ImageUrl on Images table';
END
ELSE
BEGIN
    PRINT 'Index IX_Images_ImageUrl already exists on Images table';
END

-- Index on Stores table for TerritoryId (used in filtering)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Stores_TerritoryId' AND object_id = OBJECT_ID('Stores'))
BEGIN
    CREATE INDEX IX_Stores_TerritoryId ON Stores(TerritoryId);
    PRINT 'Created index IX_Stores_TerritoryId on Stores table';
END
ELSE
BEGIN
    PRINT 'Index IX_Stores_TerritoryId already exists on Stores table';
END

-- Index on Stores table for UserId (used in filtering)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Stores_UserId' AND object_id = OBJECT_ID('Stores'))
BEGIN
    CREATE INDEX IX_Stores_UserId ON Stores(UserId);
    PRINT 'Created index IX_Stores_UserId on Stores table';
END
ELSE
BEGIN
    PRINT 'Index IX_Stores_UserId already exists on Stores table';
END

-- Index on Stores table for Status (used in filtering)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Stores_Status' AND object_id = OBJECT_ID('Stores'))
BEGIN
    CREATE INDEX IX_Stores_Status ON Stores(Status);
    PRINT 'Created index IX_Stores_Status on Stores table';
END
ELSE
BEGIN
    PRINT 'Index IX_Stores_Status already exists on Stores table';
END

-- Composite index on Stores for common filter combinations
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Stores_TerritoryId_UserId_Status' AND object_id = OBJECT_ID('Stores'))
BEGIN
    CREATE INDEX IX_Stores_TerritoryId_UserId_Status ON Stores(TerritoryId, UserId, Status);
    PRINT 'Created composite index IX_Stores_TerritoryId_UserId_Status on Stores table';
END
ELSE
BEGIN
    PRINT 'Index IX_Stores_TerritoryId_UserId_Status already exists on Stores table';
END

-- Index on Users table for Role (used in filtering)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_Role' AND object_id = OBJECT_ID('Users'))
BEGIN
    CREATE INDEX IX_Users_Role ON Users(Role);
    PRINT 'Created index IX_Users_Role on Users table';
END
ELSE
BEGIN
    PRINT 'Index IX_Users_Role already exists on Users table';
END

PRINT 'Migration completed: Indexes added for performance optimization';

