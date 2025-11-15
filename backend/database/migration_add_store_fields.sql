-- Migration: Add Rank, TaxCode, PartnerName columns to Stores table

-- Add Rank column (Cấp cửa hàng: 1 = Cấp 1, 2 = Cấp 2)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Stores') AND name = 'Rank')
BEGIN
    ALTER TABLE Stores
    ADD Rank INT NULL;
    
    ALTER TABLE Stores
    ADD CONSTRAINT CK_Stores_Rank 
    CHECK (Rank IN (1, 2));
END

-- Add TaxCode column (Mã số thuế)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Stores') AND name = 'TaxCode')
BEGIN
    ALTER TABLE Stores
    ADD TaxCode VARCHAR(50) NULL;
END

-- Add PartnerName column (Tên đối tác)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Stores') AND name = 'PartnerName')
BEGIN
    ALTER TABLE Stores
    ADD PartnerName NVARCHAR(200) NULL;
END

