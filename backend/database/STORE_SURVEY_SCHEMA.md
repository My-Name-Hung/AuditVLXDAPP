# Store Survey System - Database Schema & Documentation

## Tổng quan

Hệ thống khảo sát cửa hàng cho phép thu thập thông tin chi tiết về:

- Sản phẩm không phải của Xi Măng Tây Đô mà cửa hàng đang bán
- Khảo sát sản phẩm của XMTĐ
- Thông tin bán hàng (nhiều sản phẩm)

## Database Schema

### 1. Bảng `CementProducts` (Sản phẩm Xi Măng)

Lưu trữ danh sách các loại xi măng có sẵn trong hệ thống.

```sql
CREATE TABLE CementProducts (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Code VARCHAR(50) UNIQUE NOT NULL,  -- Mã số (801002022, 802002024, ...)
    Name NVARCHAR(500) NOT NULL,         -- Tên xi măng
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
);
```

**Mối quan hệ:**

- Một CementProduct có thể được sử dụng trong nhiều StoreSurveys
- Một CementProduct có thể được sử dụng trong nhiều StoreSurveyProducts

**Dữ liệu mẫu:**

- 45 sản phẩm xi măng được import từ Excel
- Code format: 801002022, 802002024, ...

---

### 2. Bảng `StoreSurveys` (Thông tin khảo sát chính)

Lưu trữ thông tin khảo sát chính của một cửa hàng trong một lần audit.

```sql
CREATE TABLE StoreSurveys (
    Id INT PRIMARY KEY IDENTITY(1,1),
    StoreId INT NOT NULL,
    AuditId INT NOT NULL,
    UserId INT NOT NULL,

    -- Title 1: Cửa hàng bán sản phẩm không phải của XMTĐ
    CementProductId INT NULL,  -- Loại xi măng đã chọn
    ContactPerson NVARCHAR(200),  -- Người tiếp xúc
    PurchasePrice DECIMAL(18,2),  -- Giá mua vào
    SellingPrice DECIMAL(18,2),   -- Giá bán ra
    SupplierName NVARCHAR(500),  -- Nhập NPP nào?
    RoadTransportFee DECIMAL(18,2),  -- Phí code đường bộ
    WaterTransportFee DECIMAL(18,2), -- Phí code đường thủy
    ImportExportQuantity NVARCHAR(100),  -- Số lượng nhập/xuất
    StockQuantity NVARCHAR(100),  -- Số sản phẩm tồn kho
    ConsumptionArea NVARCHAR(500),  -- Vùng đang tiêu thụ
    DebtPeriod NVARCHAR(100),  -- Công nợ bao lâu

    -- Title 2: Khảo sát sản phẩm của XMTĐ
    WhyNotSellNewProduct NVARCHAR(1000),  -- Tại sao không bán sản phẩm mới
    TimeToSellNewProduct DATETIME NULL,  -- Thời gian để bán sản phẩm mới
    NewProductImportQuantity NVARCHAR(500),  -- Tên sản phẩm muốn nhập – Số lượng (hỗ trợ cả text và số)
    ImportedBySalesperson NVARCHAR(200),  -- Nhập bởi thương vụ
    NewProductSellingPrice DECIMAL(18,2),  -- Giá bán ra (sản phẩm mới)
    FutureImportPrediction DECIMAL(18,2) NULL,  -- Dự đoán tương lai sẽ nhập bao nhiêu (không bắt buộc)

    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_StoreSurveys_Stores FOREIGN KEY (StoreId) REFERENCES Stores(Id),
    CONSTRAINT FK_StoreSurveys_Audits FOREIGN KEY (AuditId) REFERENCES Audits(Id) ON DELETE CASCADE,
    CONSTRAINT FK_StoreSurveys_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
    CONSTRAINT FK_StoreSurveys_CementProducts FOREIGN KEY (CementProductId) REFERENCES CementProducts(Id)
);
```

**Mối quan hệ:**

- `StoreId` → `Stores.Id`: Một cửa hàng có thể có nhiều khảo sát (theo thời gian)
- `AuditId` → `Audits.Id` ON DELETE CASCADE: Một audit có một khảo sát, xóa audit thì xóa khảo sát
- `UserId` → `Users.Id`: Người thực hiện khảo sát
- `CementProductId` → `CementProducts.Id`: Loại xi măng được chọn ở Title 1

**Lưu ý:**

- Tất cả trường đều bắt buộc nhập (trừ `FutureImportPrediction`)
- Format số tiền: DECIMAL(18,2) để lưu giá trị tiền VND
- Format text: NVARCHAR để hỗ trợ tiếng Việt

---

### 3. Bảng `StoreSurveyProducts` (Sản phẩm bán hàng - Title 3)

Lưu trữ nhiều sản phẩm được bán ở Title 3 "Thông tin bán hàng".

```sql
CREATE TABLE StoreSurveyProducts (
    Id INT PRIMARY KEY IDENTITY(1,1),
    StoreSurveyId INT NOT NULL,
    ProductType NVARCHAR(100) NOT NULL,  -- Xi măng, Cát, Đá
    CementProductId INT NULL,  -- Loại xi măng (nếu ProductType = "Xi măng")
    SellingPrice DECIMAL(18,2),  -- Giá bán ra
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),

    CONSTRAINT FK_StoreSurveyProducts_StoreSurveys FOREIGN KEY (StoreSurveyId) REFERENCES StoreSurveys(Id) ON DELETE CASCADE,
    CONSTRAINT FK_StoreSurveyProducts_CementProducts FOREIGN KEY (CementProductId) REFERENCES CementProducts(Id)
);
```

**Mối quan hệ:**

- `StoreSurveyId` → `StoreSurveys.Id` ON DELETE CASCADE: Một khảo sát có nhiều sản phẩm, xóa khảo sát thì xóa tất cả sản phẩm
- `CementProductId` → `CementProducts.Id`: Loại xi măng (chỉ khi ProductType = "Xi măng")

**Lưu ý:**

- Một StoreSurvey có thể có nhiều StoreSurveyProducts
- ProductType có thể là: "Xi măng", "Cát", "Đá", hoặc loại khác
- Nếu ProductType = "Xi măng", thì CementProductId bắt buộc phải có giá trị

---

## Indexes

Để tối ưu hiệu suất query:

```sql
-- CementProducts
CREATE INDEX IX_CementProducts_Code ON CementProducts(Code);
CREATE INDEX IX_CementProducts_Name ON CementProducts(Name);

-- StoreSurveys
CREATE INDEX IX_StoreSurveys_StoreId ON StoreSurveys(StoreId);
CREATE INDEX IX_StoreSurveys_AuditId ON StoreSurveys(AuditId);
CREATE INDEX IX_StoreSurveys_UserId ON StoreSurveys(UserId);
CREATE INDEX IX_StoreSurveys_CementProductId ON StoreSurveys(CementProductId);
CREATE INDEX IX_StoreSurveys_CreatedAt ON StoreSurveys(CreatedAt);

-- StoreSurveyProducts
CREATE INDEX IX_StoreSurveyProducts_StoreSurveyId ON StoreSurveyProducts(StoreSurveyId);
CREATE INDEX IX_StoreSurveyProducts_ProductType ON StoreSurveyProducts(ProductType);
CREATE INDEX IX_StoreSurveyProducts_CementProductId ON StoreSurveyProducts(CementProductId);
```

---

## Flow hoạt động

### 1. Flow sau khi chụp ảnh

1. User chụp 3 ảnh tại cửa hàng
2. Nút "Hoàn thành" → đổi thành "Tiếp tục"
3. Click "Tiếp tục" → Navigate sang màn hình khảo sát

### 2. Màn hình khảo sát

#### Title 1: "Cửa hàng bán sản phẩm không phải của Xi Măng Tây Đô"

- **Hiển thị mặc định** (expanded)
- Loại xi măng: Dropdown (có thể tạo mới)
- **Sau khi chọn loại xi măng** → Hiển thị 6 trường:
  - Người tiếp xúc
  - Giá mua vào
  - Giá bán ra
  - Nhập NPP nào?
  - Phí code đường bộ
  - Phí code đường thủy
- Số lượng nhập/xuất: Input
- Số sản phẩm tồn kho: Input
- Vùng đang tiêu thụ: Input
- Công nợ bao lâu: Input

#### Title 2: "Khảo sát sản phẩm của XMTĐ"

- **Collapsed mặc định** (chỉ hiển thị title + icon mũi tên xuống)
- **Auto-expand** khi Title 1 đã điền đầy đủ
- Tại sao không bán sản phẩm mới: Input
- Thời gian để bán sản phẩm mới: Date picker
- Số lượng nhập sản phẩm mới: Input (format VND)
- Nhập bởi thương vụ: Input
- Giá bán ra: Dropdown checkbox (3000-10000) - format VND
- Dự đoán tương lai sẽ nhập bao nhiêu hàng của XMTĐ: Input (không bắt buộc)

#### Title 3: "Thông tin bán hàng"

- **Collapsed mặc định**
- **Auto-expand** khi Title 2 đã điền đầy đủ
- Có thể **thêm nhiều sản phẩm** (nút "Thêm sản phẩm")
- Mỗi sản phẩm có:
  - Sản phẩm được bán: Input/Dropdown (Xi măng, Cát, Đá) - có thể tạo mới
  - Loại xi măng: Dropdown (nếu chọn "Xi măng")
  - Giá bán ra: Dropdown checkbox (3000-10000) - format VND

### 3. Validation & Hoàn thành

- Tất cả trường bắt buộc nhập (trừ "Dự đoán tương lai sẽ nhập bao nhiêu hàng của XMTĐ")
- **Không validate** khi ấn "Hoàn thành"
- Khi ấn "Hoàn thành" → Hiển thị **modal cảnh báo**:
  - Liệt kê các trường còn trống
  - Nút "Xác nhận hoàn thành"
- Click "Xác nhận hoàn thành" → Lưu dữ liệu + Upload ảnh + Hoàn thành audit
- Thông báo "Thực thi cửa hàng thành công" → Navigate về StoreDetail

---

## API Endpoints

### Cement Products

```
GET    /api/cement-products           - Lấy danh sách xi măng
GET    /api/cement-products/:id       - Lấy chi tiết xi măng
POST   /api/cement-products           - Tạo xi măng mới
PUT    /api/cement-products/:id       - Cập nhật xi măng
DELETE /api/cement-products/:id       - Xóa xi măng
POST   /api/cement-products/import    - Import từ Excel (Admin)
```

### Store Surveys

```
GET    /api/store-surveys                    - Lấy danh sách khảo sát (có filter)
GET    /api/store-surveys/:id                - Lấy chi tiết khảo sát
GET    /api/store-surveys/store/:storeId     - Lấy khảo sát theo cửa hàng
GET    /api/store-surveys/audit/:auditId     - Lấy khảo sát theo audit
GET    /api/store-surveys/user/:userId       - Lấy khảo sát theo user
POST   /api/store-surveys                   - Tạo khảo sát mới
PUT    /api/store-surveys/:id                - Cập nhật khảo sát
DELETE /api/store-surveys/:id                - Xóa khảo sát
GET    /api/store-surveys/export             - Export Excel (Admin)
```

### Store Survey Products

```
GET    /api/store-survey-products/:surveyId  - Lấy sản phẩm của khảo sát
POST   /api/store-survey-products             - Thêm sản phẩm vào khảo sát
DELETE /api/store-survey-products/:id        - Xóa sản phẩm
```

---

## Admin Web Features

### 1. Import Excel - Tab "Tải lên xi măng"

- Upload file Excel với format:
  - Cột A: Mã số (Code)
  - Cột B: Tên xi măng (Name)
- Validate và import vào bảng `CementProducts`

### 2. Dashboard - Quản lý khảo sát

- Trong **Dashboard chi tiết user**
- Table có cột **"Note"** với icon mắt (👁️)
- Click icon mắt → Navigate đến màn hình **thông tin khảo sát** của store với user tương ứng
- Màn hình khảo sát hiển thị:
  - Thông tin cửa hàng
  - Thông tin user
  - Tất cả dữ liệu khảo sát (Title 1, 2, 3)
  - Có thể filter, export Excel

---

## Format dữ liệu

### Format số tiền (VND)

- Input: Hiển thị với dấu phẩy phân cách (ví dụ: 1,000,000)
- Database: Lưu dạng DECIMAL(18,2) (ví dụ: 1000000.00)
- Validation: Tự động format khi nhập

### Format ngày tháng

- Input: Date picker (dd/MM/yyyy)
- Database: DATETIME
- Display: Format theo locale Việt Nam

---

## Migration Script

File: `backend/database/migration_add_store_survey.sql`

```sql
-- 1. Tạo bảng CementProducts
CREATE TABLE CementProducts (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Code VARCHAR(50) UNIQUE NOT NULL,
    Name NVARCHAR(500) NOT NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
);

-- 2. Tạo bảng StoreSurveys
CREATE TABLE StoreSurveys (
    Id INT PRIMARY KEY IDENTITY(1,1),
    StoreId INT NOT NULL,
    AuditId INT NOT NULL,
    UserId INT NOT NULL,
    CementProductId INT NULL,
    ContactPerson NVARCHAR(200),
    PurchasePrice DECIMAL(18,2),
    SellingPrice DECIMAL(18,2),
    SupplierName NVARCHAR(500),
    RoadTransportFee DECIMAL(18,2),
    WaterTransportFee DECIMAL(18,2),
    ImportExportQuantity NVARCHAR(100),
    StockQuantity NVARCHAR(100),
    ConsumptionArea NVARCHAR(500),
    DebtPeriod NVARCHAR(100),
    WhyNotSellNewProduct NVARCHAR(1000),
    TimeToSellNewProduct DATETIME NULL,
    NewProductImportQuantity DECIMAL(18,2),
    ImportedBySalesperson NVARCHAR(200),
    NewProductSellingPrice DECIMAL(18,2),
    FutureImportPrediction DECIMAL(18,2) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_StoreSurveys_Stores FOREIGN KEY (StoreId) REFERENCES Stores(Id),
    CONSTRAINT FK_StoreSurveys_Audits FOREIGN KEY (AuditId) REFERENCES Audits(Id) ON DELETE CASCADE,
    CONSTRAINT FK_StoreSurveys_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
    CONSTRAINT FK_StoreSurveys_CementProducts FOREIGN KEY (CementProductId) REFERENCES CementProducts(Id)
);

-- 3. Tạo bảng StoreSurveyProducts
CREATE TABLE StoreSurveyProducts (
    Id INT PRIMARY KEY IDENTITY(1,1),
    StoreSurveyId INT NOT NULL,
    ProductType NVARCHAR(100) NOT NULL,
    CementProductId INT NULL,
    SellingPrice DECIMAL(18,2),
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_StoreSurveyProducts_StoreSurveys FOREIGN KEY (StoreSurveyId) REFERENCES StoreSurveys(Id) ON DELETE CASCADE,
    CONSTRAINT FK_StoreSurveyProducts_CementProducts FOREIGN KEY (CementProductId) REFERENCES CementProducts(Id)
);

-- 4. Tạo indexes
CREATE INDEX IX_CementProducts_Code ON CementProducts(Code);
CREATE INDEX IX_CementProducts_Name ON CementProducts(Name);
CREATE INDEX IX_StoreSurveys_StoreId ON StoreSurveys(StoreId);
CREATE INDEX IX_StoreSurveys_AuditId ON StoreSurveys(AuditId);
CREATE INDEX IX_StoreSurveys_UserId ON StoreSurveys(UserId);
CREATE INDEX IX_StoreSurveys_CementProductId ON StoreSurveys(CementProductId);
CREATE INDEX IX_StoreSurveys_CreatedAt ON StoreSurveys(CreatedAt);
CREATE INDEX IX_StoreSurveyProducts_StoreSurveyId ON StoreSurveyProducts(StoreSurveyId);
CREATE INDEX IX_StoreSurveyProducts_ProductType ON StoreSurveyProducts(ProductType);
CREATE INDEX IX_StoreSurveyProducts_CementProductId ON StoreSurveyProducts(CementProductId);
```

---

## Dữ liệu mẫu - 45 sản phẩm xi măng

Xem file: `backend/database/seed_cement_products.sql`

---

## Notes

1. **CASCADE DELETE**: Khi xóa Audit, StoreSurvey và StoreSurveyProducts sẽ tự động bị xóa
2. **Format số tiền**: Frontend format với dấu phẩy, backend lưu dạng DECIMAL
3. **Validation**: Tất cả trường bắt buộc (trừ FutureImportPrediction) nhưng không validate khi ấn "Hoàn thành", chỉ hiển thị modal cảnh báo
4. **Multiple Products**: Title 3 cho phép thêm nhiều sản phẩm, chỉ thêm không xóa
5. **Auto-expand**: Title 2 và 3 tự động expand khi title trước đã điền đầy đủ

---

## Version History

- **v1.0** (2025-01-XX): Initial schema design
- Schema được thiết kế để dễ query, filter, và export Excel cho Admin Web
