# Dashboard Setup Guide

## 1. Database Migration

Chạy migration script để tạo bảng Territories và cập nhật schema:

```sql
-- Chạy file: backend/database/migration_add_territories.sql
-- Hoặc chạy trực tiếp trong SQL Server Management Studio
```

Migration này sẽ:
- Tạo bảng `Territories` với 22 địa bàn phụ trách
- Thêm cột `TerritoryId` vào bảng `Users`
- Thêm cột `UserId` vào bảng `Stores`

## 2. Seed Sample Data

Để seed dữ liệu mẫu, thêm vào file `.env`:

```env
SEED_SAMPLE_DATA=true
```

Sau đó khởi động lại backend. Script sẽ tự động:
- Tạo 10 users (sale) với địa bàn phụ trách tương ứng
- Tạo 15 stores và gán cho users
- Tạo audits với images cho 2 users đầu tiên:
  - LÂM TẤT TOẠI: 5 ngày, 11 cửa hàng
  - NGUYỄN PHƯƠNG SƠN: 5 ngày, 13 cửa hàng

## 3. API Endpoints

### Dashboard Summary
```
GET /api/dashboard/summary
Query params:
  - territoryIds: comma-separated territory IDs (optional)
  - startDate: YYYY-MM-DD (optional)
  - endDate: YYYY-MM-DD (optional)
```

### User Detail
```
GET /api/dashboard/user/:userId
Query params:
  - startDate: YYYY-MM-DD (optional)
  - endDate: YYYY-MM-DD (optional)
```

### Export Report
```
GET /api/dashboard/export
Query params: same as summary
Returns: JSON data for Excel generation
```

### Territories
```
GET /api/territories
Returns: List of all territories
```

## 4. Frontend Features

### Dashboard
- Bar chart hiển thị 2 cột: Số ngày checkin và Số cửa hàng checkin
- Filter địa bàn phụ trách (multi-select với search)
- Filter thời gian (theo ngày hoặc tháng)
- Table tổng hợp với click vào tên user để xem chi tiết
- Nút "Tải báo cáo" để export Excel

### User Detail Page
- Hiển thị chi tiết checkin của user
- Table với các cột: Ngày, STT, NPP/Cửa hàng, Địa chỉ, Thời gian Checkin, Ghi chú
- Nút quay lại Dashboard

## 5. Excel Export

File Excel được tạo với:
- Sheet "Tổng hợp": Bảng tổng hợp với format màu sắc và border
- Các sheet "Chi tiết {tên user}": Bảng chi tiết cho từng user

## Notes

- Logic checkin: Chỉ tính khi Audit có ít nhất 1 Image với ImageUrl đầy đủ
- Store phải được gán UserId để hiển thị trong dashboard
- User phải có TerritoryId để filter theo địa bàn

