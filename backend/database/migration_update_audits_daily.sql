-- Migration: Support daily audit statuses with failed reason
-- - Allow Audits.Result to store 'audited', 'pass', 'fail'
-- - Add FailedReason column to Audits table

-- Drop existing constraint on Audits.Result (unknown name)
DECLARE @constraintName NVARCHAR(200);

SELECT @constraintName = cc.name
FROM sys.check_constraints cc
INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
WHERE t.name = 'Audits'
  AND cc.definition LIKE '%Result%';

IF @constraintName IS NOT NULL
BEGIN
    DECLARE @sql NVARCHAR(MAX) = N'ALTER TABLE Audits DROP CONSTRAINT [' + @constraintName + N']';
    EXEC sp_executesql @sql;
END
GO

-- Add FailedReason column if missing
IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'Audits')
      AND name = 'FailedReason'
)
BEGIN
    ALTER TABLE Audits
    ADD FailedReason NVARCHAR(1000) NULL;
END
GO

-- Re-create constraint to allow audited/pass/fail
ALTER TABLE Audits
ADD CONSTRAINT CK_Audits_Result
CHECK (Result IN ('audited', 'pass', 'fail'));
GO

PRINT 'Audits table updated: Result constraint extended and FailedReason column added.';

