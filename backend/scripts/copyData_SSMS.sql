-- ================================================================
--  SCRIPT COPY DATA: RE_SALE_20260410 -> DBXMTD
--  Chạy TRONG SSMS (SQL Server Management Studio)
--  Chỉ INSERT bản ghi MỚI - KHÔNG UPDATE - KHÔNG XÓA
-- ================================================================

USE DBXMTD
GO

-- ================================================================
-- BƯỚC 1: COPY STORES (nếu cần FK)
-- ================================================================
PRINT '📋 Bước 1: COPY Stores...'

DECLARE @StoreCount INT
SELECT @StoreCount = COUNT(*)
FROM RE_SALE_20260410.dbo.Stores b
WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Stores d WHERE d.Id = b.Id)
PRINT '   Cần INSERT ' + CAST(@StoreCount AS NVARCHAR) + ' Stores'

IF @StoreCount > 0
BEGIN
    SET IDENTITY_INSERT DBXMTD.dbo.Stores ON;

    INSERT INTO DBXMTD.dbo.Stores (Id, StoreCode, StoreName, Address, District, Province, Lat, Lon, CreatedAt, UpdatedAt)
    SELECT b.Id, b.StoreCode, b.StoreName, b.Address, b.District, b.Province, b.Lat, b.Lon, b.CreatedAt, b.UpdatedAt
    FROM RE_SALE_20260410.dbo.Stores b
    WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Stores d WHERE d.Id = b.Id);

    SET IDENTITY_INSERT DBXMTD.dbo.Stores OFF;
    PRINT '   ✅ Đã INSERT Stores'
END
ELSE
    PRINT '   ⏭️  Đã đủ Stores'
GO


-- ================================================================
-- BƯỚC 2: COPY USERS (nếu cần FK)
-- ================================================================
PRINT ''
PRINT '📋 Bước 2: COPY Users...'

DECLARE @UserCount INT
SELECT @UserCount = COUNT(*)
FROM RE_SALE_20260410.dbo.Users b
WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Users d WHERE d.Id = b.Id)
PRINT '   Cần INSERT ' + CAST(@UserCount AS NVARCHAR) + ' Users'

IF @UserCount > 0
BEGIN
    SET IDENTITY_INSERT DBXMTD.dbo.Users ON;

    INSERT INTO DBXMTD.dbo.Users (Id, UserCode, FullName, Phone, Password, Role, IsActive, CreatedAt, UpdatedAt)
    SELECT b.Id, b.UserCode, b.FullName, b.Phone, b.Password, b.Role, b.IsActive, b.CreatedAt, b.UpdatedAt
    FROM RE_SALE_20260410.dbo.Users b
    WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Users d WHERE d.Id = b.Id);

    SET IDENTITY_INSERT DBXMTD.dbo.Users OFF;
    PRINT '   ✅ Đã INSERT Users'
END
ELSE
    PRINT '   ⏭️  Đã đủ Users'
GO


-- ================================================================
-- BƯỚC 3: COPY STORESURVEYS
-- ================================================================
PRINT ''
PRINT '📋 Bước 3: COPY StoreSurveys...'

DECLARE @SSCount INT
SELECT @SSCount = COUNT(*)
FROM RE_SALE_20260410.dbo.StoreSurveys b
WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.StoreSurveys d WHERE d.Id = b.Id)
PRINT '   Cần INSERT ' + CAST(@SSCount AS NVARCHAR) + ' StoreSurveys'

IF @SSCount > 0
BEGIN
    SET IDENTITY_INSERT DBXMTD.dbo.StoreSurveys ON;

    INSERT INTO DBXMTD.dbo.StoreSurveys (Id, StoreId, SurveyDate, SurveyType, Result, Notes, CreatedAt, UpdatedAt)
    SELECT b.Id, b.StoreId, b.SurveyDate, b.SurveyType, b.Result, b.Notes, b.CreatedAt, b.UpdatedAt
    FROM RE_SALE_20260410.dbo.StoreSurveys b
    WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.StoreSurveys d WHERE d.Id = b.Id);

    SET IDENTITY_INSERT DBXMTD.dbo.StoreSurveys OFF;
    PRINT '   ✅ Đã INSERT StoreSurveys'
END
ELSE
    PRINT '   ⏭️  Đã đủ StoreSurveys'
GO


-- ================================================================
-- BƯỚC 4: COPY STORESURVEYPRODUCTS
-- ================================================================
PRINT ''
PRINT '📋 Bước 4: COPY StoreSurveyProducts...'

DECLARE @SSPCount INT
SELECT @SSPCount = COUNT(*)
FROM RE_SALE_20260410.dbo.StoreSurveyProducts b
WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.StoreSurveyProducts d WHERE d.Id = b.Id)
PRINT '   Cần INSERT ' + CAST(@SSPCount AS NVARCHAR) + ' StoreSurveyProducts'

IF @SSPCount > 0
BEGIN
    SET IDENTITY_INSERT DBXMTD.dbo.StoreSurveyProducts ON;

    INSERT INTO DBXMTD.dbo.StoreSurveyProducts (Id, StoreSurveyId, ProductCode, ProductName, Quantity, Result, Notes, CreatedAt, UpdatedAt)
    SELECT b.Id, b.StoreSurveyId, b.ProductCode, b.ProductName, b.Quantity, b.Result, b.Notes, b.CreatedAt, b.UpdatedAt
    FROM RE_SALE_20260410.dbo.StoreSurveyProducts b
    WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.StoreSurveyProducts d WHERE d.Id = b.Id);

    SET IDENTITY_INSERT DBXMTD.dbo.StoreSurveyProducts OFF;
    PRINT '   ✅ Đã INSERT StoreSurveyProducts'
END
ELSE
    PRINT '   ⏭️  Đã đủ StoreSurveyProducts'
GO


-- ================================================================
-- BƯỚC 5: COPY AUDITS
-- ================================================================
PRINT ''
PRINT '📋 Bước 5: COPY Audits...'

DECLARE @AuditCount INT
SELECT @AuditCount = COUNT(*)
FROM RE_SALE_20260410.dbo.Audits b
WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Audits d WHERE d.Id = b.Id)
PRINT '   Cần INSERT ' + CAST(@AuditCount AS NVARCHAR) + ' Audits'

IF @AuditCount > 0
BEGIN
    SET IDENTITY_INSERT DBXMTD.dbo.Audits ON;

    INSERT INTO DBXMTD.dbo.Audits (Id, UserId, StoreId, Result, Notes, AuditDate, CreatedAt, UpdatedAt)
    SELECT b.Id, b.UserId, b.StoreId, b.Result, b.Notes, b.AuditDate, b.CreatedAt, b.UpdatedAt
    FROM RE_SALE_20260410.dbo.Audits b
    WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Audits d WHERE d.Id = b.Id);

    SET IDENTITY_INSERT DBXMTD.dbo.Audits OFF;
    PRINT '   ✅ Đã INSERT Audits'
END
ELSE
    PRINT '   ⏭️  Đã đủ Audits'
GO


-- ================================================================
-- BƯỚC 6: COPY IMAGES
-- ================================================================
PRINT ''
PRINT '📋 Bước 6: COPY Images...'

DECLARE @ImgCount INT
SELECT @ImgCount = COUNT(*)
FROM RE_SALE_20260410.dbo.Images b
WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Images d WHERE d.Id = b.Id)
PRINT '   Cần INSERT ' + CAST(@ImgCount AS NVARCHAR) + ' Images'

IF @ImgCount > 0
BEGIN
    SET IDENTITY_INSERT DBXMTD.dbo.Images ON;

    INSERT INTO DBXMTD.dbo.Images (Id, AuditId, ImageUrl, ReferenceImageUrl, Latitude, Longitude, CapturedAt, CreatedAt, UpdatedAt)
    SELECT b.Id, b.AuditId, b.ImageUrl, b.ReferenceImageUrl, b.Latitude, b.Longitude, b.CapturedAt, b.CreatedAt, b.UpdatedAt
    FROM RE_SALE_20260410.dbo.Images b
    WHERE NOT EXISTS (SELECT 1 FROM DBXMTD.dbo.Images d WHERE d.Id = b.Id);

    SET IDENTITY_INSERT DBXMTD.dbo.Images OFF;
    PRINT '   ✅ Đã INSERT Images'
END
ELSE
    PRINT '   ⏭️  Đã đủ Images'
GO


-- ================================================================
-- BƯỚC 7: TỔNG KẾT
-- ================================================================
PRINT ''
PRINT '═══════════════════════════════════════════════════════'
PRINT '   📊 TỔNG KẾT'
PRINT '═══════════════════════════════════════════════════════'

SELECT 'Stores' as TableName, (SELECT COUNT(*) FROM DBXMTD.dbo.Stores) as DBXMTD, (SELECT COUNT(*) FROM RE_SALE_20260410.dbo.Stores) as Backup
UNION ALL
SELECT 'Users', (SELECT COUNT(*) FROM DBXMTD.dbo.Users), (SELECT COUNT(*) FROM RE_SALE_20260410.dbo.Users)
UNION ALL
SELECT 'StoreSurveys', (SELECT COUNT(*) FROM DBXMTD.dbo.StoreSurveys), (SELECT COUNT(*) FROM RE_SALE_20260410.dbo.StoreSurveys)
UNION ALL
SELECT 'StoreSurveyProducts', (SELECT COUNT(*) FROM DBXMTD.dbo.StoreSurveyProducts), (SELECT COUNT(*) FROM RE_SALE_20260410.dbo.StoreSurveyProducts)
UNION ALL
SELECT 'Audits', (SELECT COUNT(*) FROM DBXMTD.dbo.Audits), (SELECT COUNT(*) FROM RE_SALE_20260410.dbo.Audits)
UNION ALL
SELECT 'Images', (SELECT COUNT(*) FROM DBXMTD.dbo.Images), (SELECT COUNT(*) FROM RE_SALE_20260410.dbo.Images)

PRINT ''
PRINT '📅 Phân bổ ngày Audits trong DBXMTD:'
SELECT CAST(AuditDate AS DATE) as Ngay, COUNT(*) as SoLuong
FROM DBXMTD.dbo.Audits
GROUP BY CAST(AuditDate AS DATE)
ORDER BY Ngay DESC

PRINT ''
PRINT '✅ COPY HOÀN TẤT!'
GO
