-- Migration: Add Status column to Stores table
-- Status values: 'not_audited', 'audited', 'passed', 'failed'

-- Check if column already exists, if not add it
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'Stores') AND name = 'Status')
BEGIN
    ALTER TABLE Stores
    ADD Status VARCHAR(20) NULL;
END

-- Update all NULL values to 'not_audited' first
UPDATE Stores
SET Status = 'not_audited'
WHERE Status IS NULL;

-- Add CHECK constraint if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_Stores_Status')
BEGIN
    ALTER TABLE Stores
    ADD CONSTRAINT CK_Stores_Status 
    CHECK (Status IN ('not_audited', 'audited', 'passed', 'failed'));
END

-- Update existing stores based on audit data
-- Priority: passed/failed > audited > not_audited

-- Step 1: Stores with pass result -> 'passed' (highest priority)
UPDATE s
SET s.Status = 'passed'
FROM Stores s
INNER JOIN Audits a ON s.Id = a.StoreId
WHERE a.Result = 'pass';

-- Step 2: Stores with fail result -> 'failed' (highest priority)
UPDATE s
SET s.Status = 'failed'
FROM Stores s
INNER JOIN Audits a ON s.Id = a.StoreId
WHERE a.Result = 'fail';

-- Step 3: Stores with audits and images but no pass/fail result -> 'audited'
UPDATE s
SET s.Status = 'audited'
FROM Stores s
INNER JOIN Audits a ON s.Id = a.StoreId
INNER JOIN Images i ON a.Id = i.AuditId
WHERE s.Status NOT IN ('passed', 'failed');

-- Step 4: Stores with audits but no images -> keep as 'not_audited' or 'audited' based on existing status
-- (This step is handled by the logic above)

-- Create index for better query performance if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Stores_Status' AND object_id = OBJECT_ID(N'Stores'))
BEGIN
    CREATE INDEX IX_Stores_Status ON Stores(Status);
END

