const express = require('express');
const router = express.Router();
const Territory = require('../models/Territory');
const { authenticateToken } = require('../middlewares/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const territories = await Territory.findAll();
    res.json({
      success: true,
      data: territories
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

