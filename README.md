# Auditapp - Hệ thống Quản lý Audit

Hệ thống quản lý audit gồm 3 phần chính:
1. **Mobile App** - React Native + Expo Router
2. **Admin Web** - React + Vite + TypeScript
3. **Backend API** - Node.js + Express + SQL Server

## 🏗️ Kiến trúc hệ thống

```
Auditapp/
├── Auditapp-mobile/     # Mobile App (Expo)
├── AdminAuditapp/       # Admin Web (Vite + React + TS)
└── backend/             # Backend API (Node + Express + SQL Server)
```

## 🚀 Bắt đầu nhanh

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Cấu hình .env với thông tin database và Cloudinary
# Chạy schema.sql trên SQL Server
npm run dev
```

### 2. Admin Web Setup

```bash
cd AdminAuditapp
npm install
cp .env.example .env
# Cấu hình VITE_API_BASE_URL trong .env
npm run dev
```

### 3. Mobile App Setup

```bash
npm install
npx expo start
```

## 📋 Yêu cầu hệ thống

- Node.js >= 18
- SQL Server (Aurora/RDS hoặc local)
- Cloudinary account (cho upload ảnh)
- Expo CLI (cho mobile app)

## 🎨 Global Styling

- **Primary Color**: `#0138C3` (Xanh đậm)
- **Secondary Color**: `#fefefe` (Trắng be/Off-White)

## 📚 Tài liệu chi tiết

- [Backend README](./backend/README.md)
- [Admin Web README](./AdminAuditapp/README.md)

## 🔐 Database Schema

Database gồm 4 bảng chính:
- **Users**: Quản lý người dùng (auto UserCode: U000001, U000002, ...)
- **Stores**: Quản lý cửa hàng (auto StoreCode: CH000001, CH000002, ...)
- **Audits**: Lưu kết quả audit (pass/fail) của user cho store
- **Images**: Lưu URL ảnh từ Cloudinary với watermark lat/lon/time

Xem chi tiết trong `backend/database/schema.sql`

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/refresh`

### Resources
- `/api/users` - Quản lý users
- `/api/stores` - Quản lý stores
- `/api/audits` - Quản lý audits
- `/api/images` - Upload và quản lý ảnh

Xem chi tiết trong [Backend README](./backend/README.md)

## 📝 Tính năng chính

- ✅ Authentication với JWT
- ✅ Auto-generate codes (UserCode, StoreCode)
- ✅ Upload ảnh lên Cloudinary với watermark (lat/lon/time)
- ✅ Admin Dashboard với thống kê
- ✅ CRUD đầy đủ cho Users, Stores, Audits
- ✅ Responsive design

## 🛠️ Công nghệ sử dụng

### Backend
- Node.js + Express
- SQL Server (mssql)
- Cloudinary
- JWT
- bcryptjs

### Admin Web
- React 19
- TypeScript
- Vite
- React Router
- Axios

### Mobile App
- React Native
- Expo Router
- TypeScript

## 📄 License

ISC
