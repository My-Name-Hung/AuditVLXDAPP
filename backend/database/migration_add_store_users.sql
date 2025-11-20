-- Migration: Add StoreUsers table for multi-user assignment
-- This allows multiple users to be assigned to a single store for auditing

/**************************************
 * StoreUsers Table
 * Many-to-many relationship between Stores and Users
 **************************************/
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[StoreUsers]') AND type in (N'U'))
BEGIN
    CREATE TABLE StoreUsers (
        Id INT PRIMARY KEY IDENTITY(1,1),
        StoreId INT NOT NULL,
        UserId INT NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_StoreUsers_Stores FOREIGN KEY (StoreId) REFERENCES Stores(Id) ON DELETE CASCADE,
        CONSTRAINT FK_StoreUsers_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT UQ_StoreUsers_StoreId_UserId UNIQUE (StoreId, UserId)
    );

    -- Create indexes for performance
    CREATE INDEX IX_StoreUsers_StoreId ON StoreUsers(StoreId);
    CREATE INDEX IX_StoreUsers_UserId ON StoreUsers(UserId);
    CREATE INDEX IX_StoreUsers_StoreId_UserId ON StoreUsers(StoreId, UserId);

    PRINT 'StoreUsers table created successfully';
END
ELSE
BEGIN
    PRINT 'StoreUsers table already exists';
END
GO

-- Migrate existing data: Copy Stores.UserId to StoreUsers
-- This ensures backward compatibility
INSERT INTO StoreUsers (StoreId, UserId, CreatedAt)
SELECT Id, UserId, CreatedAt
FROM Stores
WHERE UserId IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM StoreUsers su 
    WHERE su.StoreId = Stores.Id AND su.UserId = Stores.UserId
);

PRINT 'Migrated existing Store-User assignments to StoreUsers table';
GO

