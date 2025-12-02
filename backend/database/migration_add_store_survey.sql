-- Migration: Add Store Survey System
-- Description: Tạo bảng cho hệ thống khảo sát cửa hàng
-- Date: 2025-01-XX

-- ============================================
-- 1. Tạo bảng CementProducts (Sản phẩm Xi Măng)
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CementProducts')
BEGIN
    CREATE TABLE CementProducts (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Code VARCHAR(50) UNIQUE NOT NULL,
        Name NVARCHAR(500) NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
    
    PRINT 'Created table CementProducts';
END
ELSE
BEGIN
    PRINT 'Table CementProducts already exists';
END

-- ============================================
-- 2. Tạo bảng StoreSurveys (Thông tin khảo sát chính)
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StoreSurveys')
BEGIN
    CREATE TABLE StoreSurveys (
        Id INT PRIMARY KEY IDENTITY(1,1),
        StoreId INT NOT NULL,
        AuditId INT NOT NULL,
        UserId INT NOT NULL,
        
        -- Title 1: Cửa hàng bán sản phẩm không phải của XMTĐ
        CementProductId INT NULL,
        ContactPerson NVARCHAR(200),
        PurchasePrice DECIMAL(18,2),
        SellingPrice DECIMAL(18,2),
        SupplierName NVARCHAR(500),
        RoadTransportFee DECIMAL(18,2),
        WaterTransportFee DECIMAL(18,2),
        ImportExportQuantity NVARCHAR(100),
        StockQuantity NVARCHAR(100),
        ConsumptionArea NVARCHAR(500),
        DebtPeriod NVARCHAR(100),
        
        -- Title 2: Khảo sát sản phẩm của XMTĐ
        WhyNotSellNewProduct NVARCHAR(1000),
        TimeToSellNewProduct DATETIME NULL,
        NewProductImportQuantity DECIMAL(18,2),
        ImportedBySalesperson NVARCHAR(200),
        NewProductSellingPrice DECIMAL(18,2),
        FutureImportPrediction DECIMAL(18,2) NULL,
        
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        
        CONSTRAINT FK_StoreSurveys_Stores FOREIGN KEY (StoreId) REFERENCES Stores(Id),
        CONSTRAINT FK_StoreSurveys_Audits FOREIGN KEY (AuditId) REFERENCES Audits(Id) ON DELETE CASCADE,
        CONSTRAINT FK_StoreSurveys_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
        CONSTRAINT FK_StoreSurveys_CementProducts FOREIGN KEY (CementProductId) REFERENCES CementProducts(Id)
    );
    
    PRINT 'Created table StoreSurveys';
END
ELSE
BEGIN
    PRINT 'Table StoreSurveys already exists';
END

-- ============================================
-- 3. Tạo bảng StoreSurveyProducts (Sản phẩm bán hàng - Title 3)
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StoreSurveyProducts')
BEGIN
    CREATE TABLE StoreSurveyProducts (
        Id INT PRIMARY KEY IDENTITY(1,1),
        StoreSurveyId INT NOT NULL,
        ProductType NVARCHAR(100) NOT NULL,
        CementProductId INT NULL,
        SellingPrice DECIMAL(18,2),
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        
        CONSTRAINT FK_StoreSurveyProducts_StoreSurveys FOREIGN KEY (StoreSurveyId) REFERENCES StoreSurveys(Id) ON DELETE CASCADE,
        CONSTRAINT FK_StoreSurveyProducts_CementProducts FOREIGN KEY (CementProductId) REFERENCES CementProducts(Id)
    );
    
    PRINT 'Created table StoreSurveyProducts';
END
ELSE
BEGIN
    PRINT 'Table StoreSurveyProducts already exists';
END

-- ============================================
-- 4. Tạo Indexes
-- ============================================

-- CementProducts indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CementProducts_Code' AND object_id = OBJECT_ID('CementProducts'))
BEGIN
    CREATE INDEX IX_CementProducts_Code ON CementProducts(Code);
    PRINT 'Created index IX_CementProducts_Code';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CementProducts_Name' AND object_id = OBJECT_ID('CementProducts'))
BEGIN
    CREATE INDEX IX_CementProducts_Name ON CementProducts(Name);
    PRINT 'Created index IX_CementProducts_Name';
END

-- StoreSurveys indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StoreSurveys_StoreId' AND object_id = OBJECT_ID('StoreSurveys'))
BEGIN
    CREATE INDEX IX_StoreSurveys_StoreId ON StoreSurveys(StoreId);
    PRINT 'Created index IX_StoreSurveys_StoreId';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StoreSurveys_AuditId' AND object_id = OBJECT_ID('StoreSurveys'))
BEGIN
    CREATE INDEX IX_StoreSurveys_AuditId ON StoreSurveys(AuditId);
    PRINT 'Created index IX_StoreSurveys_AuditId';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StoreSurveys_UserId' AND object_id = OBJECT_ID('StoreSurveys'))
BEGIN
    CREATE INDEX IX_StoreSurveys_UserId ON StoreSurveys(UserId);
    PRINT 'Created index IX_StoreSurveys_UserId';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StoreSurveys_CementProductId' AND object_id = OBJECT_ID('StoreSurveys'))
BEGIN
    CREATE INDEX IX_StoreSurveys_CementProductId ON StoreSurveys(CementProductId);
    PRINT 'Created index IX_StoreSurveys_CementProductId';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StoreSurveys_CreatedAt' AND object_id = OBJECT_ID('StoreSurveys'))
BEGIN
    CREATE INDEX IX_StoreSurveys_CreatedAt ON StoreSurveys(CreatedAt);
    PRINT 'Created index IX_StoreSurveys_CreatedAt';
END

-- StoreSurveyProducts indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StoreSurveyProducts_StoreSurveyId' AND object_id = OBJECT_ID('StoreSurveyProducts'))
BEGIN
    CREATE INDEX IX_StoreSurveyProducts_StoreSurveyId ON StoreSurveyProducts(StoreSurveyId);
    PRINT 'Created index IX_StoreSurveyProducts_StoreSurveyId';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StoreSurveyProducts_ProductType' AND object_id = OBJECT_ID('StoreSurveyProducts'))
BEGIN
    CREATE INDEX IX_StoreSurveyProducts_ProductType ON StoreSurveyProducts(ProductType);
    PRINT 'Created index IX_StoreSurveyProducts_ProductType';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StoreSurveyProducts_CementProductId' AND object_id = OBJECT_ID('StoreSurveyProducts'))
BEGIN
    CREATE INDEX IX_StoreSurveyProducts_CementProductId ON StoreSurveyProducts(CementProductId);
    PRINT 'Created index IX_StoreSurveyProducts_CementProductId';
END

PRINT 'Migration completed successfully!';

