const { getPool, dualDB, sql } = require("../config/database");

// Get dashboard summary with filters
async function getSummary(req, res) {
  try {
    const { territoryIds, userIds, startDate, endDate } = req.query;
    const { main, backup } = await dualDB.getBothPools();
    const request = main.request();

    // Build CTE filter conditions once (shared by both DB queries)
    const dateConditions = [];

    if (startDate) {
      dateConditions.push("CAST(a.AuditDate AS DATE) >= @startDate");
      request.input("startDate", sql.Date, startDate);
    }
    if (endDate) {
      dateConditions.push("CAST(a.AuditDate AS DATE) <= @endDate");
      request.input("endDate", sql.Date, endDate);
    }

    const dateClause = dateConditions.length > 0 ? " AND " + dateConditions.join(" AND ") : "";

    const territoryClause = (() => {
      if (!territoryIds) return "";
      const arr = Array.isArray(territoryIds) ? territoryIds : territoryIds.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (arr.length === 0) return "";
      const parts = arr.map((id, i) => {
        const p = `territory${i}`;
        request.input(p, sql.Int, id);
        return `@${p}`;
      });
      return " AND a.TerritoryId IN (" + parts.join(",") + ")";
    })();

    const userClause = (() => {
      if (!userIds) return "";
      const arr = Array.isArray(userIds) ? userIds : userIds.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (arr.length === 0) return "";
      const parts = arr.map((id, i) => {
        const p = `user${i}`;
        request.input(p, sql.Int, id);
        return `@${p}`;
      });
      return " AND a.UserId IN (" + parts.join(",") + ")";
    })();

    const cteWhere = dateClause + territoryClause + userClause;

    // Main DB query
    const mainQuery = `
      WITH AuditsWithStatus AS (
        SELECT
          a.UserId,
          a.StoreId,
          CAST(a.AuditDate AS DATE) as AuditDate,
          s.TerritoryId
        FROM [DBXMTD].[dbo].[Audits] a
        INNER JOIN [DBXMTD].[dbo].[Stores] s ON a.StoreId = s.Id
        WHERE 1=1 ${cteWhere}
      )
      SELECT
        a.UserId as UserId,
        u.FullName,
        a.TerritoryId,
        t.TerritoryName,
        COUNT(DISTINCT a.AuditDate) as TotalCheckinDays,
        COUNT(DISTINCT a.StoreId) as TotalStoresChecked
      FROM AuditsWithStatus a
      INNER JOIN [DBXMTD].[dbo].[Users] u ON a.UserId = u.Id
      INNER JOIN [DBXMTD].[dbo].[Territories] t ON a.TerritoryId = t.Id
      WHERE u.Role = 'sales'
        AND a.UserId IS NOT NULL
      GROUP BY a.UserId, u.FullName, a.TerritoryId, t.TerritoryName
      HAVING COUNT(DISTINCT a.AuditDate) > 0
      ORDER BY u.FullName ASC
    `;

    // Backup DB query (only if backup DB is available)
    let backupQuery = null;
    let backupRequest = null;
    if (backup) {
      backupRequest = backup.request();
      // Copy date params
      if (startDate) backupRequest.input("startDate", sql.Date, startDate);
      if (endDate) backupRequest.input("endDate", sql.Date, endDate);
      // Copy territory params
      if (territoryIds) {
        const arr = Array.isArray(territoryIds) ? territoryIds : territoryIds.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        arr.forEach((id, i) => {
          backupRequest.input(`territory${i}`, sql.Int, id);
        });
      }
      // Copy user params
      if (userIds) {
        const arr = Array.isArray(userIds) ? userIds : userIds.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        arr.forEach((id, i) => {
          backupRequest.input(`user${i}`, sql.Int, id);
        });
      }

      backupQuery = `
        WITH AuditsWithStatus AS (
          SELECT
            a.UserId,
            a.StoreId,
            CAST(a.AuditDate AS DATE) as AuditDate,
            s.TerritoryId
          FROM [RE_SALE_20260410].[dbo].[Audits] a
          INNER JOIN [RE_SALE_20260410].[dbo].[Stores] s ON a.StoreId = s.Id
          WHERE 1=1 ${cteWhere}
        )
        SELECT
          a.UserId as UserId,
          u.FullName,
          a.TerritoryId,
          t.TerritoryName,
          COUNT(DISTINCT a.AuditDate) as TotalCheckinDays,
          COUNT(DISTINCT a.StoreId) as TotalStoresChecked
        FROM AuditsWithStatus a
        INNER JOIN [RE_SALE_20260410].[dbo].[Users] u ON a.UserId = u.Id
        INNER JOIN [RE_SALE_20260410].[dbo].[Territories] t ON a.TerritoryId = t.Id
        WHERE u.Role = 'sales'
          AND a.UserId IS NOT NULL
        GROUP BY a.UserId, u.FullName, a.TerritoryId, t.TerritoryName
        HAVING COUNT(DISTINCT a.AuditDate) > 0
        ORDER BY u.FullName ASC
      `;
    }

    // Execute both queries in parallel
    const [mainResult, backupResult] = await Promise.all([
      request.query(mainQuery),
      backupQuery && backupRequest ? backupRequest.query(backupQuery) : Promise.resolve({ recordset: [] }),
    ]);

    // Merge & deduplicate: main DB takes precedence
    const seen = new Set();
    const merged = [];
    for (const row of mainResult.recordset) {
      seen.add(`${row.UserId}|${row.TerritoryId}`);
      merged.push(row);
    }
    for (const row of backupResult.recordset) {
      if (!seen.has(`${row.UserId}|${row.TerritoryId}`)) {
        merged.push(row);
      }
    }

    request.timeout = 60000;

    res.json({ success: true, data: merged });
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching dashboard summary",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// Get user detail checkin data (dual DB)
async function getUserDetail(req, res) {
  try {
    const { userId } = req.params;
    const { startDate, endDate, storeName, territoryId } = req.query;

    console.log("getUserDetail called with params:", { userId, startDate, endDate, storeName });

    const { main, backup } = await dualDB.getBothPools();
    const request = main.request();
    request.input("UserId", sql.Int, userId);

    const buildAuditQuery = (dbPrefix, reqObj) => {
      let q = `
        SELECT
          CAST(a.AuditDate AS DATE) as CheckinDate,
          a.Id as AuditId,
          s.Id as StoreId,
          s.StoreName,
          s.Address,
          t.TerritoryName,
          MIN(img.CapturedAt) as CheckinTime,
          a.Notes
        FROM ${dbPrefix}[Audits] a
        INNER JOIN ${dbPrefix}[Stores] s ON a.StoreId = s.Id
        LEFT JOIN ${dbPrefix}[Territories] t ON s.TerritoryId = t.Id
        LEFT JOIN ${dbPrefix}[Images] img ON a.Id = img.AuditId
        WHERE a.UserId = @UserId
      `;
      if (territoryId) {
        q += " AND s.TerritoryId = @TerritoryId";
        reqObj.input("TerritoryId", sql.Int, parseInt(territoryId, 10));
      }
      if (startDate) {
        q += " AND CAST(a.AuditDate AS DATE) >= @startDate";
        reqObj.input("startDate", sql.Date, startDate);
      }
      if (endDate) {
        q += " AND CAST(a.AuditDate AS DATE) <= @endDate";
        reqObj.input("endDate", sql.Date, endDate);
      }
      if (storeName && storeName.trim() !== "") {
        q += " AND s.StoreName LIKE @storeName";
        reqObj.input("storeName", sql.NVarChar(200), `%${storeName.trim()}%`);
      }
      q += `
        GROUP BY CAST(a.AuditDate AS DATE), a.Id, s.Id, s.StoreName, s.Address, t.TerritoryName, a.Notes
        ORDER BY CheckinDate DESC, CheckinTime DESC
      `;
      return q;
    };

    const mainQuery = buildAuditQuery("[DBXMTD].[dbo].", request);

    let backupRequest = null;
    let backupQuery = null;
    if (backup) {
      backupRequest = backup.request();
      backupRequest.input("UserId", sql.Int, userId);
      if (territoryId) backupRequest.input("TerritoryId", sql.Int, parseInt(territoryId, 10));
      if (startDate) backupRequest.input("startDate", sql.Date, startDate);
      if (endDate) backupRequest.input("endDate", sql.Date, endDate);
      if (storeName && storeName.trim() !== "") {
        backupRequest.input("storeName", sql.NVarChar(200), `%${storeName.trim()}%`);
      }
      backupQuery = buildAuditQuery("[RE_SALE_20260410].[dbo].", backupRequest);
    }

    request.timeout = 60000;
    const [mainResult, backupResult] = await Promise.all([
      request.query(mainQuery),
      backupQuery && backupRequest ? backupRequest.query(backupQuery) : Promise.resolve({ recordset: [] }),
    ]);

    // Merge & dedupe by AuditId
    const seen = new Set();
    const merged = [];
    for (const row of mainResult.recordset) { seen.add(row.AuditId); merged.push(row); }
    for (const row of backupResult.recordset) { if (!seen.has(row.AuditId)) merged.push(row); }

    res.json({ success: true, data: merged });
  } catch (error) {
    console.error("Error fetching user detail:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user detail",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// Get territory detail checkin data (dual DB)
async function getTerritoryDetail(req, res) {
  try {
    const { territoryId } = req.params;
    const { startDate, endDate, storeName } = req.query;

    console.log("getTerritoryDetail called with params:", { territoryId, startDate, endDate, storeName });

    const currentUserId = req.user?.id || req.user?.userId;
    const currentUserRole = req.user?.role || req.user?.Role || req.user?.RoleName;

    const { main, backup } = await dualDB.getBothPools();
    const request = main.request();
    request.input("TerritoryId", sql.Int, parseInt(territoryId, 10));

    const buildAuditQuery = (dbPrefix, reqObj) => {
      let q = `
        SELECT
          CAST(a.AuditDate AS DATE) as CheckinDate,
          a.Id as AuditId,
          s.Id as StoreId,
          s.StoreName,
          s.Address,
          t.TerritoryName,
          MIN(img.CapturedAt) as CheckinTime,
          a.Notes
        FROM ${dbPrefix}[Audits] a
        INNER JOIN ${dbPrefix}[Stores] s ON a.StoreId = s.Id
        LEFT JOIN ${dbPrefix}[Territories] t ON s.TerritoryId = t.Id
        LEFT JOIN ${dbPrefix}[Images] img ON a.Id = img.AuditId
        WHERE s.TerritoryId = @TerritoryId
      `;
      if (currentUserId && currentUserRole !== "admin") {
        q += ` AND a.UserId = @currentUserId`;
        reqObj.input("currentUserId", sql.Int, parseInt(currentUserId, 10));
        q += ` AND (s.UserId = @currentUserId OR EXISTS (SELECT 1 FROM ${dbPrefix}[StoreUsers] su WHERE su.StoreId = s.Id AND su.UserId = @currentUserId))`;
      }
      if (startDate) {
        q += " AND CAST(a.AuditDate AS DATE) >= @startDate";
        reqObj.input("startDate", sql.Date, startDate);
      }
      if (endDate) {
        q += " AND CAST(a.AuditDate AS DATE) <= @endDate";
        reqObj.input("endDate", sql.Date, endDate);
      }
      if (storeName && storeName.trim() !== "") {
        q += " AND s.StoreName LIKE @storeName";
        reqObj.input("storeName", sql.NVarChar(200), `%${storeName.trim()}%`);
      }
      q += `
        GROUP BY CAST(a.AuditDate AS DATE), a.Id, s.Id, s.StoreName, s.Address, t.TerritoryName, a.Notes
        ORDER BY CheckinDate DESC, CheckinTime DESC
      `;
      return q;
    };

    const mainQuery = buildAuditQuery("[DBXMTD].[dbo].", request);

    let backupRequest = null;
    let backupQuery = null;
    if (backup) {
      backupRequest = backup.request();
      backupRequest.input("TerritoryId", sql.Int, parseInt(territoryId, 10));
      if (currentUserId && currentUserRole !== "admin") {
        backupRequest.input("currentUserId", sql.Int, parseInt(currentUserId, 10));
      }
      if (startDate) backupRequest.input("startDate", sql.Date, startDate);
      if (endDate) backupRequest.input("endDate", sql.Date, endDate);
      if (storeName && storeName.trim() !== "") {
        backupRequest.input("storeName", sql.NVarChar(200), `%${storeName.trim()}%`);
      }
      backupQuery = buildAuditQuery("[RE_SALE_20260410].[dbo].", backupRequest);
    }

    request.timeout = 60000;
    const [mainResult, backupResult] = await Promise.all([
      request.query(mainQuery),
      backupQuery && backupRequest ? backupRequest.query(backupQuery) : Promise.resolve({ recordset: [] }),
    ]);

    const seen = new Set();
    const merged = [];
    for (const row of mainResult.recordset) { seen.add(row.AuditId); merged.push(row); }
    for (const row of backupResult.recordset) { if (!seen.has(row.AuditId)) merged.push(row); }

    res.json({ success: true, data: merged });
  } catch (error) {
    console.error("Error fetching territory detail:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching territory detail",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

// Export Excel report
async function exportReport(req, res) {
  try {
    const { territoryIds, userIds, startDate, endDate } = req.query;
    const { main, backup } = await dualDB.getBothPools();
    const request = main.request();

    const dateConditions = [];
    if (startDate) {
      dateConditions.push("CAST(a.AuditDate AS DATE) >= @startDate");
      request.input("startDate", sql.Date, startDate);
    }
    if (endDate) {
      dateConditions.push("CAST(a.AuditDate AS DATE) <= @endDate");
      request.input("endDate", sql.Date, endDate);
    }
    const dateClause = dateConditions.length > 0 ? " AND " + dateConditions.join(" AND ") : "";

    const territoryClause = (() => {
      if (!territoryIds) return "";
      const arr = Array.isArray(territoryIds) ? territoryIds : territoryIds.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (arr.length === 0) return "";
      const parts = arr.map((id, i) => { request.input(`territory${i}`, sql.Int, id); return `@territory${i}`; });
      return " AND a.TerritoryId IN (" + parts.join(",") + ")";
    })();

    const userClause = (() => {
      if (!userIds) return "";
      const arr = Array.isArray(userIds) ? userIds : userIds.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (arr.length === 0) return "";
      const parts = arr.map((id, i) => { request.input(`user${i}`, sql.Int, id); return `@user${i}`; });
      return " AND a.UserId IN (" + parts.join(",") + ")";
    })();

    const cteWhere = dateClause + territoryClause + userClause;

    const mainQuery = `
      WITH AuditsWithStatus AS (
        SELECT
          a.UserId,
          a.StoreId,
          CAST(a.AuditDate AS DATE) as AuditDate,
          s.TerritoryId
        FROM [DBXMTD].[dbo].[Audits] a
        INNER JOIN [DBXMTD].[dbo].[Stores] s ON a.StoreId = s.Id
        WHERE 1=1 ${cteWhere}
      )
      SELECT
        a.UserId as UserId,
        u.FullName,
        a.TerritoryId,
        t.TerritoryName,
        COUNT(DISTINCT a.AuditDate) as TotalCheckinDays,
        COUNT(DISTINCT a.StoreId) as TotalStoresChecked
      FROM AuditsWithStatus a
      INNER JOIN [DBXMTD].[dbo].[Users] u ON a.UserId = u.Id
      INNER JOIN [DBXMTD].[dbo].[Territories] t ON a.TerritoryId = t.Id
      WHERE u.Role = 'sales' AND a.UserId IS NOT NULL
      GROUP BY a.UserId, u.FullName, a.TerritoryId, t.TerritoryName
      HAVING COUNT(DISTINCT a.AuditDate) > 0
      ORDER BY u.FullName ASC
    `;

    let backupQuery = null;
    let backupRequest = null;
    if (backup) {
      backupRequest = backup.request();
      if (startDate) backupRequest.input("startDate", sql.Date, startDate);
      if (endDate) backupRequest.input("endDate", sql.Date, endDate);
      if (territoryIds) {
        const arr = Array.isArray(territoryIds) ? territoryIds : territoryIds.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        arr.forEach((id, i) => backupRequest.input(`territory${i}`, sql.Int, id));
      }
      if (userIds) {
        const arr = Array.isArray(userIds) ? userIds : userIds.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        arr.forEach((id, i) => backupRequest.input(`user${i}`, sql.Int, id));
      }

      backupQuery = `
        WITH AuditsWithStatus AS (
          SELECT
            a.UserId,
            a.StoreId,
            CAST(a.AuditDate AS DATE) as AuditDate,
            s.TerritoryId
          FROM [RE_SALE_20260410].[dbo].[Audits] a
          INNER JOIN [RE_SALE_20260410].[dbo].[Stores] s ON a.StoreId = s.Id
          WHERE 1=1 ${cteWhere}
        )
        SELECT
          a.UserId as UserId,
          u.FullName,
          a.TerritoryId,
          t.TerritoryName,
          COUNT(DISTINCT a.AuditDate) as TotalCheckinDays,
          COUNT(DISTINCT a.StoreId) as TotalStoresChecked
        FROM AuditsWithStatus a
        INNER JOIN [RE_SALE_20260410].[dbo].[Users] u ON a.UserId = u.Id
        INNER JOIN [RE_SALE_20260410].[dbo].[Territories] t ON a.TerritoryId = t.Id
        WHERE u.Role = 'sales' AND a.UserId IS NOT NULL
        GROUP BY a.UserId, u.FullName, a.TerritoryId, t.TerritoryName
        HAVING COUNT(DISTINCT a.AuditDate) > 0
        ORDER BY u.FullName ASC
      `;
    }

    request.timeout = 60000;
    const [mainResult, backupResult] = await Promise.all([
      request.query(mainQuery),
      backupQuery && backupRequest ? backupRequest.query(backupQuery) : Promise.resolve({ recordset: [] }),
    ]);

    const seen = new Set();
    const merged = [];
    for (const row of mainResult.recordset) {
      seen.add(`${row.UserId}|${row.TerritoryId}`);
      merged.push(row);
    }
    for (const row of backupResult.recordset) {
      if (!seen.has(`${row.UserId}|${row.TerritoryId}`)) {
        merged.push(row);
      }
    }

    const summaryData = merged;

    // Get detail data for each user-territory combination
    const detailDataMap = {};
    for (const user of summaryData) {
      const detailRequest = main.request();
      detailRequest.input("UserId", sql.Int, user.UserId);
      detailRequest.input("TerritoryId", sql.Int, user.TerritoryId);
      if (startDate) detailRequest.input("startDate", sql.Date, startDate);
      if (endDate) detailRequest.input("endDate", sql.Date, endDate);
      detailRequest.timeout = 30000;

      let detailQuery = `
        SELECT
          CAST(a.AuditDate AS DATE) as CheckinDate,
          a.Id as AuditId,
          s.StoreName,
          s.Address,
          t.TerritoryName,
          MIN(img.CapturedAt) as CheckinTime,
          COALESCE(ss.StoreComment, a.Notes) as Notes
        FROM [DBXMTD].[dbo].[Audits] a
        INNER JOIN [DBXMTD].[dbo].[Stores] s ON a.StoreId = s.Id
        LEFT JOIN [DBXMTD].[dbo].[Territories] t ON s.TerritoryId = t.Id
        LEFT JOIN [DBXMTD].[dbo].[Images] img ON a.Id = img.AuditId
        LEFT JOIN [DBXMTD].[dbo].[StoreSurveys] ss ON a.Id = ss.AuditId
        WHERE a.UserId = @UserId AND s.TerritoryId = @TerritoryId
      `;
      if (startDate) detailQuery += " AND CAST(a.AuditDate AS DATE) >= @startDate";
      if (endDate) detailQuery += " AND CAST(a.AuditDate AS DATE) <= @endDate";
      detailQuery += `
        GROUP BY CAST(a.AuditDate AS DATE), a.Id, s.StoreName, s.Address, t.TerritoryName, ss.StoreComment, a.Notes
        ORDER BY CheckinDate DESC, CheckinTime DESC
      `;

      const detailResult = await detailRequest.query(detailQuery);
      const detailKey = `${user.UserId}-${user.TerritoryId}`;
      detailDataMap[detailKey] = detailResult.recordset;
    }

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

// Get stores by date (for bar chart) - dual DB
async function getStoresByDate(req, res) {
  try {
    const { startDate, endDate, territoryId } = req.query;
    const { main, backup } = await dualDB.getBothPools();
    const request = main.request();

    const currentUserId = req.user?.id || req.user?.userId;
    const currentUserRole = req.user?.role || req.user?.Role || req.user?.RoleName;

    // Build user filter - only show stores assigned to current user (unless admin)
    let userFilter = "";
    if (currentUserId && currentUserRole !== "admin") {
      userFilter = ` AND (s.UserId = @currentUserId OR EXISTS (SELECT 1 FROM [DBXMTD].[dbo].[StoreUsers] su WHERE su.StoreId = s.Id AND su.UserId = @currentUserId))`;
      request.input("currentUserId", sql.Int, parseInt(currentUserId, 10));
    }

    let territoryFilter = "";
    if (territoryId) {
      territoryFilter = " AND s.TerritoryId = @territoryId";
      request.input("territoryId", sql.Int, parseInt(territoryId, 10));
    }

    // Get total stores count (from main DB only – Stores are not backed up)
    let totalStoresQuery = `
      SELECT COUNT(DISTINCT s.Id) as TotalStores
      FROM [DBXMTD].[dbo].[Stores] s
      WHERE 1=1 ${userFilter} ${territoryFilter}
    `;
    const totalStoresResult = await request.query(totalStoresQuery);
    const totalStores = totalStoresResult.recordset[0].TotalStores || 0;

    // Build date filters
    let dateFilters = "";
    if (startDate) {
      dateFilters += " AND CAST(a.AuditDate AS DATE) >= @startDate";
      request.input("startDate", sql.Date, startDate);
    }
    if (endDate) {
      dateFilters += " AND CAST(a.AuditDate AS DATE) <= @endDate";
      request.input("endDate", sql.Date, endDate);
    }

    const mainQuery = `
      SELECT
        CAST(a.AuditDate AS DATE) as AuditDate,
        COUNT(DISTINCT a.StoreId) as AuditedCount
      FROM [DBXMTD].[dbo].[Audits] a
      INNER JOIN [DBXMTD].[dbo].[Stores] s ON a.StoreId = s.Id
      WHERE CAST(a.AuditDate AS DATE) IS NOT NULL
        ${currentUserId && currentUserRole !== "admin" ? `AND a.UserId = @currentUserId ${userFilter}` : ""}
        ${territoryFilter}${dateFilters}
      GROUP BY CAST(a.AuditDate AS DATE)
      ORDER BY AuditDate ASC
    `;

    let backupRequest = null;
    let backupQuery = null;
    if (backup) {
      backupRequest = backup.request();
      if (currentUserId && currentUserRole !== "admin") {
        backupRequest.input("currentUserId", sql.Int, parseInt(currentUserId, 10));
        const backupUserFilter = ` AND (s.UserId = @currentUserId OR EXISTS (SELECT 1 FROM [RE_SALE_20260410].[dbo].[StoreUsers] su WHERE su.StoreId = s.Id AND su.UserId = @currentUserId))`;
        backupQuery = `
          SELECT
            CAST(a.AuditDate AS DATE) as AuditDate,
            COUNT(DISTINCT a.StoreId) as AuditedCount
          FROM [RE_SALE_20260410].[dbo].[Audits] a
          INNER JOIN [RE_SALE_20260410].[dbo].[Stores] s ON a.StoreId = s.Id
          WHERE CAST(a.AuditDate AS DATE) IS NOT NULL
            AND a.UserId = @currentUserId ${backupUserFilter}
            ${territoryId ? ` AND s.TerritoryId = @territoryId` : ""}
            ${dateFilters}
          GROUP BY CAST(a.AuditDate AS DATE)
          ORDER BY AuditDate ASC
        `;
        if (territoryId) backupRequest.input("territoryId", sql.Int, parseInt(territoryId, 10));
        if (startDate) backupRequest.input("startDate", sql.Date, startDate);
        if (endDate) backupRequest.input("endDate", sql.Date, endDate);
      }
    }

    request.timeout = 60000;
    const [mainResult, backupResult] = await Promise.all([
      request.query(mainQuery),
      backupQuery && backupRequest ? backupRequest.query(backupQuery) : Promise.resolve({ recordset: [] }),
    ]);

    // Merge: sum AuditedCount per date, main DB takes precedence in key
    const dateMap = new Map();
    for (const row of mainResult.recordset) {
      dateMap.set(row.AuditDate.toISOString().split("T")[0], row.AuditedCount || 0);
    }
    for (const row of backupResult.recordset) {
      const key = row.AuditDate.toISOString().split("T")[0];
      if (!dateMap.has(key)) {
        dateMap.set(key, row.AuditedCount || 0);
      }
    }

    const processedData = Array.from(dateMap.entries())
      .map(([dateStr, count]) => ({
        AuditDate: dateStr,
        AuditedCount: count,
        NotAuditedCount: Math.max(0, totalStores - count),
      }))
      .sort((a, b) => a.AuditDate.localeCompare(b.AuditDate));

    console.log("getStoresByDate - Total stores:", totalStores, "Data points:", processedData.length);

    res.json({ success: true, data: processedData });
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
    const currentUserRole =
      req.user?.role || req.user?.Role || req.user?.RoleName;

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
    const { main } = await dualDB.getBothPools();
    const request = main.request();

    const currentUserId = req.user?.id || req.user?.userId;
    const currentUserRole = req.user?.role || req.user?.Role || req.user?.RoleName;

    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
    const limit = parseInt(pageSize, 10);

    let userFilter = "";
    if (currentUserId && currentUserRole !== "admin") {
      userFilter = ` AND (s.UserId = @currentUserId OR EXISTS (SELECT 1 FROM [DBXMTD].[dbo].[StoreUsers] su WHERE su.StoreId = s.Id AND su.UserId = @currentUserId))`;
      request.input("currentUserId", sql.Int, parseInt(currentUserId, 10));
    }

    let territoryFilter = "";
    if (territoryId) {
      territoryFilter = " AND s.TerritoryId = @territoryId";
      request.input("territoryId", sql.Int, parseInt(territoryId, 10));
    }

    let dateFilter = "";
    if (startDate || endDate) {
      const hasStart = !!startDate;
      const hasEnd = !!endDate;
      if (hasStart) request.input("startDate", sql.Date, startDate);
      if (hasEnd) request.input("endDate", sql.Date, endDate);
      dateFilter = `
        AND (
          NOT EXISTS (SELECT 1 FROM [DBXMTD].[dbo].[Audits] a3 WHERE a3.StoreId = s.Id)
          OR EXISTS (
            SELECT 1 FROM [DBXMTD].[dbo].[Audits] a2
            WHERE a2.StoreId = s.Id
              ${hasStart ? "AND CAST(a2.AuditDate AS DATE) >= @startDate" : ""}
              ${hasEnd ? "AND CAST(a2.AuditDate AS DATE) <= @endDate" : ""}
          )
        )
      `;
    }

    const mainQuery = `
      SELECT
        s.Id as StoreId,
        s.StoreCode,
        s.StoreName,
        t.TerritoryName,
        CASE
          WHEN EXISTS (SELECT 1 FROM [DBXMTD].[dbo].[Audits] a WHERE a.StoreId = s.Id) THEN 'Đã thực hiện'
          ELSE 'Chưa thực hiện'
        END as AuditStatus,
        cp.Name as ProductName,
        ssp.PurchasePrice,
        ssp.SellingPrice
      FROM [DBXMTD].[dbo].[Stores] s
      LEFT JOIN [DBXMTD].[dbo].[Territories] t ON s.TerritoryId = t.Id
      LEFT JOIN [DBXMTD].[dbo].[StoreSurveys] ss ON s.Id = ss.StoreId
      LEFT JOIN [DBXMTD].[dbo].[StoreSurveyProducts] ssp ON ss.Id = ssp.StoreSurveyId
      LEFT JOIN [DBXMTD].[dbo].[CementProducts] cp ON ssp.CementProductId = cp.Id
      WHERE 1=1 ${userFilter}${territoryFilter}${dateFilter}
      ORDER BY
        CASE WHEN EXISTS (SELECT 1 FROM [DBXMTD].[dbo].[Audits] a WHERE a.StoreId = s.Id) THEN 0 ELSE 1 END ASC,
        CASE WHEN ssp.PurchasePrice IS NOT NULL AND ssp.SellingPrice IS NOT NULL THEN 0 ELSE 1 END ASC,
        s.StoreName ASC, cp.Name ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    // Count total
    let countQuery = `
      SELECT COUNT(DISTINCT s.Id) as Total
      FROM [DBXMTD].[dbo].[Stores] s
      WHERE 1=1 ${userFilter}${territoryFilter}${dateFilter}
    `;

    request.input("offset", sql.Int, offset);
    request.input("limit", sql.Int, limit);
    request.timeout = 60000;

    const [result, countResult] = await Promise.all([
      request.query(mainQuery),
      request.query(countQuery),
    ]);

    const total = countResult.recordset[0]?.Total || 0;

    res.setHeader("Content-Type", "application/json; charset=utf-8");
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

// Get stores summary by territory (for table below bar chart) - dual DB
async function getStoresByTerritory(req, res) {
  try {
    const { startDate, endDate, territoryId } = req.query;
    const { main, backup } = await dualDB.getBothPools();
    const request = main.request();

    const currentUserId = req.user?.id || req.user?.userId;
    const currentUserRole = req.user?.role || req.user?.Role || req.user?.RoleName;

    let dateFilters = "";
    if (startDate) {
      dateFilters += " AND CAST(a.AuditDate AS DATE) >= @startDate";
      request.input("startDate", sql.Date, startDate);
    }
    if (endDate) {
      dateFilters += " AND CAST(a.AuditDate AS DATE) <= @endDate";
      request.input("endDate", sql.Date, endDate);
    }

    let territoryFilter = "";
    if (territoryId) {
      territoryFilter = " AND t.Id = @territoryId";
      request.input("territoryId", sql.Int, parseInt(territoryId, 10));
    }

    let userFilter = "";
    if (currentUserId && currentUserRole !== "admin") {
      userFilter = ` AND a.UserId = @currentUserId`;
      request.input("currentUserId", sql.Int, parseInt(currentUserId, 10));
      userFilter += ` AND (s.UserId = @currentUserId OR EXISTS (SELECT 1 FROM [DBXMTD].[dbo].[StoreUsers] su WHERE su.StoreId = s.Id AND su.UserId = @currentUserId))`;
    }

    const mainQuery = `
      SELECT
        t.Id as TerritoryId,
        t.TerritoryName,
        COUNT(DISTINCT a.StoreId) as StoresChecked,
        COUNT(DISTINCT CAST(a.AuditDate AS DATE)) as CheckinDays
      FROM [DBXMTD].[dbo].[Audits] a
      INNER JOIN [DBXMTD].[dbo].[Stores] s ON a.StoreId = s.Id
      LEFT JOIN [DBXMTD].[dbo].[Territories] t ON s.TerritoryId = t.Id
      WHERE t.Id IS NOT NULL
        ${userFilter}${territoryFilter}${dateFilters}
      GROUP BY t.Id, t.TerritoryName
      ORDER BY t.TerritoryName ASC
    `;

    let backupRequest = null;
    let backupQuery = null;
    if (backup) {
      backupRequest = backup.request();
      let backupUserFilter = "";
      if (currentUserId && currentUserRole !== "admin") {
        backupUserFilter = ` AND a.UserId = @currentUserId`;
        backupRequest.input("currentUserId", sql.Int, parseInt(currentUserId, 10));
        backupUserFilter += ` AND (s.UserId = @currentUserId OR EXISTS (SELECT 1 FROM [RE_SALE_20260410].[dbo].[StoreUsers] su WHERE su.StoreId = s.Id AND su.UserId = @currentUserId))`;
      }
      if (territoryId) backupRequest.input("territoryId", sql.Int, parseInt(territoryId, 10));
      if (startDate) backupRequest.input("startDate", sql.Date, startDate);
      if (endDate) backupRequest.input("endDate", sql.Date, endDate);

      backupQuery = `
        SELECT
          t.Id as TerritoryId,
          t.TerritoryName,
          COUNT(DISTINCT a.StoreId) as StoresChecked,
          COUNT(DISTINCT CAST(a.AuditDate AS DATE)) as CheckinDays
        FROM [RE_SALE_20260410].[dbo].[Audits] a
        INNER JOIN [RE_SALE_20260410].[dbo].[Stores] s ON a.StoreId = s.Id
        LEFT JOIN [RE_SALE_20260410].[dbo].[Territories] t ON s.TerritoryId = t.Id
        WHERE t.Id IS NOT NULL
          ${backupUserFilter}${territoryFilter}${dateFilters}
        GROUP BY t.Id, t.TerritoryName
        ORDER BY t.TerritoryName ASC
      `;
    }

    request.timeout = 60000;
    const [mainResult, backupResult] = await Promise.all([
      request.query(mainQuery),
      backupQuery && backupRequest ? backupRequest.query(backupQuery) : Promise.resolve({ recordset: [] }),
    ]);

    // Merge by TerritoryId
    const territoryMap = new Map();
    for (const row of mainResult.recordset) {
      territoryMap.set(row.TerritoryId, {
        TerritoryId: row.TerritoryId,
        TerritoryName: row.TerritoryName,
        StoresChecked: row.StoresChecked || 0,
        CheckinDays: row.CheckinDays || 0,
      });
    }
    for (const row of backupResult.recordset) {
      if (territoryMap.has(row.TerritoryId)) {
        const existing = territoryMap.get(row.TerritoryId);
        existing.StoresChecked += row.StoresChecked || 0;
        existing.CheckinDays += row.CheckinDays || 0;
      } else {
        territoryMap.set(row.TerritoryId, {
          TerritoryId: row.TerritoryId,
          TerritoryName: row.TerritoryName,
          StoresChecked: row.StoresChecked || 0,
          CheckinDays: row.CheckinDays || 0,
        });
      }
    }

    const data = Array.from(territoryMap.values()).sort((a, b) =>
      (a.TerritoryName || "").localeCompare(b.TerritoryName || "")
    );

    const totals = data.reduce(
      (acc, item) => {
        acc.StoresChecked += item.StoresChecked || 0;
        acc.CheckinDays += item.CheckinDays || 0;
        return acc;
      },
      { StoresChecked: 0, CheckinDays: 0 }
    );

    console.log("getStoresByTerritory - Territories:", data.length, "Totals:", totals);

    res.json({
      success: true,
      data: { territories: data, totals },
    });
  } catch (error) {
    console.error("Error fetching stores by territory:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching stores by territory",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

module.exports = {
  getSummary,
  getUserDetail,
  getTerritoryDetail,
  exportReport,
  getStoresByDate,
  getProductPrices,
  getProductTypes,
  getSummaryTable,
  getStoresByTerritory,
};
