-- Kiểm tra xem user U000026 có thực hiện survey hay không
SELECT 
    CASE 
        WHEN COUNT(ss.Id) > 0 THEN 'Có'
        ELSE 'Không'
    END AS HasSurveys,
    COUNT(ss.Id) AS TotalSurveys
FROM Users u
LEFT JOIN StoreSurveys ss ON u.Id = ss.UserId
WHERE u.UserCode = 'U000026';


-- Lấy danh sách chi tiết các cửa hàng mà user U000026 đã khảo sát
SELECT 
    u.UserCode,
    u.FullName AS UserName,
    ss.Id AS SurveyId,
    ss.CreatedAt AS SurveyDate,
    s.StoreCode,
    s.StoreName,
    s.Address AS StoreAddress,
    s.Status AS StoreStatus,
    cp.Code AS CementProductCode,
    cp.Name AS CementProductName,
    ss.ContactPerson,
    ss.PurchasePrice,
    ss.SellingPrice,
    ss.SupplierName,
    ss.WhyNotSellNewProduct,
    ss.NewProductImportQuantity,
    ss.StoreComment,
    a.AuditDate,
    a.Result AS AuditResult
FROM Users u
INNER JOIN StoreSurveys ss ON u.Id = ss.UserId
INNER JOIN Stores s ON ss.StoreId = s.Id
LEFT JOIN CementProducts cp ON ss.CementProductId = cp.Id
LEFT JOIN Audits a ON ss.AuditId = a.Id
WHERE u.UserCode = 'U000026'
ORDER BY ss.CreatedAt DESC;

-- Thống kê số lượng survey của user U000026
SELECT 
    u.UserCode,
    u.FullName AS UserName,
    COUNT(ss.Id) AS TotalSurveys,
    COUNT(DISTINCT ss.StoreId) AS TotalStores,
    MIN(ss.CreatedAt) AS FirstSurveyDate,
    MAX(ss.CreatedAt) AS LastSurveyDate,
    COUNT(CASE WHEN ss.CementProductId IS NOT NULL THEN 1 END) AS SurveysWithCementProduct,
    COUNT(CASE WHEN ss.WhyNotSellNewProduct IS NOT NULL THEN 1 END) AS SurveysWithXMTDInfo
FROM Users u
LEFT JOIN StoreSurveys ss ON u.Id = ss.UserId
WHERE u.UserCode = 'U000026'
GROUP BY u.UserCode, u.FullName;