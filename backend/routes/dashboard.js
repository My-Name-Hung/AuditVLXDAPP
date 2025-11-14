const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middlewares/auth');

router.get('/summary', authenticateToken, dashboardController.getSummary);
router.get('/user/:userId', authenticateToken, dashboardController.getUserDetail);
router.get('/export', authenticateToken, dashboardController.exportReport);

module.exports = router;

