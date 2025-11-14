# Quản lý thương vụ XMTĐ - Backend API

Backend API cho hệ thống Quản lý thương vụ XMTĐ sử dụng Node.js, Express, và SQL Server.

## Cài đặt

1. Cài đặt dependencies:
```bash
npm install
```

2. Tạo file `.env` từ `.env.example` và cấu hình:
```bash
cp .env.example .env
```

3. Cấu hình các biến môi trường trong file `.env`:
- Database SQL Server
- JWT Secret
- Cloudinary credentials

4. Tạo database và chạy schema:
```bash
# Chạy file backend/database/schema.sql trên SQL Server
```

5. Khởi động server:
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/refresh` - Refresh token

### Users
- `GET /api/users` - Lấy danh sách users
- `GET /api/users/:id` - Lấy user theo ID
- `POST /api/users` - Tạo user mới
- `PUT /api/users/:id` - Cập nhật user
- `DELETE /api/users/:id` - Xóa user

### Stores
- `GET /api/stores` - Lấy danh sách stores
- `GET /api/stores/:id` - Lấy store theo ID
- `POST /api/stores` - Tạo store mới
- `PUT /api/stores/:id` - Cập nhật store
- `DELETE /api/stores/:id` - Xóa store

### Audits
- `GET /api/audits` - Lấy danh sách audits (có thể filter theo userId, storeId, result)
- `GET /api/audits/:id` - Lấy audit theo ID
- `POST /api/audits` - Tạo audit mới
- `PUT /api/audits/:id` - Cập nhật audit
- `DELETE /api/audits/:id` - Xóa audit

### Images
- `POST /api/images/upload` - Upload ảnh với watermark (multipart/form-data)
- `GET /api/images/audit/:auditId` - Lấy ảnh theo audit ID
- `GET /api/images/:id` - Lấy ảnh theo ID
- `DELETE /api/images/:id` - Xóa ảnh

## Cấu trúc thư mục

```
backend/
├── config/          # Cấu hình database, cloudinary
├── controllers/     # Controllers xử lý logic
├── middlewares/     # Middleware (auth, etc.)
├── models/          # Models tương tác với database
├── routes/          # Định nghĩa routes
├── services/        # Services (Cloudinary, etc.)
├── database/        # SQL schema
└── index.js         # Entry point
```

## Tính năng

- ✅ Authentication với JWT
- ✅ Auto-generate UserCode (U000001, U000002, ...)
- ✅ Auto-generate StoreCode (CH000001, CH000002, ...)
- ✅ Upload ảnh lên Cloudinary với watermark (lat/lon/time)
- ✅ Kết nối SQL Server qua mssql
- ✅ RESTful API đầy đủ CRUD

