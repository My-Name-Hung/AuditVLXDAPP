const Image = require('../models/Image');
const { uploadImageWithWatermark } = require('../services/cloudinaryService');

const uploadImage = async (req, res) => {
  try {
    const {
      auditId,
      latitude,
      longitude,
      referenceImageUrl,
      timestamp,
      timezoneOffset,
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    if (!auditId) {
      return res.status(400).json({ error: 'AuditId is required' });
    }

    // Upload to Cloudinary with watermark
    // Convert latitude and longitude to numbers (they come as strings from FormData)
    const latitudeNum = latitude ? parseFloat(latitude) : null;
    const longitudeNum = longitude ? parseFloat(longitude) : null;
    const timezoneOffsetMinutes =
      typeof timezoneOffset !== "undefined" && timezoneOffset !== null
        ? parseInt(timezoneOffset, 10)
        : null;

    const rawTimestamp = timestamp || new Date().toISOString();
    const timestampDate = new Date(rawTimestamp);
    const adjustedTimestamp =
      timestampDate instanceof Date && !isNaN(timestampDate.valueOf())
        ? new Date(
            timestampDate.getTime() -
              (timezoneOffsetMinutes ? timezoneOffsetMinutes * 60000 : 0)
          )
        : new Date();

    const metadata = {
      latitude: latitudeNum,
      longitude: longitudeNum,
      timestamp: adjustedTimestamp.toISOString(),
    };

    const uploadResult = await uploadImageWithWatermark(req.file.buffer, metadata);

    // Save to database
    const image = await Image.create({
      AuditId: auditId,
      ImageUrl: uploadResult.secure_url,
      ReferenceImageUrl: referenceImageUrl || null,
      Latitude: latitudeNum,
      Longitude: longitudeNum,
      CapturedAt: adjustedTimestamp,
    });

    // Auto-update store status to 'audited' when image is uploaded
    // Only update if store is not already 'passed' or 'failed'
    const Audit = require('../models/Audit');
    const audit = await Audit.findById(auditId);
    if (audit && audit.StoreId) {
      const Store = require('../models/Store');
      const store = await Store.findById(audit.StoreId);
      // Update to 'audited' if store is 'not_audited' or NULL
      // Don't override 'passed' or 'failed' status (these are set by admin)
      if (store && store.Status !== 'passed' && store.Status !== 'failed') {
        await Store.updateStatus(audit.StoreId, 'audited');
      }
    }

    res.status(201).json({
      ...image,
      cloudinaryId: uploadResult.public_id,
    });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

const getImagesByAudit = async (req, res) => {
  try {
    const { auditId } = req.params;
    const images = await Image.findByAuditId(auditId);
    res.json(images);
  } catch (error) {
    console.error('Get images by audit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getImageById = async (req, res) => {
  try {
    const { id } = req.params;
    const image = await Image.findById(id);

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json(image);
  } catch (error) {
    console.error('Get image by id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const deleteImage = async (req, res) => {
  try {
    const { id } = req.params;

    const image = await Image.findById(id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const { getPool, sql } = require('../config/database');
    const pool = await getPool();
    const request = pool.request();
    request.input('Id', sql.Int, id);

    await request.query('DELETE FROM Images WHERE Id = @Id');

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  uploadImage,
  getImagesByAudit,
  getImageById,
  deleteImage,
};

