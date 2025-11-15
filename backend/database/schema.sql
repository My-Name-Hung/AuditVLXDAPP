-- Auditapp Database Schema for SQL Server

-- Users Table
CREATE TABLE Users (
    Id INT PRIMARY KEY IDENTITY(1,1),
    UserCode VARCHAR(50) UNIQUE NOT NULL,
    Username NVARCHAR(100) UNIQUE NOT NULL,
    Password NVARCHAR(255) NOT NULL,
    FullName NVARCHAR(200) NOT NULL,
    Email NVARCHAR(200),
    Phone VARCHAR(20),
    Role VARCHAR(50) DEFAULT 'user',
    IsChangePassword BIT DEFAULT 1,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE()
);

-- Stores Table
CREATE TABLE Stores (
    Id INT PRIMARY KEY IDENTITY(1,1),
    StoreCode VARCHAR(50) UNIQUE NOT NULL,
    StoreName NVARCHAR(200) NOT NULL,
    Address NVARCHAR(500),
    Phone VARCHAR(20),
    Email NVARCHAR(200),
    Latitude DECIMAL(10, 8),
    Longitude DECIMAL(11, 8),
    TerritoryId INT,
    UserId INT,
    Status VARCHAR(20) DEFAULT 'not_audited' CHECK (Status IN ('not_audited', 'audited', 'passed', 'failed')),
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (TerritoryId) REFERENCES Territories(Id),
    FOREIGN KEY (UserId) REFERENCES Users(Id)
);

-- Audits Table
CREATE TABLE Audits (
    Id INT PRIMARY KEY IDENTITY(1,1),
    UserId INT NOT NULL,
    StoreId INT NOT NULL,
    Result VARCHAR(20) NOT NULL CHECK (Result IN ('pass', 'fail')),
    Notes NVARCHAR(1000),
    AuditDate DATETIME NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    FOREIGN KEY (StoreId) REFERENCES Stores(Id) ON DELETE CASCADE
);

-- Images Table
CREATE TABLE Images (
    Id INT PRIMARY KEY IDENTITY(1,1),
    AuditId INT NOT NULL,
    ImageUrl NVARCHAR(500) NOT NULL,
    ReferenceImageUrl NVARCHAR(500),
    Latitude DECIMAL(10, 8),
    Longitude DECIMAL(11, 8),
    CapturedAt DATETIME NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (AuditId) REFERENCES Audits(Id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IX_Users_Username ON Users(Username);
CREATE INDEX IX_Users_UserCode ON Users(UserCode);
CREATE INDEX IX_Stores_StoreCode ON Stores(StoreCode);
CREATE INDEX IX_Audits_UserId ON Audits(UserId);
CREATE INDEX IX_Audits_StoreId ON Audits(StoreId);
CREATE INDEX IX_Audits_AuditDate ON Audits(AuditDate);
CREATE INDEX IX_Images_AuditId ON Images(AuditId);

