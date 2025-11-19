-- Migration: Add Position column to Users table
IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE Name = 'Position'
      AND Object_ID = Object_ID('Users')
)
BEGIN
    ALTER TABLE Users
    ADD Position NVARCHAR(200) NULL;

    UPDATE Users
    SET Position = CASE 
        WHEN Role = 'admin' THEN N'Quản trị Viên'
        ELSE N'Nhân viên Thị Trường'
    END
    WHERE Position IS NULL;
END
GO

PRINT 'Users.Position column added/updated successfully.';

