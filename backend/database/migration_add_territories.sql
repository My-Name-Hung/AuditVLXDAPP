-- Migration: Add Territories table and update Users, Stores tables

-- Create Territories Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Territories]') AND type in (N'U'))
BEGIN
    CREATE TABLE Territories (
        Id INT PRIMARY KEY IDENTITY(1,1),
        TerritoryName NVARCHAR(200) UNIQUE NOT NULL,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_Territories_TerritoryName ON Territories(TerritoryName);
END
GO

-- Add TerritoryId to Users table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = 'TerritoryId')
BEGIN
    ALTER TABLE Users ADD TerritoryId INT NULL;
    ALTER TABLE Users ADD CONSTRAINT FK_Users_Territories FOREIGN KEY (TerritoryId) REFERENCES Territories(Id);
    CREATE INDEX IX_Users_TerritoryId ON Users(TerritoryId);
END
GO

-- Add UserId to Stores table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Stores]') AND name = 'UserId')
BEGIN
    ALTER TABLE Stores ADD UserId INT NULL;
    ALTER TABLE Stores ADD CONSTRAINT FK_Stores_Users FOREIGN KEY (UserId) REFERENCES Users(Id);
    CREATE INDEX IX_Stores_UserId ON Stores(UserId);
END
GO

-- Insert Territories data
IF NOT EXISTS (SELECT * FROM Territories WHERE TerritoryName = N'Trung tâm Tiêu Thụ')
BEGIN
    INSERT INTO Territories (TerritoryName) VALUES
    (N'Trung tâm Tiêu Thụ'),
    (N'TPHCM'),
    (N'Bắc Mekong + Miền Đông'),
    (N'Nam Mekong'),
    (N'Miền Đông'),
    (N'Trà Vinh'),
    (N'Đồng Tháp'),
    (N'An Giang'),
    (N'Tiền Giang'),
    (N'Kiên Giang'),
    (N'Vĩnh Long'),
    (N'Cà Mau'),
    (N'Sóc Trăng'),
    (N'Long An'),
    (N'Bạc Liêu'),
    (N'Đồng Nai'),
    (N'Bình Dương'),
    (N'Bình Phước + ĐắK Nông'),
    (N'Tây Ninh'),
    (N'Cần Thơ'),
    (N'Tiền Giang (Tín Nghĩa Mỹ)'),
    (N'Bến Tre');
END
GO

