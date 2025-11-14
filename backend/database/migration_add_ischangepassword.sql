-- Migration: Add IsChangePassword field to Users table

-- Add IsChangePassword to Users table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND name = 'IsChangePassword')
BEGIN
    ALTER TABLE Users ADD IsChangePassword BIT DEFAULT 1;
    -- Set default to 1 (true) for existing users with default password
    UPDATE Users SET IsChangePassword = 1 WHERE Password LIKE '%$2a$10%' OR Password = '123456';
END
GO

