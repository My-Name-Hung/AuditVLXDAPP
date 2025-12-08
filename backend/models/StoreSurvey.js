const { getPool, sql } = require("../config/database");

class StoreSurvey {
  static async create(surveyData) {
    const pool = await getPool();
    const {
      StoreId,
      AuditId,
      UserId,
      CementProductId,
      ContactPerson,
      PurchasePrice,
      SellingPrice,
      SupplierName,
      RoadTransportFee,
      WaterTransportFee,
      ImportExportQuantity,
      StockQuantity,
      ConsumptionArea,
      DebtPeriod,
      WhyNotSellNewProduct,
      TimeToSellNewProduct,
      NewProductImportQuantity,
      ImportedBySalesperson,
      StoreComment,
    } = surveyData;

    const request = pool.request();
    request.input("StoreId", sql.Int, StoreId);
    request.input("AuditId", sql.Int, AuditId);
    request.input("UserId", sql.Int, UserId);
    request.input("CementProductId", sql.Int, CementProductId || null);
    request.input("ContactPerson", sql.NVarChar(200), ContactPerson || null);
    request.input("PurchasePrice", sql.Decimal(18, 2), PurchasePrice || null);
    request.input("SellingPrice", sql.Decimal(18, 2), SellingPrice || null);
    request.input("SupplierName", sql.NVarChar(500), SupplierName || null);
    request.input(
      "RoadTransportFee",
      sql.Decimal(18, 2),
      RoadTransportFee || null
    );
    request.input(
      "WaterTransportFee",
      sql.Decimal(18, 2),
      WaterTransportFee || null
    );
    request.input(
      "ImportExportQuantity",
      sql.NVarChar(100),
      ImportExportQuantity || null
    );
    request.input("StockQuantity", sql.NVarChar(100), StockQuantity || null);
    request.input(
      "ConsumptionArea",
      sql.NVarChar(500),
      ConsumptionArea || null
    );
    request.input("DebtPeriod", sql.NVarChar(100), DebtPeriod || null);
    request.input(
      "WhyNotSellNewProduct",
      sql.NVarChar(1000),
      WhyNotSellNewProduct || null
    );
    request.input(
      "TimeToSellNewProduct",
      sql.DateTime,
      TimeToSellNewProduct || null
    );
    request.input(
      "NewProductImportQuantity",
      sql.NVarChar(500),
      NewProductImportQuantity || null
    );
    request.input(
      "ImportedBySalesperson",
      sql.NVarChar(200),
      ImportedBySalesperson || null
    );
    request.input("StoreComment", sql.NVarChar(1000), StoreComment || null);

    const result = await request.query(`
      INSERT INTO StoreSurveys (
        StoreId, AuditId, UserId, CementProductId, ContactPerson, PurchasePrice,
        SellingPrice, SupplierName, RoadTransportFee, WaterTransportFee,
        ImportExportQuantity, StockQuantity, ConsumptionArea, DebtPeriod,
        WhyNotSellNewProduct, TimeToSellNewProduct, NewProductImportQuantity,
        ImportedBySalesperson, StoreComment,
        CreatedAt, UpdatedAt
      )
      OUTPUT INSERTED.*
      VALUES (
        @StoreId, @AuditId, @UserId, @CementProductId, @ContactPerson, @PurchasePrice,
        @SellingPrice, @SupplierName, @RoadTransportFee, @WaterTransportFee,
        @ImportExportQuantity, @StockQuantity, @ConsumptionArea, @DebtPeriod,
        @WhyNotSellNewProduct, @TimeToSellNewProduct, @NewProductImportQuantity,
        @ImportedBySalesperson, @StoreComment,
        GETDATE(), GETDATE()
      )
    `);

    return result.recordset[0];
  }

  static async findById(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input("Id", sql.Int, id);

    const result = await request.query(`
      SELECT 
        ss.*,
        s.StoreCode,
        s.StoreName,
        t.TerritoryName,
        u.FullName as UserFullName,
        u.UserCode,
        cp.Code as CementProductCode,
        cp.Name as CementProductName,
        a.AuditDate,
        a.Notes as AuditNotes
      FROM StoreSurveys ss
      INNER JOIN Stores s ON ss.StoreId = s.Id
      INNER JOIN Users u ON ss.UserId = u.Id
      LEFT JOIN Territories t ON s.TerritoryId = t.Id
      LEFT JOIN CementProducts cp ON ss.CementProductId = cp.Id
      LEFT JOIN Audits a ON ss.AuditId = a.Id
      WHERE ss.Id = @Id
    `);

    return result.recordset[0];
  }

  static async findByAuditId(auditId) {
    const pool = await getPool();
    const request = pool.request();
    request.input("AuditId", sql.Int, auditId);

    const result = await request.query(`
      SELECT 
        ss.*,
        s.StoreCode,
        s.StoreName,
        t.TerritoryName,
        u.FullName as UserFullName,
        u.UserCode,
        cp.Code as CementProductCode,
        cp.Name as CementProductName,
        a.AuditDate,
        a.Notes as AuditNotes
      FROM StoreSurveys ss
      INNER JOIN Stores s ON ss.StoreId = s.Id
      INNER JOIN Users u ON ss.UserId = u.Id
      LEFT JOIN Territories t ON s.TerritoryId = t.Id
      LEFT JOIN CementProducts cp ON ss.CementProductId = cp.Id
      LEFT JOIN Audits a ON ss.AuditId = a.Id
      WHERE ss.AuditId = @AuditId
    `);

    return result.recordset[0];
  }

  static async findByStoreId(storeId, filters = {}) {
    const pool = await getPool();
    let query = `
      SELECT 
        ss.*,
        s.StoreCode,
        s.StoreName,
        u.FullName as UserFullName,
        u.UserCode,
        cp.Code as CementProductCode,
        cp.Name as CementProductName,
        a.AuditDate,
        a.Notes as AuditNotes
      FROM StoreSurveys ss
      INNER JOIN Stores s ON ss.StoreId = s.Id
      INNER JOIN Users u ON ss.UserId = u.Id
      LEFT JOIN CementProducts cp ON ss.CementProductId = cp.Id
      LEFT JOIN Audits a ON ss.AuditId = a.Id
      WHERE ss.StoreId = @StoreId
    `;

    const request = pool.request();
    request.input("StoreId", sql.Int, storeId);

    if (filters.userId) {
      query += " AND ss.UserId = @UserId";
      request.input("UserId", sql.Int, filters.userId);
    }

    query += " ORDER BY ss.CreatedAt DESC";

    const result = await request.query(query);
    return result.recordset;
  }

  static async findAll(filters = {}) {
    const pool = await getPool();
    let query = `
      SELECT 
        ss.*,
        s.StoreCode,
        s.StoreName,
        t.TerritoryName,
        u.FullName as UserFullName,
        u.UserCode,
        cp.Code as CementProductCode,
        cp.Name as CementProductName,
        a.AuditDate,
        a.Notes as AuditNotes
      FROM StoreSurveys ss
      INNER JOIN Stores s ON ss.StoreId = s.Id
      INNER JOIN Users u ON ss.UserId = u.Id
      LEFT JOIN Territories t ON s.TerritoryId = t.Id
      LEFT JOIN CementProducts cp ON ss.CementProductId = cp.Id
      LEFT JOIN Audits a ON ss.AuditId = a.Id
      WHERE 1=1
    `;

    const request = pool.request();

    if (filters.storeId) {
      query += " AND ss.StoreId = @StoreId";
      request.input("StoreId", sql.Int, filters.storeId);
    }

    if (filters.userId) {
      query += " AND ss.UserId = @UserId";
      request.input("UserId", sql.Int, filters.userId);
    }

    if (filters.auditId) {
      query += " AND ss.AuditId = @AuditId";
      request.input("AuditId", sql.Int, filters.auditId);
    }

    if (filters.storeName) {
      query += " AND s.StoreName LIKE @StoreName";
      request.input("StoreName", sql.NVarChar(500), `%${filters.storeName}%`);
    }

    if (filters.userName) {
      query += " AND u.FullName LIKE @UserName";
      request.input("UserName", sql.NVarChar(200), `%${filters.userName}%`);
    }

    if (filters.cementProductName) {
      query += " AND cp.Name LIKE @CementProductName";
      request.input(
        "CementProductName",
        sql.NVarChar(500),
        `%${filters.cementProductName}%`
      );
    }

    if (filters.territoryName) {
      query += " AND t.TerritoryName LIKE @TerritoryName";
      request.input(
        "TerritoryName",
        sql.NVarChar(200),
        `%${filters.territoryName}%`
      );
    }

    if (filters.dateFrom) {
      query += " AND CAST(a.AuditDate AS DATE) >= @DateFrom";
      request.input("DateFrom", sql.Date, filters.dateFrom);
    }

    if (filters.dateTo) {
      query += " AND CAST(a.AuditDate AS DATE) <= @DateTo";
      request.input("DateTo", sql.Date, filters.dateTo);
    }

    if (filters.priceFrom) {
      query +=
        " AND (ss.SellingPrice >= @PriceFrom OR ss.NewProductSellingPrice >= @PriceFrom)";
      request.input("PriceFrom", sql.Decimal(18, 2), filters.priceFrom);
    }

    if (filters.priceTo) {
      query +=
        " AND (ss.SellingPrice <= @PriceTo OR ss.NewProductSellingPrice <= @PriceTo)";
      request.input("PriceTo", sql.Decimal(18, 2), filters.priceTo);
    }

    if (filters.productType) {
      // Filter by product type: 'xmtd' (XMTĐ) or 'non-xmtd' (non-XMTĐ)
      if (filters.productType === "xmtd") {
        // XMTĐ products: has Title 2 or Title 3 data
        query +=
          " AND (ss.WhyNotSellNewProduct IS NOT NULL OR EXISTS (SELECT 1 FROM StoreSurveyProducts ssp WHERE ssp.StoreSurveyId = ss.Id))";
      } else if (filters.productType === "non-xmtd") {
        // Non-XMTĐ products: has Title 1 data
        query += " AND ss.CementProductId IS NOT NULL";
      }
    }

    // Pagination
    if (filters.page && filters.pageSize) {
      const offset = (filters.page - 1) * filters.pageSize;
      query += ` ORDER BY ss.CreatedAt DESC OFFSET ${offset} ROWS FETCH NEXT ${filters.pageSize} ROWS ONLY`;
    } else {
      query += " ORDER BY ss.CreatedAt DESC";
    }

    const result = await request.query(query);
    return result.recordset;
  }

  static async update(id, surveyData) {
    const pool = await getPool();
    const {
      CementProductId,
      ContactPerson,
      PurchasePrice,
      SellingPrice,
      SupplierName,
      RoadTransportFee,
      WaterTransportFee,
      ImportExportQuantity,
      StockQuantity,
      ConsumptionArea,
      DebtPeriod,
      WhyNotSellNewProduct,
      TimeToSellNewProduct,
      NewProductImportQuantity,
      ImportedBySalesperson,
      StoreComment,
    } = surveyData;

    const request = pool.request();
    request.input("Id", sql.Int, id);
    request.input("CementProductId", sql.Int, CementProductId || null);
    request.input("ContactPerson", sql.NVarChar(200), ContactPerson || null);
    request.input("PurchasePrice", sql.Decimal(18, 2), PurchasePrice || null);
    request.input("SellingPrice", sql.Decimal(18, 2), SellingPrice || null);
    request.input("SupplierName", sql.NVarChar(500), SupplierName || null);
    request.input(
      "RoadTransportFee",
      sql.Decimal(18, 2),
      RoadTransportFee || null
    );
    request.input(
      "WaterTransportFee",
      sql.Decimal(18, 2),
      WaterTransportFee || null
    );
    request.input(
      "ImportExportQuantity",
      sql.NVarChar(100),
      ImportExportQuantity || null
    );
    request.input("StockQuantity", sql.NVarChar(100), StockQuantity || null);
    request.input(
      "ConsumptionArea",
      sql.NVarChar(500),
      ConsumptionArea || null
    );
    request.input("DebtPeriod", sql.NVarChar(100), DebtPeriod || null);
    request.input(
      "WhyNotSellNewProduct",
      sql.NVarChar(1000),
      WhyNotSellNewProduct || null
    );
    request.input(
      "TimeToSellNewProduct",
      sql.DateTime,
      TimeToSellNewProduct || null
    );
    request.input(
      "NewProductImportQuantity",
      sql.NVarChar(500),
      NewProductImportQuantity || null
    );
    request.input(
      "ImportedBySalesperson",
      sql.NVarChar(200),
      ImportedBySalesperson || null
    );
    request.input("StoreComment", sql.NVarChar(1000), StoreComment || null);

    const result = await request.query(`
      UPDATE StoreSurveys
      SET CementProductId = @CementProductId,
          ContactPerson = @ContactPerson,
          PurchasePrice = @PurchasePrice,
          SellingPrice = @SellingPrice,
          SupplierName = @SupplierName,
          RoadTransportFee = @RoadTransportFee,
          WaterTransportFee = @WaterTransportFee,
          ImportExportQuantity = @ImportExportQuantity,
          StockQuantity = @StockQuantity,
          ConsumptionArea = @ConsumptionArea,
          DebtPeriod = @DebtPeriod,
          WhyNotSellNewProduct = @WhyNotSellNewProduct,
          TimeToSellNewProduct = @TimeToSellNewProduct,
          NewProductImportQuantity = @NewProductImportQuantity,
          ImportedBySalesperson = @ImportedBySalesperson,
          StoreComment = @StoreComment,
          UpdatedAt = GETDATE()
      OUTPUT INSERTED.*
      WHERE Id = @Id
    `);

    return result.recordset[0];
  }

  static async delete(id) {
    const pool = await getPool();
    const request = pool.request();
    request.input("Id", sql.Int, id);

    await request.query(`
      DELETE FROM StoreSurveys WHERE Id = @Id
    `);

    return true;
  }
}

module.exports = StoreSurvey;
