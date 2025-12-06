const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middlewares/auth');

router.get('/summary', authenticateToken, dashboardController.getSummary);
router.get('/user/:userId', authenticateToken, dashboardController.getUserDetail);
router.get('/export', authenticateToken, dashboardController.exportReport);
router.get('/stores-by-date', authenticateToken, dashboardController.getStoresByDate);
router.get('/product-prices', authenticateToken, dashboardController.getProductPrices);
router.get('/summary-table', authenticateToken, dashboardController.getSummaryTable);

module.exports = router;

