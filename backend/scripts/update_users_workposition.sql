--   1. Xóa tất cả WorkPosition hiện tại của Users
--   2. Set tất cả nhân viên hiện tại = "Công ty Cổ phần Xi Măng Tây Đô"
--   3. Thêm mới 1 vị trí "Công ty Cổ phần Bê Tông Tây Đô" (dùng tạm cho user mới)
--   4. User nào thuộc Bê Tông thì update sau=

-- Bước 1: Cập nhật tất cả WorkPosition hiện tại về "Công ty Cổ phần Xi Măng Tây Đô"
UPDATE Users
SET WorkPosition = N'Công ty Cổ phần Xi Măng Tây Đô',
    UpdatedAt = GETDATE()
WHERE WorkPosition IS NULL OR LTRIM(RTRIM(WorkPosition)) = '';

PRINT N'Cap nhat thanh cong WorkPosition cho cac user hien co.';
GO

-- Bước 2: (Tùy chọn) Nếu muốn gán user cụ thể sang Bê Tông, chạy lệnh sau:
-- Ví dụ: UPDATE Users SET WorkPosition = N'Công ty Cổ phần Bê Tông Tây Đô' WHERE UserCode = 'U000001';
-- Thay U000001 bằng mã nhân viên thực tế.

-- Bước 3: Kiểm tra kết quả
SELECT TOP 20
    Id,
    UserCode,
    FullName,
    Position AS ChucVu,
    WorkPosition AS ViTriCongTac,
    UpdatedAt
FROM Users
ORDER BY Id DESC;
GO

-- Bước 4: Xem tổng số nhân viên theo từng đơn vị công tác
SELECT
    WorkPosition AS DonViCongTac,
    COUNT(*) AS SoLuongNhanVien
FROM Users
WHERE WorkPosition IS NOT NULL AND LTRIM(RTRIM(WorkPosition)) <> ''
GROUP BY WorkPosition
ORDER BY WorkPosition;
GO
