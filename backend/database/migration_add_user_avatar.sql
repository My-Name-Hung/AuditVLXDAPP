-- Migration: Add Avatar column to Users table
-- Date: 2025-01-XX

-- Add Avatar column to Users table
ALTER TABLE Users
ADD Avatar NVARCHAR(500) NULL;

-- Add comment
EXEC sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'URL to user avatar image stored in Cloudinary', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'Users', 
    @level2type = N'COLUMN', @level2name = N'Avatar';

PRINT 'Migration completed: Added Avatar column to Users table';

