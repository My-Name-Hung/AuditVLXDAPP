-- Migration: Add StoreComment and AverageMonthlyConsumption fields to StoreSurveys
-- Description: Thêm trường ý kiến cửa hàng và SLTTBQ (tấn/tháng) cho Title 2
-- Date: 2025-01-XX

-- Add StoreComment field (Ý kiến của cửa hàng - Title 2)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('StoreSurveys') 
    AND name = 'StoreComment'
)
BEGIN
    ALTER TABLE StoreSurveys
    ADD StoreComment NVARCHAR(1000) NULL;
    PRINT 'Added column StoreComment to StoreSurveys';
END
ELSE
BEGIN
    PRINT 'Column StoreComment already exists in StoreSurveys';
END

-- Add AverageMonthlyConsumption field (SLTTBQ - tấn/tháng - Title 2)
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('StoreSurveys') 
    AND name = 'AverageMonthlyConsumption'
)
BEGIN
    ALTER TABLE StoreSurveys
    ADD AverageMonthlyConsumption DECIMAL(18,2) NULL;
    PRINT 'Added column AverageMonthlyConsumption to StoreSurveys';
END
ELSE
BEGIN
    PRINT 'Column AverageMonthlyConsumption already exists in StoreSurveys';
END

PRINT 'Migration completed successfully!';

