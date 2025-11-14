const cloudinary = require("../config/cloudinary");

/**
 * Upload image to Cloudinary with watermark containing lat/lon/time
 * @param {Buffer} imageBuffer - Image file buffer
 * @param {Object} metadata - Metadata containing latitude, longitude, timestamp
 * @returns {Promise<Object>} Cloudinary upload result
 */
async function uploadImageWithWatermark(imageBuffer, metadata) {
  const { latitude, longitude, timestamp } = metadata;

  // Format timestamp: dd/mm/yyyy hh:mm:ss
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const timeString = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

  // Create watermark text: "Lat: xxxx,Long: xxxx dd/mm/yyyy hh:mm:ss"
  const latValue =
    latitude !== null && latitude !== undefined ? latitude.toFixed(6) : "N/A";
  const lonValue =
    longitude !== null && longitude !== undefined
      ? longitude.toFixed(6)
      : "N/A";
  // Format: "Lat: xxxx Long: xxxx dd/mm/yyyy hh:mm:ss"
  const watermarkText = `Lat: ${latValue} Long: ${lonValue} ${timeString}`;

  try {
    // Convert buffer to base64
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString(
      "base64"
    )}`;

    // Upload with watermark overlay at top right (text only, no background)
    // Use object format - Cloudinary will handle text encoding properly
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: "auditapp",
      transformation: [
        {
          overlay: {
            font_family: "Arial",
            font_size: 18,
            font_weight: "bold",
            text: watermarkText,
          },
          color: "#0138C3",
          gravity: "north_east",
          x: 15,
          y: 15,
          effect: "shadow:8",
          border: "2px_solid_rgb:255,255,255",
        },
      ],
    });

    return result;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
}

/**
 * Alternative method using base64 encoding
 */
async function uploadImageWithWatermarkBase64(base64Image, metadata) {
  const { latitude, longitude, timestamp } = metadata;

  // Format timestamp: dd/mm/yyyy hh:mm:ss
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const timeString = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

  // Create watermark text: "Lat: xxxx,Long: xxxx dd/mm/yyyy hh:mm:ss"
  const latValue =
    latitude !== null && latitude !== undefined ? latitude.toFixed(6) : "N/A";
  const lonValue =
    longitude !== null && longitude !== undefined
      ? longitude.toFixed(6)
      : "N/A";
  // Format: "Lat: xxxx Long: xxxx dd/mm/yyyy hh:mm:ss"
  const watermarkText = `Lat: ${latValue} Long: ${lonValue} ${timeString}`;

  try {
    // Upload with watermark overlay at top right (text only, no background)
    // Use object format - Cloudinary will handle text encoding properly
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: "auditapp",
      transformation: [
        {
          overlay: {
            font_family: "Arial",
            font_size: 18,
            font_weight: "bold",
            text: watermarkText,
          },
          color: "#0138C3",
          gravity: "north_east",
          x: 15,
          y: 15,
          effect: "shadow:8",
          border: "2px_solid_rgb:255,255,255",
        },
      ],
    });

    return result;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
}

module.exports = {
  uploadImageWithWatermark,
  uploadImageWithWatermarkBase64,
};
