-- Migration: Fix Audits.Result constraint to allow 'audited', 'pass', 'fail'
-- This script will drop all existing Result constraints and recreate the correct one

-- Step 1: Find and drop ALL existing CHECK constraints on Audits.Result
DECLARE @constraintName NVARCHAR(200);
DECLARE @sql NVARCHAR(MAX);

-- Find all constraints on Audits.Result
DECLARE constraint_cursor CURSOR FOR
SELECT cc.name
FROM sys.check_constraints cc
INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
INNER JOIN sys.columns c ON cc.parent_column_id = c.column_id AND cc.parent_object_id = c.object_id
WHERE t.name = 'Audits'
  AND c.name = 'Result';

OPEN constraint_cursor;
FETCH NEXT FROM constraint_cursor INTO @constraintName;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'ALTER TABLE Audits DROP CONSTRAINT [' + @constraintName + N']';
    PRINT 'Dropping constraint: ' + @constraintName;
    EXEC sp_executesql @sql;
    FETCH NEXT FROM constraint_cursor INTO @constraintName;
END;

CLOSE constraint_cursor;
DEALLOCATE constraint_cursor;
GO

-- Step 2: Add the new constraint allowing 'audited', 'pass', 'fail'
-- Check if constraint already exists (should not, but safe check)
IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints cc
    INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
    WHERE t.name = 'Audits'
      AND cc.name = 'CK_Audits_Result'
)
BEGIN
    ALTER TABLE Audits
    ADD CONSTRAINT CK_Audits_Result
    CHECK (Result IN ('audited', 'pass', 'fail'));
    
    PRINT 'Constraint CK_Audits_Result created successfully.';
END
ELSE
BEGIN
    PRINT 'Constraint CK_Audits_Result already exists.';
END
GO

-- Step 3: Verify the constraint
IF EXISTS (
    SELECT 1
    FROM sys.check_constraints cc
    INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
    WHERE t.name = 'Audits'
      AND cc.name = 'CK_Audits_Result'
)
BEGIN
    PRINT 'Verification: CK_Audits_Result constraint exists and allows (audited, pass, fail).';
END
ELSE
BEGIN
    PRINT 'ERROR: CK_Audits_Result constraint was not created.';
END
GO

