-- Seed Data: 45 sản phẩm xi măng mẫu
-- Description: Import dữ liệu mẫu cho bảng CementProducts
-- Date: 2025-01-XX

-- Xóa dữ liệu cũ (nếu có)
DELETE FROM CementProducts;

-- Insert 45 sản phẩm xi măng
INSERT INTO CementProducts (Code, Name) VALUES
('801002022', N'Xi măng xá Tây Đô Xỉ lò cao PCB BFS40'),
('801002023', N'Xi măng xá Tây Đô Xỉ lò cao PCB BFS50'),
('801002028', N'Xi măng xá Tây Đô Công trình PCB40'),
('801002029', N'Xi măng xá Tây Đô PCB50'),
('801002030', N'Xi măng xá Jumbo Tây Đô PCB40'),
('801002031', N'Xi măng xá Jumbo Tây Đô Xỉ lò cao PCB BFS40'),
('801002044', N'Xi măng xá Tây Đô Xỉ lò cao PCB BFS40 loại II'),
('801002045', N'Xi măng xá Tây Đô Xỉ lò cao PCB BFS50 loại II'),
('801002047', N'Xi măng xá Tây Đô Xỉ lò cao PCB BFS40 loại I'),
('801002048', N'Xi măng xá Tây Đô Xỉ lò cao PCB BFS50 loại I'),
('802002024', N'Xi măng bao Tây Đô Export PCB40 (Đỏ)'),
('802002025', N'Xi măng bao Tây Đô Đa dụng PCB40'),
('802002029', N'Xi măng bao Tây Đô Cao cấp PCB40'),
('802002030', N'Xi măng bao Tây Đô Export Cao cấp PCB40'),
('802002033', N'Xi măng bao Hà Tiên 2-Cần Thơ PCB40'),
('802002034', N'Xi măng bao Tây Đô PCB40 (Xanh)'),
('802002035', N'Xi măng bao Jumbo Tây Đô PCB50'),
('802002036', N'Xi măng bao Tây Đô Bền sun phát PCB BFS40-HS'),
('802002037', N'Xi măng bao Tây Đô PCB40 (Đỏ)'),
('802002038', N'Xi măng bao Jumbo Tây Đô PCB40'),
('802002039', N'Xi măng bao Hà Tiên 2-Cần Thơ PCB40 Chất lượng cao'),
('802002040', N'Xi măng bao Hà Tiên 2-Cần Thơ PCB40 Đa dụng (Xanh)'),
('802002044', N'Xi măng bao Jumbo Tây Đô Xỉ lò cao PCB BFS40'),
('802002045', N'Xi măng bao Jumbo Tây Đô Xỉ lò cao PCB BFS50'),
('802002048', N'Xi măng bao Hà Tiên 2-Cần Thơ Bền sun phát PCB BFS40-HS'),
('802002049', N'Xi măng bao Hà Tiên 2-Cần Thơ Bền sun phát PCB BFS50-HS'),
('802002052', N'Xi măng bao Hà Tiên 2 - Cần Thơ PCB40 Cao cấp (Đỏ)'),
('802002053', N'Xi măng bao Hà Tiên 2-Cần Thơ PCB40 Đa dụng (Đỏ)'),
('802002054', N'Xi măng bao Hà Tiên 2-Cần Thơ Export PCB40 (Xanh)'),
('802002055', N'Xi măng bao Hà Tiên 2-Cần Thơ Export PCB40 (Đỏ)'),
('802002060', N'Xi măng bao Hà Tiên Taceco PCB40 Đa dụng'),
('802002061', N'Xi măng bao Hà Tiên Taceco PCB40 Đa dụng-TL'),
('802002062', N'Xi măng bao Hà Tiên Taceco PCB40 Đa dụng - KP'),
('802002063', N'Xi măng bao Hà Tiên Taceco PCB40 - KP'),
('802002064', N'Xi măng bao Hà Tiên Taceco PCB40 Đa dụng-FC'),
('802002065', N'Xi măng bao Hà Tiên Taceco PCB40'),
('802002070', N'Xi măng bao Tây Đô PCB40 Dân dụng PP (Xanh)'),
('802002071', N'Xi măng bao Tây Đô PCB40 Dân dụng PP (Đỏ)'),
('802002072', N'Xi măng bao Hà Tiên 2 PCB40 Dân dụng (Xanh)'),
('802002073', N'Xi măng bao Hà Tiên 2 PCB40 Dân dụng (Đỏ)'),
('802002074', N'Xi măng bao Hà Tiên 2 PCB40 Đa dụng (Xanh)'),
('802002075', N'Xi măng bao Hà Tiên 2 PCB40 Đa dụng (Đỏ)');

PRINT 'Inserted 45 cement products';

-- Verify
SELECT COUNT(*) as TotalProducts FROM CementProducts;

