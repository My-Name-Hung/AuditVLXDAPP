const express = require('express');
const router = express.Router();
const multer = require('multer');
const importController = require('../controllers/importController');
const { authenticateToken } = require('../middlewares/auth');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/stores', authenticateToken, upload.single('file'), importController.importStores);
router.post('/users', authenticateToken, upload.single('file'), importController.importUsers);
router.get('/history', authenticateToken, importController.getImportHistory);

module.exports = router;

