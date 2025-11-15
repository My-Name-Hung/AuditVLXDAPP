-- Migration: Create ImportHistory table
-- This table stores import history for stores and users

USE DBXMTD;
GO

-- Create ImportHistory table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'ImportHistory') AND type in (N'U'))
BEGIN
    CREATE TABLE ImportHistory (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Type VARCHAR(50) NOT NULL, -- 'stores' or 'users'
        Total INT NOT NULL,
        SuccessCount INT NOT NULL,
        ErrorCount INT NOT NULL,
        UserId INT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE SET NULL
    );
    
    PRINT 'ImportHistory table created';
END
ELSE
BEGIN
    PRINT 'ImportHistory table already exists';
END
GO

