-- Auditapp Database Schema for SQL Server

/**************************************
 * Territories
 **************************************/
CREATE TABLE Territories (
    Id INT PRIMARY KEY IDENTITY(1,1),
    TerritoryName NVARCHAR(200) UNIQUE NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
);

/**************************************
 * Users
 **************************************/
CREATE TABLE Users (
    Id INT PRIMARY KEY IDENTITY(1,1),
    UserCode VARCHAR(50) UNIQUE NOT NULL,
    Username NVARCHAR(100) UNIQUE NOT NULL,
    Password NVARCHAR(255) NOT NULL,
    FullName NVARCHAR(200) NOT NULL,
    Email NVARCHAR(200),
    Phone VARCHAR(20),
    Role VARCHAR(50) NOT NULL DEFAULT 'user',
    Position NVARCHAR(200),
    Avatar NVARCHAR(500),
    IsChangePassword BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
);

/**************************************
 * Stores
 **************************************/
CREATE TABLE Stores (
    Id INT PRIMARY KEY IDENTITY(1,1),
    StoreCode VARCHAR(50) UNIQUE NOT NULL,
    StoreName NVARCHAR(200) NOT NULL,
    Address NVARCHAR(500),
    Phone VARCHAR(20),
    Email NVARCHAR(200),
    Latitude DECIMAL(10, 8),
    Longitude DECIMAL(11, 8),
    TerritoryId INT NULL,
    UserId INT NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'not_audited',
    Rank INT NULL,
    TaxCode VARCHAR(50),
    PartnerName NVARCHAR(200),
    Link NVARCHAR(500),
    FailedReason NVARCHAR(1000),
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Stores_Territories FOREIGN KEY (TerritoryId) REFERENCES Territories(Id),
    CONSTRAINT FK_Stores_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
    CONSTRAINT CK_Stores_Status CHECK (Status IN ('not_audited', 'audited', 'passed', 'failed')),
    CONSTRAINT CK_Stores_Rank CHECK (Rank IS NULL OR Rank IN (1, 2))
);

/**************************************
 * Audits
 **************************************/
CREATE TABLE Audits (
    Id INT PRIMARY KEY IDENTITY(1,1),
    UserId INT NOT NULL,
    StoreId INT NOT NULL,
    Result VARCHAR(20) NOT NULL CHECK (Result IN ('pass', 'fail')),
    Notes NVARCHAR(1000),
    AuditDate DATETIME NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Audits_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Audits_Stores FOREIGN KEY (StoreId) REFERENCES Stores(Id) ON DELETE CASCADE
);

/**************************************
 * Images
 **************************************/
CREATE TABLE Images (
    Id INT PRIMARY KEY IDENTITY(1,1),
    AuditId INT NOT NULL,
    ImageUrl NVARCHAR(500) NOT NULL,
    ReferenceImageUrl NVARCHAR(500),
    Latitude DECIMAL(10, 8),
    Longitude DECIMAL(11, 8),
    CapturedAt DATETIME NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Images_Audits FOREIGN KEY (AuditId) REFERENCES Audits(Id) ON DELETE CASCADE
);

/**************************************
 * StoreUsers
 * Many-to-many relationship: Multiple users can be assigned to one store
 **************************************/
CREATE TABLE StoreUsers (
    Id INT PRIMARY KEY IDENTITY(1,1),
    StoreId INT NOT NULL,
    UserId INT NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_StoreUsers_Stores FOREIGN KEY (StoreId) REFERENCES Stores(Id) ON DELETE CASCADE,
    CONSTRAINT FK_StoreUsers_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_StoreUsers_StoreId_UserId UNIQUE (StoreId, UserId)
);

/**************************************
 * Import History
 **************************************/
CREATE TABLE ImportHistory (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Type VARCHAR(50) NOT NULL, -- 'stores' | 'users'
    Total INT NOT NULL,
    SuccessCount INT NOT NULL,
    ErrorCount INT NOT NULL,
    UserId INT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_ImportHistory_Users FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE SET NULL,
    CONSTRAINT CK_ImportHistory_Type CHECK (Type IN ('stores', 'users'))
);

/**************************************
 * Indexes
 **************************************/
-- Users
CREATE INDEX IX_Users_Username ON Users(Username);
CREATE INDEX IX_Users_UserCode ON Users(UserCode);
CREATE INDEX IX_Users_Role ON Users(Role);

-- Stores
CREATE INDEX IX_Stores_StoreCode ON Stores(StoreCode);
CREATE INDEX IX_Stores_TerritoryId ON Stores(TerritoryId);
CREATE INDEX IX_Stores_UserId ON Stores(UserId);
CREATE INDEX IX_Stores_Status ON Stores(Status);
CREATE INDEX IX_Stores_TerritoryId_UserId_Status ON Stores(TerritoryId, UserId, Status);

-- Audits
CREATE INDEX IX_Audits_UserId ON Audits(UserId);
CREATE INDEX IX_Audits_StoreId ON Audits(StoreId);
CREATE INDEX IX_Audits_UserId_StoreId ON Audits(UserId, StoreId);
CREATE INDEX IX_Audits_AuditDate ON Audits(AuditDate);

-- Images
CREATE INDEX IX_Images_AuditId ON Images(AuditId);
CREATE INDEX IX_Images_ImageUrl ON Images(ImageUrl) WHERE ImageUrl IS NOT NULL;

-- StoreUsers
CREATE INDEX IX_StoreUsers_StoreId ON StoreUsers(StoreId);
CREATE INDEX IX_StoreUsers_UserId ON StoreUsers(UserId);
CREATE INDEX IX_StoreUsers_StoreId_UserId ON StoreUsers(StoreId, UserId);

-- Import history
CREATE INDEX IX_ImportHistory_Type ON ImportHistory(Type);

