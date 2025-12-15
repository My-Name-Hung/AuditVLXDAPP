-- Migration: Allow 'cement' type in ImportHistory
-- This migration updates the CHECK constraint on ImportHistory.Type
-- to support logging import history for cement products.

IF EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_ImportHistory_Type'
    AND parent_object_id = OBJECT_ID('ImportHistory')
)
BEGIN
  ALTER TABLE ImportHistory
  DROP CONSTRAINT CK_ImportHistory_Type;
END
GO

ALTER TABLE ImportHistory
ADD CONSTRAINT CK_ImportHistory_Type
CHECK (Type IN ('stores', 'users', 'cement'));
GO


