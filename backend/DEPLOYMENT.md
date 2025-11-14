# Deployment Guide - Render

Hướng dẫn deploy backend lên Render.com

## 📋 Prerequisites

1. Tài khoản Render.com
2. Database SQL Server (Azure SQL Database hoặc SQL Server instance)
3. Tài khoản Cloudinary (cho upload ảnh)

## 🚀 Bước 1: Chuẩn bị Database

1. Tạo SQL Server database (Azure SQL Database hoặc SQL Server)
2. Chạy file `database/schema.sql` để tạo tables
3. Lưu thông tin kết nối:
   - Server name
   - Port (thường là 1433)
   - Username
   - Password
   - Database name

## 🔧 Bước 2: Deploy Backend lên Render

### 2.1. Tạo Web Service trên Render

1. Đăng nhập vào [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect repository GitHub/GitLab của bạn
4. Cấu hình:
   - **Name**: `auditapp-backend` (hoặc tên bạn muốn)
   - **Environment**: `Node`
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Root Directory**: `backend` (nếu repo ở root) hoặc để trống nếu repo chỉ có backend

### 2.2. Cấu hình Environment Variables

Trong Render Dashboard → Environment, thêm các biến sau:

```env
# Server
NODE_ENV=production
PORT=10000

# Database
DB_SERVER=your-server.database.windows.net
DB_PORT=1433
DB_USER=your-username
DB_PASSWORD=your-password
DB_NAME=auditapp_db
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=false

# JWT
JWT_SECRET=your-very-strong-secret-key-minimum-32-characters-long
JWT_EXPIRES_IN=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# CORS (quan trọng!)
# Thêm URL của frontend web và mobile app
CORS_ORIGIN=https://your-admin-web.onrender.com,https://your-mobile-app-domain.com
```

**Lưu ý quan trọng:**

- `PORT`: Render tự động set PORT, nhưng bạn có thể set PORT=10000
- `JWT_SECRET`: Phải là chuỗi ngẫu nhiên mạnh, tối thiểu 32 ký tự
- `CORS_ORIGIN`: Phải set đúng URL frontend để tránh lỗi CORS

### 2.3. Deploy

1. Click "Create Web Service"
2. Render sẽ tự động build và deploy
3. Đợi quá trình deploy hoàn tất
4. Lưu URL của service (ví dụ: `https://auditapp-backend.onrender.com`)

## ✅ Bước 3: Kiểm tra Deployment

1. Truy cập health check endpoint:

   ```
   https://your-backend.onrender.com/health
   ```

2. Response mong đợi:

   ```json
   {
     "status": "OK",
     "message": "Auditapp Backend is running",
     "timestamp": "2024-01-01T00:00:00.000Z",
     "services": {
       "database": "connected",
       "cloudinary": "configured"
     }
   }
   ```

3. Kiểm tra logs trong Render Dashboard để xem:
   - ✅ Database connection status
   - ✅ Cloudinary configuration status
   - ✅ JWT configuration status

## 🔍 Troubleshooting

### Database Connection Failed

**Lỗi**: `❌ Database connection error`

**Giải pháp**:

1. Kiểm tra firewall của SQL Server có cho phép IP của Render
2. Với Azure SQL Database: Thêm firewall rule cho Azure services
3. Kiểm tra lại DB_SERVER, DB_USER, DB_PASSWORD trong Environment Variables
4. Kiểm tra DB_ENCRYPT và DB_TRUST_SERVER_CERTIFICATE settings

### Cloudinary Not Configured

**Lỗi**: `⚠️ Cloudinary not configured`

**Giải pháp**:

1. Kiểm tra CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
2. Lấy credentials từ [Cloudinary Console](https://cloudinary.com/console)

### CORS Error

**Lỗi**: CORS policy error khi frontend gọi API

**Giải pháp**:

1. Thêm URL frontend vào CORS_ORIGIN trong Environment Variables
2. Format: `CORS_ORIGIN=https://domain1.com,https://domain2.com`
3. Không có dấu cách sau dấu phẩy

### Health Check Returns 503

**Nguyên nhân**: Database không kết nối được

**Giải pháp**:

1. Kiểm tra logs trong Render Dashboard
2. Xem thông báo lỗi cụ thể
3. Kiểm tra database connection string

## 📝 Notes

- Render free tier có thể sleep sau 15 phút không có traffic
- Để tránh sleep, có thể dùng service như UptimeRobot để ping `/health` endpoint
- Database connection pool sẽ tự động reconnect khi cần
- Logs có thể xem trong Render Dashboard → Logs

## 🔐 Security Best Practices

1. **JWT_SECRET**: Sử dụng chuỗi ngẫu nhiên mạnh, tối thiểu 32 ký tự

   ```bash
   # Generate secure secret
   openssl rand -base64 32
   ```

2. **Database Password**: Sử dụng password mạnh, không commit vào git

3. **CORS_ORIGIN**: Chỉ cho phép domain frontend của bạn, không dùng `*` trong production

4. **Environment Variables**: Không commit file `.env` vào git

## 📞 Support

Nếu gặp vấn đề, kiểm tra:

1. Render Dashboard → Logs
2. Health check endpoint response
3. Environment Variables đã set đúng chưa
