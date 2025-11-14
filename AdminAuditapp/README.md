# AdminAuditapp

Admin Web Dashboard cho hệ thống Auditapp sử dụng React + Vite + TypeScript.

## Cài đặt

1. Cài đặt dependencies:
```bash
npm install
```

2. Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```

3. Cấu hình API URL trong file `.env`:
```
VITE_API_BASE_URL=http://localhost:3000/api
```

4. Khởi động development server:
```bash
npm run dev
```

5. Build cho production:
```bash
npm run build
```

## Tính năng

- ✅ Login/Logout với JWT authentication
- ✅ Dashboard với thống kê tổng quan
- ✅ Quản lý Users (CRUD)
- ✅ Quản lý Stores (CRUD)
- ✅ Quản lý Audits (Xem danh sách, filter)
- ✅ Responsive design
- ✅ Global styling với màu chủ đạo #0138C3

## Cấu trúc thư mục

```
AdminAuditapp/
├── src/
│   ├── components/    # Components tái sử dụng
│   ├── contexts/      # React contexts (Auth)
│   ├── pages/         # Các trang chính
│   ├── services/      # API services
│   ├── App.tsx        # Main app component
│   └── main.tsx       # Entry point
└── public/            # Static files
```

## Pages

- `/login` - Trang đăng nhập
- `/` - Dashboard
- `/users` - Quản lý users
- `/stores` - Quản lý stores
- `/audits` - Quản lý audits

## Màu sắc

- Primary Color: `#0138C3` (Xanh đậm)
- Secondary Color: `#fefefe` (Trắng be/Off-White)
