# Environment Variables Setup Guide

Hướng dẫn cấu hình environment variables cho toàn bộ hệ thống Auditapp.

## 📁 Cấu trúc Files

```
Auditapp/
├── backend/
│   └── .env-example          # Backend environment variables
├── AdminAuditapp/
│   └── .env-example          # Admin Web environment variables
└── .env-example              # Mobile App environment variables
```

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend
cp .env-example .env
# Chỉnh sửa .env với thông tin thực tế của bạn
```

**Các biến bắt buộc:**
- `DB_SERVER`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - Database connection
- `JWT_SECRET` - JWT secret key (tối thiểu 32 ký tự)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` - Cloudinary config

### 2. Admin Web Setup

```bash
cd AdminAuditapp
cp .env-example .env
# Chỉnh sửa VITE_API_BASE_URL
```

**Các biến bắt buộc:**
- `VITE_API_BASE_URL` - URL của backend API

**Development:**
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

**Production (Render):**
```env
VITE_API_BASE_URL=https://your-backend.onrender.com/api
```

### 3. Mobile App Setup

```bash
# Ở root directory
cp .env-example .env
# Chỉnh sửa EXPO_PUBLIC_API_BASE_URL
```

**Các biến bắt buộc:**
- `EXPO_PUBLIC_API_BASE_URL` - URL của backend API

**Development (Local):**
```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

**Development (Physical Device):**
```env
# Sử dụng IP local của máy tính
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:3000/api
```

**Production (Render):**
```env
EXPO_PUBLIC_API_BASE_URL=https://your-backend.onrender.com/api
```

## 🔍 Kiểm tra Configuration

### Backend

Sau khi start backend, kiểm tra console logs:

```
==================================================
🚀 Auditapp Backend Server
📍 Running on port 3000
🌍 Environment: development
==================================================
🔧 Initializing services...
🔌 Connecting to SQL Server: your-server:1433/auditapp_db...
✅ Connected to SQL Server database successfully
✅ Database connection initialized successfully
✅ Cloudinary configuration loaded successfully
✅ JWT configuration loaded
==================================================
✅ Server ready! Health check: http://localhost:3000/health
==================================================
```

Kiểm tra health endpoint:
```bash
curl http://localhost:3000/health
```

### Frontend

Sau khi start frontend, kiểm tra network requests trong browser console để đảm bảo API calls thành công.

## 🚨 Common Issues

### Backend không kết nối được database

**Lỗi**: `❌ Database connection error`

**Giải pháp**:
1. Kiểm tra `.env` file có đầy đủ thông tin không
2. Kiểm tra database server có đang chạy không
3. Kiểm tra firewall có block connection không
4. Với Azure SQL: Kiểm tra firewall rules

### Frontend không gọi được API

**Lỗi**: CORS error hoặc Network error

**Giải pháp**:
1. Kiểm tra `VITE_API_BASE_URL` hoặc `EXPO_PUBLIC_API_BASE_URL` đúng chưa
2. Kiểm tra backend có đang chạy không
3. Kiểm tra CORS_ORIGIN trong backend `.env`
4. Với mobile app trên device: Sử dụng IP local thay vì localhost

### Cloudinary upload không hoạt động

**Lỗi**: `⚠️ Cloudinary not configured`

**Giải pháp**:
1. Kiểm tra 3 biến Cloudinary trong backend `.env`
2. Lấy credentials từ [Cloudinary Console](https://cloudinary.com/console)

## 📝 Notes

- **Không commit file `.env` vào git** - Chỉ commit `.env-example`
- **JWT_SECRET** phải là chuỗi ngẫu nhiên mạnh, tối thiểu 32 ký tự
- **Production**: Sử dụng environment variables trong hosting platform (Render, Vercel, etc.)
- **Mobile App**: Với Expo, biến môi trường phải có prefix `EXPO_PUBLIC_`
- **Vite**: Với Vite, biến môi trường phải có prefix `VITE_`

## 🔐 Security

1. **Backend `.env`**: Chứa thông tin nhạy cảm (database, JWT secret, Cloudinary)
2. **Frontend `.env`**: Chỉ chứa API URL (không nhạy cảm vì sẽ được bundle vào code)
3. **Git**: Đảm bảo `.env` đã được thêm vào `.gitignore`

## 📚 Tham khảo

- [Backend Deployment Guide](./backend/DEPLOYMENT.md) - Hướng dẫn deploy lên Render
- [Backend README](./backend/README.md) - Chi tiết về backend API
- [Admin Web README](./AdminAuditapp/README.md) - Chi tiết về admin web

