const express = require('express');
const router = express.Router();
const imagesController = require('../controllers/imagesController');
const { authenticateToken } = require('../middlewares/auth');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', authenticateToken, upload.single('image'), imagesController.uploadImage);
router.get('/audit/:auditId', authenticateToken, imagesController.getImagesByAudit);
router.get('/:id', authenticateToken, imagesController.getImageById);
router.delete('/:id', authenticateToken, imagesController.deleteImage);

module.exports = router;

