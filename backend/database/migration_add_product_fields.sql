-- Migration: Add new fields to StoreSurveyProducts for Title 3 (THÔNG TIN BÁN HÀNG)
-- Description: Thêm các trường mới cho mỗi sản phẩm trong Title 3
-- Date: 2025-01-XX

-- Add ContactPersonPhone field (Người tiếp xúc - Số điện thoại: Tên + SDT)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('StoreSurveyProducts') 
    AND name = 'ContactPersonPhone'
)
BEGIN
    ALTER TABLE StoreSurveyProducts
    ADD ContactPersonPhone NVARCHAR(200) NULL;
    PRINT 'Added column ContactPersonPhone to StoreSurveyProducts';
END
ELSE
BEGIN
    PRINT 'Column ContactPersonPhone already exists in StoreSurveyProducts';
END

-- Add PurchasePrice field (Giá mua vào)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('StoreSurveyProducts') 
    AND name = 'PurchasePrice'
)
BEGIN
    ALTER TABLE StoreSurveyProducts
    ADD PurchasePrice DECIMAL(18,2) NULL;
    PRINT 'Added column PurchasePrice to StoreSurveyProducts';
END
ELSE
BEGIN
    PRINT 'Column PurchasePrice already exists in StoreSurveyProducts';
END

-- Add RoadTransportFee field (Phí vận chuyển đường bộ)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('StoreSurveyProducts') 
    AND name = 'RoadTransportFee'
)
BEGIN
    ALTER TABLE StoreSurveyProducts
    ADD RoadTransportFee DECIMAL(18,2) NULL;
    PRINT 'Added column RoadTransportFee to StoreSurveyProducts';
END
ELSE
BEGIN
    PRINT 'Column RoadTransportFee already exists in StoreSurveyProducts';
END

-- Add WaterTransportFee field (Phí vận chuyển đường thủy)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('StoreSurveyProducts') 
    AND name = 'WaterTransportFee'
)
BEGIN
    ALTER TABLE StoreSurveyProducts
    ADD WaterTransportFee DECIMAL(18,2) NULL;
    PRINT 'Added column WaterTransportFee to StoreSurveyProducts';
END
ELSE
BEGIN
    PRINT 'Column WaterTransportFee already exists in StoreSurveyProducts';
END

-- Add QuantityReceived field (Số lượng nhận hàng - tấn/tháng)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('StoreSurveyProducts') 
    AND name = 'QuantityReceived'
)
BEGIN
    ALTER TABLE StoreSurveyProducts
    ADD QuantityReceived DECIMAL(18,2) NULL;
    PRINT 'Added column QuantityReceived to StoreSurveyProducts';
END
ELSE
BEGIN
    PRINT 'Column QuantityReceived already exists in StoreSurveyProducts';
END

-- Add ImportedFromNPP field (Nhập từ NPP)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('StoreSurveyProducts') 
    AND name = 'ImportedFromNPP'
)
BEGIN
    ALTER TABLE StoreSurveyProducts
    ADD ImportedFromNPP NVARCHAR(500) NULL;
    PRINT 'Added column ImportedFromNPP to StoreSurveyProducts';
END
ELSE
BEGIN
    PRINT 'Column ImportedFromNPP already exists in StoreSurveyProducts';
END

-- Add DiscountPromotion field (Chương trình chiết khấu - khuyến mãi)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('StoreSurveyProducts') 
    AND name = 'DiscountPromotion'
)
BEGIN
    ALTER TABLE StoreSurveyProducts
    ADD DiscountPromotion NVARCHAR(1000) NULL;
    PRINT 'Added column DiscountPromotion to StoreSurveyProducts';
END
ELSE
BEGIN
    PRINT 'Column DiscountPromotion already exists in StoreSurveyProducts';
END

-- Add AverageStockQuantity field (SLTTBQ - Số lượng tồn bình quân - tấn/tháng)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('StoreSurveyProducts') 
    AND name = 'AverageStockQuantity'
)
BEGIN
    ALTER TABLE StoreSurveyProducts
    ADD AverageStockQuantity DECIMAL(18,2) NULL;
    PRINT 'Added column AverageStockQuantity to StoreSurveyProducts';
END
ELSE
BEGIN
    PRINT 'Column AverageStockQuantity already exists in StoreSurveyProducts';
END

PRINT 'Migration completed successfully!';

