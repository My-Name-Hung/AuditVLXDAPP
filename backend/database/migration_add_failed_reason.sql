-- Migration: Add FailedReason field to Stores table
-- This field stores the reason when a store is marked as "failed"
-- It should be NULL for stores with other statuses

ALTER TABLE Stores
ADD FailedReason NVARCHAR(1000) NULL;

-- Add comment/description (SQL Server doesn't support comments on columns directly, but we can document it here)
-- FailedReason: Stores the reason why a store failed the audit. Only populated when Status = 'failed', otherwise NULL.

