-- Migration: Add Rank, TaxCode, PartnerName columns to Stores table
-- Fixed version with proper constraint handling

-- Step 1: Add Rank column (Cấp cửa hàng: 1 = Cấp 1, 2 = Cấp 2)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Stores') AND name = 'Rank')
BEGIN
    ALTER TABLE Stores
    ADD Rank INT NULL;
END
GO

-- Step 2: Add CHECK constraint for Rank if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_Stores_Rank')
BEGIN
    ALTER TABLE Stores
    ADD CONSTRAINT CK_Stores_Rank 
    CHECK (Rank IN (1, 2) OR Rank IS NULL);
END
GO

-- Step 3: Add TaxCode column (Mã số thuế)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Stores') AND name = 'TaxCode')
BEGIN
    ALTER TABLE Stores
    ADD TaxCode VARCHAR(50) NULL;
END
GO

-- Step 4: Add PartnerName column (Tên đối tác)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Stores') AND name = 'PartnerName')
BEGIN
    ALTER TABLE Stores
    ADD PartnerName NVARCHAR(200) NULL;
END
GO

