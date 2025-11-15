-- Migration: Add Status column to Stores table
-- Status values: 'not_audited', 'audited', 'passed', 'failed'

-- Add Status column with default value
ALTER TABLE Stores
ADD Status VARCHAR(20) DEFAULT 'not_audited';

-- Add CHECK constraint
ALTER TABLE Stores
ADD CONSTRAINT CK_Stores_Status 
CHECK (Status IN ('not_audited', 'audited', 'passed', 'failed'));

-- Update existing stores based on audit data
-- Stores with audits and images -> 'audited'
UPDATE s
SET s.Status = 'audited'
FROM Stores s
INNER JOIN Audits a ON s.Id = a.StoreId
INNER JOIN Images i ON a.Id = i.AuditId
WHERE s.Status = 'not_audited';

-- Stores with pass result -> 'passed'
UPDATE s
SET s.Status = 'passed'
FROM Stores s
INNER JOIN Audits a ON s.Id = a.StoreId
WHERE a.Result = 'pass' AND s.Status != 'passed';

-- Stores with fail result -> 'failed'
UPDATE s
SET s.Status = 'failed'
FROM Stores s
INNER JOIN Audits a ON s.Id = a.StoreId
WHERE a.Result = 'fail' AND s.Status != 'failed';

-- Create index for better query performance
CREATE INDEX IX_Stores_Status ON Stores(Status);

