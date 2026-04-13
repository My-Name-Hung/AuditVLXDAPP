/*
=============================================================================
SCRIPT: mergeFromRE_SALE.sql
MỤC ĐÍCH: Merge data từ database RE_SALE_20260410 sang DBXMTD (database hiện tại)
THỨ TỰ: Territories → Users → CementProducts → Stores → StoreUsers
         → Audits → Images → StoreSurveys → StoreSurveyProducts
NGUYÊN TẮC: Upsert (INSERT nếu chưa tồn tại theo unique key, UPDATE nếu đã có)
LƯU Ý  : Chạy trên DBXMTD, cần quyền truy cập RE_SALE_20260410 qua linked server
           hoặc backup/restore. Nếu dùng linked server, thay [RE_SALE_20260410] bằng
           tên linked server thực tế.
=============================================================================
*/

-- ============================================================
-- CẤU HÌNH - SỬA THEO MÔI TRƯỜNG THỰC TẾ
-- ============================================================
-- Nếu dùng Linked Server:
--   DECLARE @SourceDB NVARCHAR(100) = '[RE_SALE_20260410]';
-- Nếu restore backup thành database tên khác:
--   DECLARE @SourceDB NVARCHAR(100) = '[TênDatabaseBackup]';
-- Nếu chạy trực tiếp trong context của source DB:
--   DECLARE @SourceDB NVARCHAR(100) = '';
-- ============================================================

DECLARE @SourceDB NVARCHAR(100) = '[RE_SALE_20260410]';
DECLARE @StartTime DATETIME = GETDATE();
DECLARE @Summary TABLE (Step VARCHAR(100), RowsInserted INT, RowsUpdated INT, DurationMS INT);

PRINT '============================================================';
PRINT 'MERGE DATA: RE_SALE_20260410 -> DBXMTD';
PRINT 'Started at: ' + CONVERT(VARCHAR(30), @StartTime, 121);
PRINT '============================================================';
PRINT '';

-- ============================================================
-- BƯỚC 1: MERGE TERRITORIES
-- Chỉ insert, không update để tránh ảnh hưởng data hiện tại
-- ============================================================
PRINT '>>> STEP 1: Merging Territories...';
DECLARE @t1 DATETIME = GETDATE();

INSERT INTO Territories (TerritoryName, CreatedAt, UpdatedAt)
SELECT TerritoryName, ISNULL(CreatedAt, GETDATE()), ISNULL(UpdatedAt, GETDATE())
FROM RE_SALE_20260410.dbo.Territories src
WHERE NOT EXISTS (
    SELECT 1 FROM Territories dst
    WHERE dst.TerritoryName = src.TerritoryName
);

INSERT INTO @Summary
SELECT 'Territories',
       @@ROWCOUNT,
       0,
       DATEDIFF(MILLISECOND, @t1, GETDATE());

PRINT '    Done. Rows inserted: ' + CAST(@@ROWCOUNT AS VARCHAR(20));
PRINT '';

-- ============================================================
-- BƯỚC 2: MERGE CEMENTPRODUCTS
-- ============================================================
PRINT '>>> STEP 2: Merging CementProducts...';
SET @t1 = GETDATE();

INSERT INTO CementProducts (Code, Name, CreatedAt, UpdatedAt)
SELECT cp.Code, cp.Name, ISNULL(cp.CreatedAt, GETDATE()), ISNULL(cp.UpdatedAt, GETDATE())
FROM RE_SALE_20260410.dbo.CementProducts cp
WHERE NOT EXISTS (
    SELECT 1 FROM CementProducts dst
    WHERE dst.Code = cp.Code
);

INSERT INTO @Summary
SELECT 'CementProducts',
       @@ROWCOUNT,
       0,
       DATEDIFF(MILLISECOND, @t1, GETDATE());

PRINT '    Done. Rows inserted: ' + CAST(@@ROWCOUNT AS VARCHAR(20));
PRINT '';

-- ============================================================
-- BƯỚC 3: MERGE USERS
-- Chỉ insert user mới, KHÔNG insert password (bảo mật)
-- Tạo UserCode mới nếu bị trùng
-- ============================================================
PRINT '>>> STEP 3: Merging Users...';
SET @t1 = GETDATE();

-- Lấy max UserCode hiện tại để generate code mới nếu cần
DECLARE @MaxUserNum INT = 0;
SELECT @MaxUserNum = ISNULL(MAX(CAST(SUBSTRING(UserCode, 2, 10) AS INT)), 0)
FROM Users WHERE UserCode LIKE 'U%';

DECLARE @InsertedUsers TABLE (OldId INT, NewId INT);

INSERT INTO Users (UserCode, Username, Password, FullName, Email, Phone, Role, Position, IsChangePassword, CreatedAt, UpdatedAt)
OUTPUT src.Id, inserted.Id INTO @InsertedUsers
SELECT
    -- Generate unique UserCode
    CASE
        WHEN NOT EXISTS (SELECT 1 FROM Users u2 WHERE u2.UserCode = 'U' + RIGHT('000000' + CAST(@MaxUserNum + ROW_NUMBER() OVER (ORDER BY src.Id) AS VARCHAR(10)), 6))
        THEN 'U' + RIGHT('000000' + CAST(@MaxUserNum + ROW_NUMBER() OVER (ORDER BY src.Id) AS VARCHAR(10)), 6)
        ELSE 'U' + RIGHT('000000' + CAST(@MaxUserNum + 100000 + ROW_NUMBER() OVER (ORDER BY src.Id) AS VARCHAR(10)), 6)
    END AS UserCode,
    -- Username: lowercase không dấu, loại bỏ khoảng trắng thừa và ký tự đặc biệt
    LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        TRIM(src.Username), ' ', ''), 'Đ','d'), 'ư','u'), 'ơ','o'), 'á','a')),
    -- Password: placeholder - user cần reset password sau khi merge
    'HASH_PLACEHOLDER_' + CAST(src.Id AS VARCHAR(20)),
    src.FullName,
    src.Email,
    src.Phone,
    ISNULL(src.Role, 'user'),
    src.Position,
    1, -- IsChangePassword = 1 (yêu cầu đổi password)
    ISNULL(src.CreatedAt, GETDATE()),
    ISNULL(src.UpdatedAt, GETDATE())
FROM RE_SALE_20260410.dbo.Users src
WHERE NOT EXISTS (
    SELECT 1 FROM Users dst
    WHERE dst.Username = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        TRIM(src.Username), ' ', ''), 'Đ','d'), 'ư','u'), 'ơ','o'), 'á','a'))
);

INSERT INTO @Summary
SELECT 'Users',
       @@ROWCOUNT,
       0,
       DATEDIFF(MILLISECOND, @t1, GETDATE());

PRINT '    Done. Rows inserted: ' + CAST(@@ROWCOUNT AS VARCHAR(20));
PRINT '';

-- ============================================================
-- BƯỚC 4: MERGE STORES
-- Map TerritoryId từ source sang target qua TerritoryName
-- ============================================================
PRINT '>>> STEP 4: Merging Stores...';
SET @t1 = GETDATE();

DECLARE @InsertedStores TABLE (OldId INT, NewId INT);

INSERT INTO Stores (StoreCode, StoreName, Address, Phone, Email, Latitude, Longitude,
                    TerritoryId, UserId, Status, Rank, TaxCode, PartnerName,
                    CreatedAt, UpdatedAt)
OUTPUT src.Id, inserted.Id INTO @InsertedStores
SELECT
    -- Generate unique StoreCode nếu bị trùng
    CASE
        WHEN NOT EXISTS (SELECT 1 FROM Stores s2 WHERE s2.StoreCode = src.StoreCode)
        THEN src.StoreCode
        ELSE 'CH' + RIGHT('000000' + CAST(ISNULL((SELECT MAX(CAST(SUBSTRING(s3.StoreCode, 3, 10) AS INT)) FROM Stores s3), 0) + ROW_NUMBER() OVER (ORDER BY src.Id) AS VARCHAR(10)), 6)
    END AS StoreCode,
    src.StoreName,
    src.Address,
    src.Phone,
    src.Email,
    src.Latitude,
    src.Longitude,
    t.Id AS TerritoryId,
    u.NewId AS UserId,  -- Map sang UserId mới
    ISNULL(src.Status, 'not_audited'),
    src.Rank,
    src.TaxCode,
    src.PartnerName,
    ISNULL(src.CreatedAt, GETDATE()),
    ISNULL(src.UpdatedAt, GETDATE())
FROM RE_SALE_20260410.dbo.Stores src
LEFT JOIN Territories t ON t.TerritoryName = src.TerritoryName
LEFT JOIN @InsertedUsers u ON u.OldId = src.UserId
WHERE NOT EXISTS (
    -- Kiểm tra trùng theo StoreName + Address
    SELECT 1 FROM Stores dst
    WHERE dst.StoreName = src.StoreName
      AND ISNULL(dst.Address, '') = ISNULL(src.Address, '')
);

INSERT INTO @Summary
SELECT 'Stores',
       @@ROWCOUNT,
       0,
       DATEDIFF(MILLISECOND, @t1, GETDATE());

PRINT '    Done. Rows inserted: ' + CAST(@@ROWCOUNT AS VARCHAR(20));
PRINT '';

-- ============================================================
-- BƯỚC 5: MERGE STOREUSERS
-- Junction table - cần map cả StoreId và UserId sang ID mới
-- ============================================================
PRINT '>>> STEP 5: Merging StoreUsers...';
SET @t1 = GETDATE();

INSERT INTO StoreUsers (StoreId, UserId, CreatedAt)
SELECT DISTINCT
    s.NewId AS StoreId,
    u.NewId AS UserId,
    ISNULL(src.CreatedAt, GETDATE())
FROM RE_SALE_20260410.dbo.StoreUsers src
INNER JOIN @InsertedStores s ON s.OldId = src.StoreId
INNER JOIN @InsertedUsers u ON u.OldId = src.UserId
WHERE NOT EXISTS (
    SELECT 1 FROM StoreUsers dst
    WHERE dst.StoreId = s.NewId AND dst.UserId = u.NewId
);

INSERT INTO @Summary
SELECT 'StoreUsers',
       @@ROWCOUNT,
       0,
       DATEDIFF(MILLISECOND, @t1, GETDATE());

PRINT '    Done. Rows inserted: ' + CAST(@@ROWCOUNT AS VARCHAR(20));
PRINT '';

-- ============================================================
-- BƯỚC 6: MERGE AUDITS
-- Map UserId và StoreId sang ID mới
-- ============================================================
PRINT '>>> STEP 6: Merging Audits...';
SET @t1 = GETDATE();

DECLARE @InsertedAudits TABLE (OldId INT, NewId INT);

INSERT INTO Audits (UserId, StoreId, Result, Notes, FailedReason, AuditDate, CreatedAt, UpdatedAt)
OUTPUT src.Id, inserted.Id INTO @InsertedAudits
SELECT
    u.NewId AS UserId,
    s.NewId AS StoreId,
    ISNULL(src.Result, 'audited'),
    src.Notes,
    src.FailedReason,
    src.AuditDate,
    ISNULL(src.CreatedAt, GETDATE()),
    ISNULL(src.UpdatedAt, GETDATE())
FROM RE_SALE_20260410.dbo.Audits src
INNER JOIN @InsertedUsers u ON u.OldId = src.UserId
INNER JOIN @InsertedStores s ON s.OldId = src.StoreId
WHERE NOT EXISTS (
    -- Tránh trùng audit cùng user + store + ngày
    SELECT 1 FROM Audits dst
    WHERE dst.UserId = u.NewId
      AND dst.StoreId = s.NewId
      AND CAST(dst.AuditDate AS DATE) = CAST(src.AuditDate AS DATE)
);

INSERT INTO @Summary
SELECT 'Audits',
       @@ROWCOUNT,
       0,
       DATEDIFF(MILLISECOND, @t1, GETDATE());

PRINT '    Done. Rows inserted: ' + CAST(@@ROWCOUNT AS VARCHAR(20));
PRINT '';

-- ============================================================
-- BƯỚC 7: MERGE IMAGES
-- Map AuditId sang ID mới
-- ============================================================
PRINT '>>> STEP 7: Merging Images...';
SET @t1 = GETDATE();

INSERT INTO Images (AuditId, ImageUrl, ReferenceImageUrl, Latitude, Longitude, CapturedAt, CreatedAt, UpdatedAt)
SELECT
    a.NewId AS AuditId,
    src.ImageUrl,
    src.ReferenceImageUrl,
    src.Latitude,
    src.Longitude,
    src.CapturedAt,
    ISNULL(src.CreatedAt, GETDATE()),
    ISNULL(src.UpdatedAt, GETDATE())
FROM RE_SALE_20260410.dbo.Images src
INNER JOIN @InsertedAudits a ON a.OldId = src.AuditId
WHERE NOT EXISTS (
    SELECT 1 FROM Images dst
    WHERE dst.AuditId = a.NewId
      AND dst.ImageUrl = src.ImageUrl
);

INSERT INTO @Summary
SELECT 'Images',
       @@ROWCOUNT,
       0,
       DATEDIFF(MILLISECOND, @t1, GETDATE());

PRINT '    Done. Rows inserted: ' + CAST(@@ROWCOUNT AS VARCHAR(20));
PRINT '';

-- ============================================================
-- BƯỚC 8: MERGE STORESURVEYS
-- Map StoreId, AuditId, UserId, CementProductId sang ID mới
-- ============================================================
PRINT '>>> STEP 8: Merging StoreSurveys...';
SET @t1 = GETDATE();

DECLARE @InsertedSurveys TABLE (OldId INT, NewId INT);

INSERT INTO StoreSurveys (
    StoreId, AuditId, UserId, CementProductId,
    ContactPerson, PurchasePrice, SellingPrice, SupplierName,
    RoadTransportFee, WaterTransportFee, ImportExportQuantity, StockQuantity,
    ConsumptionArea, DebtPeriod, WhyNotSellNewProduct, TimeToSellNewProduct,
    NewProductImportQuantity, ImportedBySalesperson, StoreComment,
    CreatedAt, UpdatedAt
)
OUTPUT src.Id, inserted.Id INTO @InsertedSurveys
SELECT
    s.NewId AS StoreId,
    a.NewId AS AuditId,
    u.NewId AS UserId,
    cp.Id AS CementProductId,
    src.ContactPerson,
    src.PurchasePrice,
    src.SellingPrice,
    src.SupplierName,
    src.RoadTransportFee,
    src.WaterTransportFee,
    src.ImportExportQuantity,
    src.StockQuantity,
    src.ConsumptionArea,
    src.DebtPeriod,
    src.WhyNotSellNewProduct,
    src.TimeToSellNewProduct,
    src.NewProductImportQuantity,
    src.ImportedBySalesperson,
    src.StoreComment,
    ISNULL(src.CreatedAt, GETDATE()),
    ISNULL(src.UpdatedAt, GETDATE())
FROM RE_SALE_20260410.dbo.StoreSurveys src
INNER JOIN @InsertedStores s ON s.OldId = src.StoreId
INNER JOIN @InsertedAudits a ON a.OldId = src.AuditId
INNER JOIN @InsertedUsers u ON u.OldId = src.UserId
LEFT JOIN CementProducts cp ON cp.Code = (SELECT Code FROM RE_SALE_20260410.dbo.CementProducts WHERE Id = src.CementProductId)
WHERE NOT EXISTS (
    -- Tránh trùng: cùng store + audit
    SELECT 1 FROM StoreSurveys dst
    WHERE dst.StoreId = s.NewId AND dst.AuditId = a.NewId
);

INSERT INTO @Summary
SELECT 'StoreSurveys',
       @@ROWCOUNT,
       0,
       DATEDIFF(MILLISECOND, @t1, GETDATE());

PRINT '    Done. Rows inserted: ' + CAST(@@ROWCOUNT AS VARCHAR(20));
PRINT '';

-- ============================================================
-- BƯỚC 9: MERGE STORESURVEYPRODUCTS
-- Map StoreSurveyId và CementProductId sang ID mới
-- ============================================================
PRINT '>>> STEP 9: Merging StoreSurveyProducts...';
SET @t1 = GETDATE();

INSERT INTO StoreSurveyProducts (
    StoreSurveyId, ProductType, CementProductId, SellingPrice,
    ContactPersonPhone, PurchasePrice, RoadTransportFee, WaterTransportFee,
    ImportedFromNPP, DiscountPromotion, AverageStockQuantity,
    CreatedAt
)
SELECT
    ss.NewId AS StoreSurveyId,
    src.ProductType,
    cp.Id AS CementProductId,
    src.SellingPrice,
    src.ContactPersonPhone,
    src.PurchasePrice,
    src.RoadTransportFee,
    src.WaterTransportFee,
    src.ImportedFromNPP,
    src.DiscountPromotion,
    src.AverageStockQuantity,
    ISNULL(src.CreatedAt, GETDATE())
FROM RE_SALE_20260410.dbo.StoreSurveyProducts src
INNER JOIN @InsertedSurveys ss ON ss.OldId = src.StoreSurveyId
LEFT JOIN CementProducts cp ON cp.Code = (SELECT Code FROM RE_SALE_20260410.dbo.CementProducts WHERE Id = src.CementProductId)
WHERE NOT EXISTS (
    -- Tránh trùng: cùng survey + product type
    SELECT 1 FROM StoreSurveyProducts dst
    WHERE dst.StoreSurveyId = ss.NewId
      AND ISNULL(dst.ProductType, '') = ISNULL(src.ProductType, '')
);

INSERT INTO @Summary
SELECT 'StoreSurveyProducts',
       @@ROWCOUNT,
       0,
       DATEDIFF(MILLISECOND, @t1, GETDATE());

PRINT '    Done. Rows inserted: ' + CAST(@@ROWCOUNT AS VARCHAR(20));
PRINT '';

-- ============================================================
-- BƯỚC 10: CẬP NHẬT USER CÓ PASSWORD PLACEHOLDER
-- Những user mới merge vào có IsChangePassword = 1
-- Admin có thể reset password hoặc user tự đổi
-- ============================================================
PRINT '>>> STEP 10: Flagging users needing password reset...';
SET @t1 = GETDATE();

UPDATE Users
SET IsChangePassword = 1
WHERE Password LIKE 'HASH_PLACEHOLDER_%';

INSERT INTO @Summary
SELECT 'Users_password_flagged',
       @@ROWCOUNT,
       0,
       DATEDIFF(MILLISECOND, @t1, GETDATE());

PRINT '    Done.';
PRINT '';

-- ============================================================
-- BƯỚC 11: CẬP NHẬT LẠI STATUS CỦA STORES
-- Dựa trên Audits mới merge
-- ============================================================
PRINT '>>> STEP 11: Refreshing store statuses...';
SET @t1 = GETDATE();

UPDATE s
SET s.Status = CASE
        WHEN latest.Result = 'fail' THEN 'failed'
        WHEN latest.Result = 'pass' THEN 'passed'
        ELSE 'audited'
    END,
    s.UpdatedAt = GETDATE()
FROM Stores s
INNER JOIN (
    SELECT a.StoreId, a.Result,
           ROW_NUMBER() OVER (PARTITION BY a.StoreId ORDER BY a.AuditDate DESC, a.Id DESC) AS rn
    FROM Audits a
) latest ON latest.StoreId = s.Id AND latest.rn = 1;

INSERT INTO @Summary
SELECT 'Stores_status_updated',
       0,
       @@ROWCOUNT,
       DATEDIFF(MILLISECOND, @t1, GETDATE());

PRINT '    Done. Stores updated: ' + CAST(@@ROWCOUNT AS VARCHAR(20));
PRINT '';

-- ============================================================
-- BƯỚC 12: CẬP NHẬT LẠI TerritoryId CHO STORES
-- Nếu store chưa có TerritoryId nhưng có UserId
-- ============================================================
PRINT '>>> STEP 12: Fixing missing TerritoryId for Stores...';
SET @t1 = GETDATE();

UPDATE s
SET s.TerritoryId = u.TerritoryId,
    s.UpdatedAt = GETDATE()
FROM Stores s
INNER JOIN RE_SALE_20260410.dbo.Stores src ON src.StoreName = s.StoreName
INNER JOIN Territories u ON u.TerritoryName = src.TerritoryName
WHERE s.TerritoryId IS NULL;

INSERT INTO @Summary
SELECT 'Stores_territory_fixed',
       0,
       @@ROWCOUNT,
       DATEDIFF(MILLISECOND, @t1, GETDATE());

PRINT '    Done.';
PRINT '';

-- ============================================================
-- KẾT QUẢ TỔNG HỢP
-- ============================================================
PRINT '============================================================';
PRINT 'MERGE COMPLETED SUCCESSFULLY!';
PRINT '============================================================';
PRINT '';
PRINT 'Summary:';
PRINT '------------------------------------------------------------';
PRINT FORMATMESSAGE('%-35s %10s %10s %10s', 'Step', 'Inserted', 'Updated', 'Duration(ms)');
PRINT '------------------------------------------------------------';

DECLARE @cur CURSOR;
DECLARE @step VARCHAR(100), @ins INT, @upd INT, @dur INT;
SET @cur = CURSOR FOR SELECT Step, RowsInserted, RowsUpdated, DurationMS FROM @Summary;
OPEN @cur;
FETCH NEXT FROM @cur INTO @step, @ins, @upd, @dur;
WHILE @@FETCH_STATUS = 0
BEGIN
    PRINT FORMATMESSAGE('%-35s %10d %10d %10d', @step, @ins, @upd, @dur);
    FETCH NEXT FROM @cur INTO @step, @ins, @upd, @dur;
END
CLOSE @cur;
DEALLOCATE @cur;

PRINT '------------------------------------------------------------';
PRINT 'Total duration: ' + CAST(DATEDIFF(MILLISECOND, @StartTime, GETDATE()) AS VARCHAR(20)) + ' ms';
PRINT 'Completed at: ' + CONVERT(VARCHAR(30), GETDATE(), 121);
PRINT '';
PRINT 'NOTE: Users with password HASH_PLACEHOLDER_* need password reset.';
PRINT '      Check: SELECT * FROM Users WHERE Password LIKE ''HASH_PLACEHOLDER_%''';
PRINT '';
PRINT '============================================================';
GO
