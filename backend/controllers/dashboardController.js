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
        SELECT DISTINCT
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
        s.StoreName,
        s.Address,
        MIN(img.CapturedAt) as CheckinTime,
        a.Notes
      FROM Audits a
      INNER JOIN Stores s ON a.StoreId = s.Id
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
      GROUP BY CAST(a.AuditDate AS DATE), a.Id, s.StoreName, s.Address, a.Notes
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
        SELECT DISTINCT
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
          MIN(img.CapturedAt) as CheckinTime,
          a.Notes
        FROM Audits a
        INNER JOIN Stores s ON a.StoreId = s.Id
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
        GROUP BY CAST(a.AuditDate AS DATE), a.Id, s.StoreName, s.Address, a.Notes
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

module.exports = {
  getSummary,
  getUserDetail,
  exportReport,
};
