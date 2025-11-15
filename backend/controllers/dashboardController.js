const { getPool, sql } = require('../config/database');

// Get dashboard summary with filters
async function getSummary(req, res) {
  try {
    const { territoryIds, startDate, endDate } = req.query;
    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT 
        u.Id as UserId,
        u.FullName,
        s.TerritoryId,
        t.TerritoryName,
        COUNT(DISTINCT CAST(a.AuditDate AS DATE)) as TotalCheckinDays,
        COUNT(DISTINCT a.StoreId) as TotalStoresChecked
      FROM Users u
      LEFT JOIN Audits a ON u.Id = a.UserId
      LEFT JOIN Stores s ON a.StoreId = s.Id
      LEFT JOIN Territories t ON s.TerritoryId = t.Id
      LEFT JOIN Images img ON a.Id = img.AuditId
      WHERE u.Role = 'user'
        AND img.ImageUrl IS NOT NULL
        AND img.ImageUrl != ''
    `;

    // Filter by territories (now from Stores)
    if (territoryIds) {
      const territoryArray = Array.isArray(territoryIds) 
        ? territoryIds 
        : territoryIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      
      if (territoryArray.length > 0) {
        query += ' AND s.TerritoryId IN (';
        territoryArray.forEach((id, index) => {
          const paramName = `territory${index}`;
          request.input(paramName, sql.Int, id);
          query += `@${paramName}`;
          if (index < territoryArray.length - 1) query += ',';
        });
        query += ')';
      }
    }

    // Filter by date range
    if (startDate) {
      query += ' AND CAST(a.AuditDate AS DATE) >= @startDate';
      request.input('startDate', sql.Date, startDate);
    }

    if (endDate) {
      query += ' AND CAST(a.AuditDate AS DATE) <= @endDate';
      request.input('endDate', sql.Date, endDate);
    }

    query += `
      GROUP BY u.Id, u.FullName, s.TerritoryId, t.TerritoryName
      HAVING COUNT(DISTINCT CAST(a.AuditDate AS DATE)) > 0
      ORDER BY u.FullName ASC
    `;

    const result = await request.query(query);
    
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Get user detail checkin data
async function getUserDetail(req, res) {
  try {
    const { userId } = req.params;
    const { startDate, endDate, storeName } = req.query;
    
    console.log('getUserDetail called with params:', { userId, startDate, endDate, storeName });
    
    const pool = await getPool();
    const request = pool.request();

    request.input('UserId', sql.Int, userId);

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

    if (startDate) {
      query += ' AND CAST(a.AuditDate AS DATE) >= @startDate';
      request.input('startDate', sql.Date, startDate);
      console.log('Added startDate filter:', startDate);
    }

    if (endDate) {
      query += ' AND CAST(a.AuditDate AS DATE) <= @endDate';
      request.input('endDate', sql.Date, endDate);
      console.log('Added endDate filter:', endDate);
    }

    // Filter by store name
    if (storeName && storeName.trim() !== '') {
      const storeNamePattern = `%${storeName.trim()}%`;
      query += ' AND s.StoreName LIKE @storeName';
      request.input('storeName', sql.NVarChar(200), storeNamePattern);
      console.log('Added storeName filter:', storeNamePattern);
    }

    query += `
      GROUP BY CAST(a.AuditDate AS DATE), a.Id, s.StoreName, s.Address, a.Notes
      ORDER BY CheckinDate DESC, CheckinTime DESC
    `;

    const result = await request.query(query);

    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Error fetching user detail:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user detail',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Export Excel report
async function exportReport(req, res) {
  try {
    const { territoryIds, startDate, endDate } = req.query;
    const pool = await getPool();
    const request = pool.request();

    // Get summary data (same as getSummary)
    let summaryQuery = `
      SELECT 
        u.Id as UserId,
        u.FullName,
        s.TerritoryId,
        t.TerritoryName,
        COUNT(DISTINCT CAST(a.AuditDate AS DATE)) as TotalCheckinDays,
        COUNT(DISTINCT a.StoreId) as TotalStoresChecked
      FROM Users u
      LEFT JOIN Audits a ON u.Id = a.UserId
      LEFT JOIN Stores s ON a.StoreId = s.Id
      LEFT JOIN Territories t ON s.TerritoryId = t.Id
      LEFT JOIN Images img ON a.Id = img.AuditId
      WHERE u.Role = 'user'
        AND img.ImageUrl IS NOT NULL
        AND img.ImageUrl != ''
    `;

    if (territoryIds) {
      const territoryArray = Array.isArray(territoryIds) 
        ? territoryIds 
        : territoryIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      
      if (territoryArray.length > 0) {
        summaryQuery += ' AND s.TerritoryId IN (';
        territoryArray.forEach((id, index) => {
          const paramName = `territory${index}`;
          request.input(paramName, sql.Int, id);
          summaryQuery += `@${paramName}`;
          if (index < territoryArray.length - 1) summaryQuery += ',';
        });
        summaryQuery += ')';
      }
    }

    if (startDate) {
      summaryQuery += ' AND CAST(a.AuditDate AS DATE) >= @startDate';
      request.input('startDate', sql.Date, startDate);
    }

    if (endDate) {
      summaryQuery += ' AND CAST(a.AuditDate AS DATE) <= @endDate';
      request.input('endDate', sql.Date, endDate);
    }

    summaryQuery += `
      GROUP BY u.Id, u.FullName, s.TerritoryId, t.TerritoryName
      HAVING COUNT(DISTINCT CAST(a.AuditDate AS DATE)) > 0
      ORDER BY u.FullName ASC
    `;

    const summaryResult = await request.query(summaryQuery);
    const summaryData = summaryResult.recordset;

    // Get detail data for each user
    const detailDataMap = {};
    for (const user of summaryData) {
      const detailRequest = pool.request();
      detailRequest.input('UserId', sql.Int, user.UserId);
      
      if (startDate) {
        detailRequest.input('startDate', sql.Date, startDate);
      }
      if (endDate) {
        detailRequest.input('endDate', sql.Date, endDate);
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
          AND img.ImageUrl IS NOT NULL
          AND img.ImageUrl != ''
      `;

      if (startDate) {
        detailQuery += ' AND CAST(a.AuditDate AS DATE) >= @startDate';
      }
      if (endDate) {
        detailQuery += ' AND CAST(a.AuditDate AS DATE) <= @endDate';
      }

      detailQuery += `
        GROUP BY CAST(a.AuditDate AS DATE), a.Id, s.StoreName, s.Address, a.Notes
        ORDER BY CheckinDate DESC, CheckinTime DESC
      `;

      const detailResult = await detailRequest.query(detailQuery);
      detailDataMap[user.UserId] = detailResult.recordset;
    }

    // Return data for Excel generation (will be handled by frontend)
    res.json({
      success: true,
      data: {
        summary: summaryData,
        details: detailDataMap
      }
    });
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = {
  getSummary,
  getUserDetail,
  exportReport
};

