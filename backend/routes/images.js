const express = require('express');
const router = express.Router();
const imagesController = require('../controllers/imagesController');
const { authenticateToken } = require('../middlewares/auth');
const multer = require('multer');
const Image = require('../models/Image');
const { uploadImageWithWatermark, getResponsiveUrls } = require('../services/localUploadService');

const upload = multer({ storage: multer.memoryStorage() });

// ============================================
// TEST API - Không cần auth (cho test trực tiếp)
// ============================================
router.post('/test-upload', upload.single('image'), async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      timestamp,
      timezoneOffset,
      userName,
      storeName,
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    console.log('🧪 [TEST] Upload request:', {
      user: userName || 'N/A',
      store: storeName || 'N/A',
      lat: latitude,
      lng: longitude,
      time: timestamp
    });

    // Parse numbers
    const latitudeNum = latitude ? parseFloat(latitude) : null;
    const longitudeNum = longitude ? parseFloat(longitude) : null;
    const timezoneOffsetNum = timezoneOffset !== undefined && timezoneOffset !== null
      ? parseInt(timezoneOffset, 10)
      : null;

    const metadata = {
      latitude: latitudeNum,
      longitude: longitudeNum,
      timestamp: timestamp || new Date().toISOString(),
      timezoneOffset: timezoneOffsetNum,
      userName: userName || 'Test User',
      storeName: storeName || 'Test Store',
    };

    // Upload image with watermark
    const uploadResult = await uploadImageWithWatermark(req.file.buffer, metadata);

    console.log('✅ [TEST] Upload successful:', uploadResult.url);
    console.log('   Image size:', uploadResult.width, 'x', uploadResult.height);

    res.status(200).json({
      success: true,
      message: 'Upload test thành công!',
      data: {
        url: uploadResult.url,
        width: uploadResult.width,
        height: uploadResult.height,
        metadata: metadata,
      }
    });

  } catch (error) {
    console.error('❌ [TEST] Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MAIN API - Cần auth
// ============================================
router.post('/upload', authenticateToken, upload.single('image'), imagesController.uploadImage);
router.get('/audit/:auditId', authenticateToken, imagesController.getImagesByAudit);
router.get('/optimized/:id', authenticateToken, imagesController.getOptimizedImage); // Endpoint mới cho optimized images
router.get('/:id', authenticateToken, imagesController.getImageById);
router.delete('/:id', authenticateToken, imagesController.deleteImage);

module.exports = router;

