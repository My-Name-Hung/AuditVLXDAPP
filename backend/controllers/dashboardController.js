const { getPool, sql } = require("../config/database");

// Get dashboard summary with filters
async function getSummary(req, res) {
  try {
    const { territoryIds, startDate, endDate } = req.query;
    const pool = await getPool();
    const request = pool.request();

    // Optimized query - use CTE to improve performance
    let query = `
      WITH AuditsWithImages AS (
        SELECT
          a.UserId,
          a.StoreId,
          CAST(a.AuditDate AS DATE) as AuditDate,
          s.TerritoryId
        FROM Audits a
        INNER JOIN Stores s ON a.StoreId = s.Id
        WHERE EXISTS (
          SELECT 1 
          FROM Images img 
          WHERE img.AuditId = a.Id 
            AND img.ImageUrl IS NOT NULL 
            AND img.ImageUrl != ''
        )
    `;

    // Filter by date range in CTE
    if (startDate) {
      query += " AND CAST(a.AuditDate AS DATE) >= @startDate";
      request.input("startDate", sql.Date, startDate);
    }

    if (endDate) {
      query += " AND CAST(a.AuditDate AS DATE) <= @endDate";
      request.input("endDate", sql.Date, endDate);
    }

    query += `
      )
      SELECT 
        a.UserId as UserId,
        u.FullName,
        a.TerritoryId,
        t.TerritoryName,
        COUNT(DISTINCT a.AuditDate) as TotalCheckinDays,
        COUNT(DISTINCT a.StoreId) as TotalStoresChecked
      FROM AuditsWithImages a
      INNER JOIN Users u ON a.UserId = u.Id
      INNER JOIN Territories t ON a.TerritoryId = t.Id
      WHERE u.Role = 'sales'
        AND a.UserId IS NOT NULL
    `;

    // Filter by territories
    if (territoryIds) {
      const territoryArray = Array.isArray(territoryIds)
        ? territoryIds
        : territoryIds
            .split(",")
            .map((id) => parseInt(id.trim()))
            .filter((id) => !isNaN(id));

      if (territoryArray.length > 0) {
        query += " AND a.TerritoryId IN (";
        territoryArray.forEach((id, index) => {
          const paramName = `territory${index}`;
          request.input(paramName, sql.Int, id);
          query += `@${paramName}`;
          if (index < territoryArray.length - 1) query += ",";
        });
        query += ")";
      }
    }

    query += `
      GROUP BY a.UserId, u.FullName, a.TerritoryId, t.TerritoryName
      HAVING COUNT(DISTINCT a.AuditDate) > 0
      ORDER BY u.FullName ASC
    `;

    // Set timeout to 60 seconds for dashboard query
    request.timeout = 60000;
    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard summary",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// Get user detail checkin data
async function getUserDetail(req, res) {
  try {
    const { userId } = req.params;
    const { startDate, endDate, storeName, territoryId } = req.query;

    console.log("getUserDetail called with params:", {
      userId,
      startDate,
      endDate,
      storeName,
    });

    const pool = await getPool();
    const request = pool.request();

    request.input("UserId", sql.Int, userId);

    let query = `
      SELECT 
        CAST(a.AuditDate AS DATE) as CheckinDate,
        a.Id as AuditId,
        s.Id as StoreId,
        s.StoreName,
        s.Address,
        t.TerritoryName,
        MIN(img.CapturedAt) as CheckinTime,
        a.Notes
      FROM Audits a
      INNER JOIN Stores s ON a.StoreId = s.Id
      LEFT JOIN Territories t ON s.TerritoryId = t.Id
      INNER JOIN Images img ON a.Id = img.AuditId
      WHERE a.UserId = @UserId
        AND img.ImageUrl IS NOT NULL
        AND img.ImageUrl != ''
    `;

    if (territoryId) {
      query += " AND s.TerritoryId = @TerritoryId";
      request.input("TerritoryId", sql.Int, parseInt(territoryId, 10));
    }

    if (startDate) {
      query += " AND CAST(a.AuditDate AS DATE) >= @startDate";
      request.input("startDate", sql.Date, startDate);
    }

    if (endDate) {
      query += " AND CAST(a.AuditDate AS DATE) <= @endDate";
      request.input("endDate", sql.Date, endDate);
    }

    // Filter by store name
    if (storeName && storeName.trim() !== "") {
      const storeNamePattern = `%${storeName.trim()}%`;
      query += " AND s.StoreName LIKE @storeName";
      request.input("storeName", sql.NVarChar(200), storeNamePattern);
    }

    query += `
      GROUP BY CAST(a.AuditDate AS DATE),
               a.Id,
               s.Id,
               s.StoreName,
               s.Address,
               t.TerritoryName,
               a.Notes
      ORDER BY CheckinDate DESC, CheckinTime DESC
    `;

    // Set timeout to 60 seconds
    request.timeout = 60000;
    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error("Error fetching user detail:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user detail",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// Export Excel report
async function exportReport(req, res) {
  try {
    const { territoryIds, startDate, endDate } = req.query;
    const pool = await getPool();
    const request = pool.request();

    // Align export summary with dashboard summary logic
    let summaryQuery = `
      WITH AuditsWithImages AS (
        SELECT
          a.UserId,
          a.StoreId,
          CAST(a.AuditDate AS DATE) as AuditDate,
          s.TerritoryId
        FROM Audits a
        INNER JOIN Stores s ON a.StoreId = s.Id
        WHERE EXISTS (
          SELECT 1 
          FROM Images img 
          WHERE img.AuditId = a.Id 
            AND img.ImageUrl IS NOT NULL 
            AND img.ImageUrl != ''
        )
    `;

    if (startDate) {
      summaryQuery += " AND CAST(a.AuditDate AS DATE) >= @startDate";
      request.input("startDate", sql.Date, startDate);
    }

    if (endDate) {
      summaryQuery += " AND CAST(a.AuditDate AS DATE) <= @endDate";
      request.input("endDate", sql.Date, endDate);
    }

    summaryQuery += `
      )
      SELECT 
        a.UserId as UserId,
        u.FullName,
        a.TerritoryId,
        t.TerritoryName,
        COUNT(DISTINCT a.AuditDate) as TotalCheckinDays,
        COUNT(DISTINCT a.StoreId) as TotalStoresChecked
      FROM AuditsWithImages a
      INNER JOIN Users u ON a.UserId = u.Id
      INNER JOIN Territories t ON a.TerritoryId = t.Id
      WHERE u.Role = 'sales'
        AND a.UserId IS NOT NULL
    `;

    if (territoryIds) {
      const territoryArray = Array.isArray(territoryIds)
        ? territoryIds
        : territoryIds
            .split(",")
            .map((id) => parseInt(id.trim()))
            .filter((id) => !isNaN(id));

      if (territoryArray.length > 0) {
        summaryQuery += " AND a.TerritoryId IN (";
        territoryArray.forEach((id, index) => {
          const paramName = `territory${index}`;
          request.input(paramName, sql.Int, id);
          summaryQuery += `@${paramName}`;
          if (index < territoryArray.length - 1) summaryQuery += ",";
        });
        summaryQuery += ")";
      }
    }

    summaryQuery += `
      GROUP BY a.UserId, u.FullName, a.TerritoryId, t.TerritoryName
      HAVING COUNT(DISTINCT a.AuditDate) > 0
      ORDER BY u.FullName ASC
    `;

    // Set timeout to 60 seconds
    request.timeout = 60000;
    const summaryResult = await request.query(summaryQuery);
    const summaryData = summaryResult.recordset;

    // Get detail data for each user-territory combination
    const detailDataMap = {};
    for (const user of summaryData) {
      const detailRequest = pool.request();
      detailRequest.input("UserId", sql.Int, user.UserId);
      detailRequest.input("TerritoryId", sql.Int, user.TerritoryId);

      if (startDate) {
        detailRequest.input("startDate", sql.Date, startDate);
      }
      if (endDate) {
        detailRequest.input("endDate", sql.Date, endDate);
      }

      let detailQuery = `
        SELECT 
          CAST(a.AuditDate AS DATE) as CheckinDate,
          a.Id as AuditId,
          s.StoreName,
          s.Address,
          t.TerritoryName,
          MIN(img.CapturedAt) as CheckinTime,
          a.Notes
        FROM Audits a
        INNER JOIN Stores s ON a.StoreId = s.Id
        LEFT JOIN Territories t ON s.TerritoryId = t.Id
        INNER JOIN Images img ON a.Id = img.AuditId
        WHERE a.UserId = @UserId
          AND s.TerritoryId = @TerritoryId
          AND img.ImageUrl IS NOT NULL
          AND img.ImageUrl != ''
      `;

      if (startDate) {
        detailQuery += " AND CAST(a.AuditDate AS DATE) >= @startDate";
      }
      if (endDate) {
        detailQuery += " AND CAST(a.AuditDate AS DATE) <= @endDate";
      }

      detailQuery += `
        GROUP BY CAST(a.AuditDate AS DATE),
                 a.Id,
                 s.StoreName,
                 s.Address,
                 t.TerritoryName,
                 a.Notes
        ORDER BY CheckinDate DESC, CheckinTime DESC
      `;

      // Set timeout to 30 seconds
      detailRequest.timeout = 30000;
      const detailResult = await detailRequest.query(detailQuery);
      // Use combination key to avoid overwriting data for same user in different territories
      const detailKey = `${user.UserId}-${user.TerritoryId}`;
      detailDataMap[detailKey] = detailResult.recordset;
    }

    // Return data for Excel generation (will be handled by frontend)
    res.json({
      success: true,
      data: {
        summary: summaryData,
        details: detailDataMap,
      },
    });
  } catch (error) {
    console.error("Error exporting report:", error);
    res.status(500).json({
      success: false,
      message: "Error exporting report",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// Get stores by date (for bar chart) - số cửa hàng đã/chưa thực hiện theo ngày
async function getStoresByDate(req, res) {
  try {
    const { startDate, endDate, territoryId } = req.query;
    const pool = await getPool();
    const request = pool.request();

    // Get current user from token
    const currentUserId = req.user?.id || req.user?.userId;
    const currentUserRole = req.user?.role || req.user?.Role || req.user?.RoleName;

    // Build user filter - only show stores assigned to current user (unless admin)
    let userFilter = "";
    if (currentUserId && currentUserRole !== "admin") {
      userFilter = ` AND (
        s.UserId = @currentUserId
        OR EXISTS (
          SELECT 1 FROM StoreUsers su
          WHERE su.StoreId = s.Id AND su.UserId = @currentUserId
        )
      )`;
      request.input("currentUserId", sql.Int, parseInt(currentUserId, 10));
    }

    // Build territory filter
    let territoryFilter = "";
    if (territoryId) {
      territoryFilter = " AND s.TerritoryId = @territoryId";
      request.input("territoryId", sql.Int, parseInt(territoryId, 10));
    }

    // Get total stores count (for calculating not audited)
    let totalStoresQuery = `
      SELECT COUNT(DISTINCT s.Id) as TotalStores
      FROM Stores s
      WHERE 1=1 ${userFilter} ${territoryFilter}
    `;
    const totalStoresResult = await request.query(totalStoresQuery);
    const totalStores = totalStoresResult.recordset[0].TotalStores || 0;

    // Get audited stores by date
    let query = `
      SELECT 
        CAST(a.AuditDate AS DATE) as AuditDate,
        COUNT(DISTINCT a.StoreId) as AuditedCount
      FROM Audits a
      INNER JOIN Stores s ON a.StoreId = s.Id
      INNER JOIN Images img ON a.Id = img.AuditId
      WHERE img.ImageUrl IS NOT NULL 
        AND img.ImageUrl != ''
        AND CAST(a.AuditDate AS DATE) IS NOT NULL
    `;

    if (currentUserId && currentUserRole !== "admin") {
      query += ` AND (
        s.UserId = @currentUserId
        OR EXISTS (
          SELECT 1 FROM StoreUsers su
          WHERE su.StoreId = s.Id AND su.UserId = @currentUserId
        )
      )`;
    }

    if (territoryId) {
      query += " AND s.TerritoryId = @territoryId";
    }

    if (startDate) {
      query += " AND CAST(a.AuditDate AS DATE) >= @startDate";
      request.input("startDate", sql.Date, startDate);
    }

    if (endDate) {
      query += " AND CAST(a.AuditDate AS DATE) <= @endDate";
      request.input("endDate", sql.Date, endDate);
    }

    query += `
      GROUP BY CAST(a.AuditDate AS DATE)
      ORDER BY AuditDate ASC
    `;

    const result = await request.query(query);

    // Calculate not audited count for each date
    // Not audited = Total stores - stores audited up to that date
    const processedData = result.recordset.map((row) => {
      // For each date, not audited = total - audited on that date
      // This is a simplified calculation - in reality, we might want cumulative counts
      return {
        AuditDate: row.AuditDate,
        AuditedCount: row.AuditedCount,
        NotAuditedCount: Math.max(0, totalStores - row.AuditedCount),
      };
    });

    res.json({
      success: true,
      data: processedData,
    });
  } catch (error) {
    console.error("Error fetching stores by date:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching stores by date",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// Get product prices (for pie chart) - giá mua/giá bán theo loại sản phẩm (ProductType)
async function getProductPrices(req, res) {
  try {
    const { productType } = req.query;
    const pool = await getPool();
    const request = pool.request();

    // Get current user from token
    const currentUserId = req.user?.id || req.user?.userId;
    const currentUserRole = req.user?.role || req.user?.Role || req.user?.RoleName;

    let query = `
      SELECT 
        ssp.PurchasePrice,
        ssp.SellingPrice,
        COUNT(*) as Count
      FROM StoreSurveyProducts ssp
      INNER JOIN StoreSurveys ss ON ssp.StoreSurveyId = ss.Id
      INNER JOIN Stores s ON ss.StoreId = s.Id
      WHERE ssp.PurchasePrice IS NOT NULL
        AND ssp.SellingPrice IS NOT NULL
    `;

    // Filter by user - only show stores assigned to current user (unless admin)
    if (currentUserId && currentUserRole !== "admin") {
      query += ` AND (
        s.UserId = @currentUserId
        OR EXISTS (
          SELECT 1 FROM StoreUsers su
          WHERE su.StoreId = s.Id AND su.UserId = @currentUserId
        )
      )`;
      request.input("currentUserId", sql.Int, parseInt(currentUserId, 10));
    }

    // Filter by ProductType if provided, otherwise get all
    if (productType && productType.trim() !== "") {
      query += " AND ssp.ProductType = @productType";
      request.input("productType", sql.NVarChar(100), productType.trim());
    }

    query += `
      GROUP BY ssp.PurchasePrice, ssp.SellingPrice
      ORDER BY ssp.PurchasePrice ASC, ssp.SellingPrice ASC
    `;

    const result = await request.query(query);

    // Calculate totals for pie chart
    const totalPurchase = result.recordset.reduce(
      (sum, row) => sum + (row.PurchasePrice || 0) * (row.Count || 0),
      0
    );
    const totalSelling = result.recordset.reduce(
      (sum, row) => sum + (row.SellingPrice || 0) * (row.Count || 0),
      0
    );

    res.json({
      success: true,
      data: {
        prices: result.recordset,
        totalPurchase,
        totalSelling,
      },
    });
  } catch (error) {
    console.error("Error fetching product prices:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching product prices",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// Get product types (for dropdown) - lấy danh sách loại sản phẩm
async function getProductTypes(req, res) {
  try {
    const pool = await getPool();
    const request = pool.request();

    const query = `
      SELECT DISTINCT ProductType
      FROM StoreSurveyProducts
      WHERE ProductType IS NOT NULL
        AND ProductType != ''
      ORDER BY ProductType ASC
    `;

    const result = await request.query(query);
    const productTypes = result.recordset.map((row) => row.ProductType);

    res.json({
      success: true,
      data: productTypes,
    });
  } catch (error) {
    console.error("Error fetching product types:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching product types",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// Get summary table - table tổng hợp cửa hàng, audit status, sản phẩm, giá
async function getSummaryTable(req, res) {
  try {
    const { page = 1, pageSize = 20, territoryId, startDate, endDate } = req.query;
    const pool = await getPool();
    const request = pool.request();

    // Get current user from token
    const currentUserId = req.user?.id || req.user?.userId;
    const currentUserRole = req.user?.role || req.user?.Role || req.user?.RoleName;

    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const limit = parseInt(pageSize, 10);

    let query = `
      SELECT 
        s.Id as StoreId,
        s.StoreCode,
        s.StoreName,
        t.TerritoryName,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM Audits a
            INNER JOIN Images img ON a.Id = img.AuditId
            WHERE a.StoreId = s.Id
              AND img.ImageUrl IS NOT NULL
              AND img.ImageUrl != ''
          ) THEN 'Đã thực hiện'
          ELSE 'Chưa thực hiện'
        END as AuditStatus,
        cp.Name as ProductName,
        ssp.PurchasePrice,
        ssp.SellingPrice
      FROM Stores s
      LEFT JOIN Territories t ON s.TerritoryId = t.Id
      LEFT JOIN StoreSurveys ss ON s.Id = ss.StoreId
      LEFT JOIN StoreSurveyProducts ssp ON ss.Id = ssp.StoreSurveyId
      LEFT JOIN CementProducts cp ON ssp.CementProductId = cp.Id
      WHERE 1=1
    `;

    // Filter by user - only show stores assigned to current user (unless admin)
    if (currentUserId && currentUserRole !== "admin") {
      query += ` AND (
        s.UserId = @currentUserId
        OR EXISTS (
          SELECT 1 FROM StoreUsers su
          WHERE su.StoreId = s.Id AND su.UserId = @currentUserId
        )
      )`;
      request.input("currentUserId", sql.Int, parseInt(currentUserId, 10));
    }

    // Filter by user - only show stores assigned to current user (unless admin)
    if (currentUserId && currentUserRole !== "admin") {
      query += ` AND (
        s.UserId = @currentUserId
        OR EXISTS (
          SELECT 1 FROM StoreUsers su
          WHERE su.StoreId = s.Id AND su.UserId = @currentUserId
        )
      )`;
      request.input("currentUserId", sql.Int, parseInt(currentUserId, 10));
    }

    if (territoryId) {
      query += " AND s.TerritoryId = @territoryId";
      request.input("territoryId", sql.Int, parseInt(territoryId, 10));
    }

    // Date filters should apply to audit date
    // If date filters are provided, only show stores that have audits in that date range
    // OR stores that have no audits at all (so they appear in the "Chưa thực hiện" status)
    if (startDate || endDate) {
      query += ` AND (
        NOT EXISTS (SELECT 1 FROM Audits a3 WHERE a3.StoreId = s.Id)
        OR EXISTS (
          SELECT 1 FROM Audits a2
          INNER JOIN Images img2 ON a2.Id = img2.AuditId
          WHERE a2.StoreId = s.Id
            AND img2.ImageUrl IS NOT NULL
            AND img2.ImageUrl != ''
      `;
      if (startDate) {
        query += " AND CAST(a2.AuditDate AS DATE) >= @startDate";
        request.input("startDate", sql.Date, startDate);
      }
      if (endDate) {
        query += " AND CAST(a2.AuditDate AS DATE) <= @endDate";
        request.input("endDate", sql.Date, endDate);
      }
      query += " )";
      query += " )";
    }

    // Count total - build separate count query
    let countQuery = `
      SELECT COUNT(DISTINCT s.Id) as Total
      FROM Stores s
      LEFT JOIN Territories t ON s.TerritoryId = t.Id
      WHERE 1=1
    `;
    
    // Apply user filter to count query
    if (currentUserId && currentUserRole !== "admin") {
      countQuery += ` AND (
        s.UserId = @currentUserId
        OR EXISTS (
          SELECT 1 FROM StoreUsers su
          WHERE su.StoreId = s.Id AND su.UserId = @currentUserId
        )
      )`;
    }
    
    if (territoryId) {
      countQuery += " AND s.TerritoryId = @territoryId";
    }
    
    if (startDate || endDate) {
      countQuery += ` AND (
        NOT EXISTS (SELECT 1 FROM Audits a3 WHERE a3.StoreId = s.Id)
        OR EXISTS (
          SELECT 1 FROM Audits a2
          INNER JOIN Images img2 ON a2.Id = img2.AuditId
          WHERE a2.StoreId = s.Id
            AND img2.ImageUrl IS NOT NULL
            AND img2.ImageUrl != ''
      `;
      if (startDate) {
        countQuery += " AND CAST(a2.AuditDate AS DATE) >= @startDate";
      }
      if (endDate) {
        countQuery += " AND CAST(a2.AuditDate AS DATE) <= @endDate";
      }
      countQuery += " )";
      countQuery += " )";
    }
    
    const countRequest = pool.request();
    if (currentUserId && currentUserRole !== "admin") {
      countRequest.input("currentUserId", sql.Int, parseInt(currentUserId, 10));
    }
    if (territoryId) {
      countRequest.input("territoryId", sql.Int, parseInt(territoryId, 10));
    }
    if (startDate) {
      countRequest.input("startDate", sql.Date, startDate);
    }
    if (endDate) {
      countRequest.input("endDate", sql.Date, endDate);
    }
    const countResult = await countRequest.query(countQuery);
    const total = countResult.recordset[0].Total || 0;

    // Build ORDER BY clause to prioritize:
    // 1. "Đã thực hiện" stores with purchase/selling prices
    // 2. "Đã thực hiện" stores without prices
    // 3. "Chưa thực hiện" stores with prices
    // 4. "Chưa thực hiện" stores without prices
    query += `
      ORDER BY 
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM Audits a
            INNER JOIN Images img ON a.Id = img.AuditId
            WHERE a.StoreId = s.Id
              AND img.ImageUrl IS NOT NULL
              AND img.ImageUrl != ''
          ) THEN 0
          ELSE 1
        END ASC,
        CASE 
          WHEN ssp.PurchasePrice IS NOT NULL AND ssp.SellingPrice IS NOT NULL THEN 0
          ELSE 1
        END ASC,
        s.StoreName ASC, 
        cp.Name ASC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    request.input("offset", sql.Int, offset);
    request.input("limit", sql.Int, limit);

    const result = await request.query(query);

    // Set UTF-8 encoding for response
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({
      success: true,
      data: result.recordset,
      pagination: {
        page: parseInt(page, 10),
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching summary table:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching summary table",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// Get stores with audit status by date - lấy danh sách cửa hàng với trạng thái audit theo ngày
async function getStoresWithAuditStatus(req, res) {
  try {
    const { startDate, endDate, territoryId, storeId } = req.query;
    const pool = await getPool();
    const request = pool.request();

    // Get current user from token
    const currentUserId = req.user?.id || req.user?.userId;
    const currentUserRole = req.user?.role || req.user?.Role || req.user?.RoleName;

    let query = `
      SELECT DISTINCT
        s.Id as StoreId,
        s.StoreName,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM Audits a
            INNER JOIN Images img ON a.Id = img.AuditId
            WHERE a.StoreId = s.Id
              AND CAST(a.AuditDate AS DATE) BETWEEN @startDate AND @endDate
              AND img.ImageUrl IS NOT NULL
              AND img.ImageUrl != ''
          ) THEN 1
          ELSE 0
        END as IsAudited
      FROM Stores s
      WHERE 1=1
    `;

    // Filter by user - only show stores assigned to current user (unless admin)
    if (currentUserId && currentUserRole !== "admin") {
      query += ` AND (
        s.UserId = @currentUserId
        OR EXISTS (
          SELECT 1 FROM StoreUsers su
          WHERE su.StoreId = s.Id AND su.UserId = @currentUserId
        )
      )`;
      request.input("currentUserId", sql.Int, parseInt(currentUserId, 10));
    }

    if (territoryId) {
      query += " AND s.TerritoryId = @territoryId";
      request.input("territoryId", sql.Int, parseInt(territoryId, 10));
    }

    if (storeId) {
      query += " AND s.Id = @storeId";
      request.input("storeId", sql.Int, parseInt(storeId, 10));
    }

    // Set date range
    const start = startDate || new Date().toISOString().split("T")[0];
    const end = endDate || new Date().toISOString().split("T")[0];
    request.input("startDate", sql.Date, start);
    request.input("endDate", sql.Date, end);

    query += ` ORDER BY s.StoreName ASC`;

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset.map((row) => ({
        StoreId: row.StoreId,
        StoreName: row.StoreName,
        IsAudited: row.IsAudited === 1,
      })),
    });
  } catch (error) {
    console.error("Error fetching stores with audit status:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching stores with audit status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// Get store survey details - chi tiết khảo sát cửa hàng
async function getStoreSurveyDetails(req, res) {
  try {
    const { startDate, endDate, territoryId } = req.query;
    const pool = await getPool();
    const request = pool.request();

    // Get current user from token
    const currentUserId = req.user?.id || req.user?.userId;
    const currentUserRole = req.user?.role || req.user?.Role || req.user?.RoleName;

    let query = `
      SELECT DISTINCT
        s.Id as StoreId,
        s.StoreName,
        AVG(ssp.PurchasePrice) as PurchasePrice,
        AVG(ssp.SellingPrice) as SellingPrice,
        AVG(ssp.AverageStockQuantity) as AverageStockQuantity,
        AVG(ssp.QuantityReceived) as QuantityReceived
      FROM StoreSurveys ss
      INNER JOIN Stores s ON ss.StoreId = s.Id
      INNER JOIN StoreSurveyProducts ssp ON ss.Id = ssp.StoreSurveyId
      INNER JOIN Audits a ON ss.AuditId = a.Id
      WHERE 1=1
    `;

    // Filter by user - only show stores assigned to current user (unless admin)
    if (currentUserId && currentUserRole !== "admin") {
      query += ` AND (
        s.UserId = @currentUserId
        OR EXISTS (
          SELECT 1 FROM StoreUsers su
          WHERE su.StoreId = s.Id AND su.UserId = @currentUserId
        )
      )`;
      request.input("currentUserId", sql.Int, parseInt(currentUserId, 10));
    }

    if (territoryId) {
      query += " AND s.TerritoryId = @territoryId";
      request.input("territoryId", sql.Int, parseInt(territoryId, 10));
    }

    if (startDate) {
      query += " AND CAST(a.AuditDate AS DATE) >= @startDate";
      request.input("startDate", sql.Date, startDate);
    }

    if (endDate) {
      query += " AND CAST(a.AuditDate AS DATE) <= @endDate";
      request.input("endDate", sql.Date, endDate);
    }

    query += `
      GROUP BY s.Id, s.StoreName
      ORDER BY s.StoreName ASC
    `;

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset.map((row) => ({
        StoreId: row.StoreId,
        StoreName: row.StoreName,
        PurchasePrice: row.PurchasePrice ? Math.round(row.PurchasePrice) : null,
        SellingPrice: row.SellingPrice ? Math.round(row.SellingPrice) : null,
        AverageStockQuantity: row.AverageStockQuantity ? Math.round(row.AverageStockQuantity * 100) / 100 : null,
        QuantityReceived: row.QuantityReceived ? Math.round(row.QuantityReceived * 100) / 100 : null,
      })),
    });
  } catch (error) {
    console.error("Error fetching store survey details:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching store survey details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

module.exports = {
  getSummary,
  getUserDetail,
  exportReport,
  getStoresByDate,
  getProductPrices,
  getProductTypes,
  getSummaryTable,
  getStoreSurveyDetails,
  getStoresWithAuditStatus,
};
