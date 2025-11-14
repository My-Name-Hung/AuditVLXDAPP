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

module.exports = router;

