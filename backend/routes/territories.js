const express = require('express');
const router = express.Router();
const { getPool, sql } = require('../config/database');
const { authenticateToken } = require('../middlewares/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { workPosition } = req.query;
    const pool = await getPool();
    const request = pool.request();

    let query = `SELECT * FROM Territories`;
    const conditions = [];
    const orderBy = ` ORDER BY TerritoryName ASC`;

    // Filter by workPosition: join through Stores → Audits → Users
    if (workPosition && workPosition.trim()) {
      request.input('WorkPosition', sql.NVarChar(200), workPosition.trim());
      query = `
        SELECT DISTINCT t.Id, t.TerritoryName, t.CreatedAt, t.UpdatedAt
        FROM Territories t
        INNER JOIN Stores s ON s.TerritoryId = t.Id
        INNER JOIN Audits a ON a.StoreId = s.Id
        INNER JOIN Users u ON a.UserId = u.Id
        WHERE u.WorkPosition = @WorkPosition
        ORDER BY t.TerritoryName ASC
      `;
    } else {
      query += orderBy;
    }

    const result = await request.query(query);
    res.json({
      success: true,
      data: result.recordset
    });
  } catch (error) {
    console.error('Error fetching territories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching territories',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { territoryName } = req.body;

    if (!territoryName || !territoryName.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Tên địa bàn là bắt buộc'
      });
    }

    // Check if territory already exists
    const existing = await Territory.findByName(territoryName.trim());
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Địa bàn này đã tồn tại'
      });
    }

    const territory = await Territory.create(territoryName.trim());
    res.status(201).json({
      success: true,
      data: territory,
      message: 'Đã thêm địa bàn thành công'
    });
  } catch (error) {
    console.error('Error creating territory:', error);
    res.status(500).json({
      success: false,
      error: 'Lỗi máy chủ. Vui lòng thử lại sau.'
    });
  }
});

module.exports = router;

