const cloudinary = require('../config/cloudinary');

/**
 * Upload image to Cloudinary with watermark containing lat/lon/time
 * @param {Buffer} imageBuffer - Image file buffer
 * @param {Object} metadata - Metadata containing latitude, longitude, timestamp
 * @returns {Promise<Object>} Cloudinary upload result
 */
async function uploadImageWithWatermark(imageBuffer, metadata) {
  const { latitude, longitude, timestamp } = metadata;

  // Format timestamp
  const date = new Date(timestamp);
  const timeString = date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Create watermark text
  const watermarkText = `Lat: ${latitude || 'N/A'} | Lon: ${longitude || 'N/A'} | ${timeString}`;

  try {
    // Convert buffer to base64
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

    // Upload with watermark overlay
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'auditapp',
      transformation: [
        {
          overlay: {
            font_family: 'Arial',
            font_size: 20,
            font_weight: 'bold',
            text: watermarkText,
          },
          color: '#FFFFFF',
          background: '#00000080',
          gravity: 'south',
          y: 20,
        },
      ],
    });

    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

/**
 * Alternative method using base64 encoding
 */
async function uploadImageWithWatermarkBase64(base64Image, metadata) {
  const { latitude, longitude, timestamp } = metadata;

  const date = new Date(timestamp);
  const timeString = date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const watermarkText = `Lat: ${latitude || 'N/A'} | Lon: ${longitude || 'N/A'} | ${timeString}`;

  try {
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'auditapp',
      transformation: [
        {
          overlay: {
            font_family: 'Arial',
            font_size: 20,
            font_weight: 'bold',
            text: watermarkText,
          },
          color: '#FFFFFF',
          background: '#00000080',
          gravity: 'south',
          y: 20,
        },
      ],
    });

    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

module.exports = {
  uploadImageWithWatermark,
  uploadImageWithWatermarkBase64,
};

