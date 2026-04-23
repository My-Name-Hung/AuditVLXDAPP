-- ============================================================
-- Script: Add WorkPosition column to Users table
-- Mục đích: Thêm trường "Vị trí công tác" (WorkPosition) cho bảng Users
--           và tự động set giá trị mặc định là "Công ty Xi Măng Tây Đô"
--           cho tất cả user hiện có.
-- ============================================================

-- Bước 1: Thêm cột WorkPosition (NVARCHAR, NULL) vào bảng Users
IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Users'
      AND COLUMN_NAME = 'WorkPosition'
)
BEGIN
    ALTER TABLE Users
    ADD WorkPosition NVARCHAR(200) NULL;

    PRINT 'Added column WorkPosition to Users table.';
END
ELSE
BEGIN
    PRINT 'Column WorkPosition already exists in Users table. Skipping ADD.';
END
GO

-- Bước 2: Cập nhật WorkPosition mặc định cho tất cả user hiện có
-- Tất cả nhân viên đều công tác tại "Công ty Xi Măng Tây Đô"
UPDATE Users
SET WorkPosition = N'Công ty Xi Măng Tây Đô',
    UpdatedAt = GETDATE()
WHERE WorkPosition IS NULL OR LTRIM(RTRIM(WorkPosition)) = '';

PRINT 'Updated WorkPosition to N''Công ty Xi Măng Tây Đô'' for all existing users.';
GO

-- Bước 3 (tùy chọn): Thêm constraint NOT NULL nếu muốn bắt buộc nhập WorkPosition
-- Uncomment dòng dưới nếu muốn WorkPosition không được NULL
-- ALTER TABLE Users ALTER COLUMN WorkPosition NVARCHAR(200) NOT NULL;
-- PRINT 'Set WorkPosition as NOT NULL.';
GO

-- Kiểm tra kết quả
SELECT TOP 10
    Id,
    UserCode,
    FullName,
    Position AS ChucVu,
    WorkPosition AS ViTriCongTac
FROM Users
ORDER BY Id DESC;
GO
