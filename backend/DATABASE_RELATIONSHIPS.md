# Database Relationships - Xác định User và Store của Ảnh

## Cấu trúc Database

### Quan hệ giữa các bảng:

```
Users (Người dùng)
  ↓ (1:N)
Audits (Lần kiểm tra/checkin)
  ↓ (1:N)
Images (Ảnh được chụp)
```

### Chi tiết:

1. **Audits Table**:
   - `UserId` (Foreign Key → Users.Id): Xác định user nào thực hiện audit
   - `StoreId` (Foreign Key → Stores.Id): Xác định cửa hàng nào được audit

2. **Images Table**:
   - `AuditId` (Foreign Key → Audits.Id): Xác định ảnh thuộc audit nào

### Cách truy vấn để biết User và Store của một ảnh:

```sql
-- Lấy thông tin đầy đủ về ảnh, user và store
SELECT 
    i.Id AS ImageId,
    i.ImageUrl,
    i.CapturedAt,
    u.Id AS UserId,
    u.FullName AS UserName,
    u.UserCode,
    s.Id AS StoreId,
    s.StoreName,
    s.StoreCode,
    a.AuditDate,
    a.Result
FROM Images i
INNER JOIN Audits a ON i.AuditId = a.Id
INNER JOIN Users u ON a.UserId = u.Id
INNER JOIN Stores s ON a.StoreId = s.Id
WHERE i.Id = @ImageId;
```

### Trong Code (Node.js):

```javascript
// Lấy ảnh với thông tin user và store
const pool = await getPool();
const result = await pool.request()
  .input('ImageId', sql.Int, imageId)
  .query(`
    SELECT 
      i.*,
      u.Id AS UserId,
      u.FullName AS UserName,
      s.Id AS StoreId,
      s.StoreName
    FROM Images i
    INNER JOIN Audits a ON i.AuditId = a.Id
    INNER JOIN Users u ON a.UserId = u.Id
    INNER JOIN Stores s ON a.StoreId = s.Id
    WHERE i.Id = @ImageId
  `);
```

### Luồng hoạt động:

1. **User chụp ảnh tại Store**:
   - Tạo một `Audit` record với `UserId` và `StoreId`
   - Upload ảnh lên Cloudinary với watermark (chứa lat/lon/time)
   - Tạo một `Image` record với `AuditId` trỏ đến `Audit` vừa tạo

2. **Truy vấn ảnh**:
   - Từ `Image` → JOIN `Audits` → Lấy được `UserId` và `StoreId`
   - JOIN `Users` → Lấy thông tin user
   - JOIN `Stores` → Lấy thông tin cửa hàng

### Ví dụ thực tế:

```javascript
// Khi user chụp ảnh
const audit = await Audit.create({
  UserId: 1,        // User ID
  StoreId: 5,       // Store ID
  Result: 'pass',
  Notes: 'Checkin thành công',
  AuditDate: new Date()
});

// Upload ảnh với watermark
const imageUrl = await uploadImageWithWatermark(imageBuffer, {
  latitude: 10.762622,
  longitude: 106.660172,
  timestamp: new Date().getTime()
});

// Lưu ảnh vào database
const image = await Image.create({
  AuditId: audit.Id,  // Liên kết với audit
  ImageUrl: imageUrl,
  Latitude: 10.762622,
  Longitude: 106.660172,
  CapturedAt: new Date()
});

// Để lấy thông tin user và store của ảnh này:
const fullInfo = await pool.request()
  .input('ImageId', sql.Int, image.Id)
  .query(`
    SELECT 
      i.*,
      u.FullName AS UserName,
      s.StoreName
    FROM Images i
    INNER JOIN Audits a ON i.AuditId = a.Id
    INNER JOIN Users u ON a.UserId = u.Id
    INNER JOIN Stores s ON a.StoreId = s.Id
    WHERE i.Id = @ImageId
  `);
```

