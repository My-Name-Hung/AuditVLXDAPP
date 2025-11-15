-- Update sample data for existing stores
-- This script adds sample Rank, TaxCode, and PartnerName for testing purposes

-- Update stores with sample data
-- Rank: 1 for stores with "VLXD" in name (Đơn vị, tổ chức), 2 for others (Cá nhân)
-- TaxCode: Generate sample tax codes based on Rank
-- PartnerName: Generate sample partner names based on Rank

UPDATE Stores
SET 
    Rank = CASE 
        WHEN StoreName LIKE '%VLXD%' THEN 1  -- VLXD stores get Rank 1 (Đơn vị, tổ chức)
        ELSE 2                                -- Other stores get Rank 2 (Cá nhân)
    END,
    TaxCode = CASE 
        WHEN StoreName LIKE '%VLXD%' THEN '010' + RIGHT('0000000' + CAST(Id AS VARCHAR), 7) + CAST((Id % 10) AS VARCHAR)
        ELSE '020' + RIGHT('0000000' + CAST(Id AS VARCHAR), 7) + CAST((Id % 10) AS VARCHAR)
    END,
    PartnerName = CASE 
        WHEN StoreName LIKE '%VLXD%' THEN 'Công ty TNHH ' + StoreName
        ELSE 'Ông/Bà ' + StoreName
    END
WHERE Rank IS NULL OR TaxCode IS NULL OR PartnerName IS NULL;

-- Verify the update
SELECT 
    Id,
    StoreCode,
    StoreName,
    Rank,
    CASE 
        WHEN Rank = 1 THEN 'Đơn vị, tổ chức'
        WHEN Rank = 2 THEN 'Cá nhân'
        ELSE 'N/A'
    END AS LoaiDoiTuong,
    TaxCode,
    PartnerName,
    Status
FROM Stores
ORDER BY Id;

