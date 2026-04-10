const cloudinary = require("../config/cloudinary");
const { getProvinceDistrict } = require("./geocodingService");

const TARGET_WIDTH = 480;
const TARGET_HEIGHT = 640;
const TARGET_QUALITY = "auto:good";

/**
 * Upload image to Cloudinary with watermark containing lat/lon/time
 *
 * NOTE: This function is used by both mobile app and web iosauditapp to upload images.
 * The frontend will send image buffer and metadata (lat/lon/timestamp) to the backend API,
 * which will then call this function to upload to Cloudinary with watermark.
 *
 * @param {Buffer} imageBuffer - Image file buffer from frontend
 * @param {Object} metadata - Metadata containing latitude, longitude, timestamp
 * @param {Object} options - Optional settings: { fontSize: number } (default: 60 for mobile app)
 * @returns {Promise<Object>} Cloudinary upload result
 */
async function uploadImageWithWatermark(imageBuffer, metadata, options = {}) {
  const { fontSize = 12 } = options;
  const { latitude, longitude, timestamp, localTimeString } = metadata;

  // Format timestamp: dd.mm.yyyy hh:mm:ss (using . instead of / to avoid URL encoding)
  // QUAN TRỌNG: Sử dụng localTimeString nếu có (đã được format đúng local time trong controller)
  // Nếu không có, format từ timestamp (đã được điều chỉnh về local time)
  let timeString;
  if (localTimeString) {
    // Sử dụng local time string đã format sẵn từ controller
    timeString = localTimeString;
  } else {
    // Fallback: format từ timestamp (đã là local time sau khi điều chỉnh)
    const date = new Date(timestamp);
    // Sử dụng UTC methods vì timestamp đã được điều chỉnh về local time
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year = date.getUTCFullYear();
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const seconds = String(date.getUTCSeconds()).padStart(2, "0");
    timeString = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  }

  // Create watermark text: Use compact format to prevent overlap
  // Ensure latitude and longitude are numbers before calling toFixed
  const latNum =
    latitude !== null && latitude !== undefined ? parseFloat(latitude) : null;
  const lonNum =
    longitude !== null && longitude !== undefined
      ? parseFloat(longitude)
      : null;
  const latValue =
    latNum !== null && !isNaN(latNum) ? latNum.toFixed(6) : "N/A";
  const lonValue =
    lonNum !== null && !isNaN(lonNum) ? lonNum.toFixed(6) : "N/A";
  const { province, district } = await getProvinceDistrict(latNum, lonNum);
  const locationText = `Tỉnh: ${province || "N/A"}\nQuận/Huyện: ${
    district || "N/A"
  }`;

  const watermarkText = `Lat:${latValue} Long:${lonValue} ${timeString}\n${locationText}`;

  try {
    // Convert buffer to base64
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString(
      "base64"
    )}`;

    // Upload image with watermark transformation applied eagerly (stored permanently)
    // This ensures watermark is always visible, not just in URL transformation
    // Font size: 45 for mobile app (default), 10 for web iosauditapp
    // Tối ưu hóa: quality auto, progressive JPEG
    // Lưu ý: format auto không được hỗ trợ trong eager, sẽ áp dụng qua URL transformations
    const uploadResult = await cloudinary.uploader.upload(base64Image, {
      folder: "auditapp",
      // Force normalize to 480x640 on backend
      transformation: [
        {
          width: TARGET_WIDTH,
          height: TARGET_HEIGHT,
          crop: "fill",
          gravity: "auto",
          quality: TARGET_QUALITY,
          flags: "progressive",
        },
      ],
      eager: [
        {
          width: TARGET_WIDTH,
          height: TARGET_HEIGHT,
          crop: "fill",
          gravity: "auto",
          overlay: {
            font_family: "Arial",
            font_size: fontSize,
            font_weight: "bold",
            text: watermarkText,
          },
          color: "#FFFFFF",
          gravity: "north_east",
          x: 20,
          y: 20,
          quality: TARGET_QUALITY,
          flags: "progressive",
        },
      ],
      eager_async: false,
    });

    // Return the URL with watermark (use eager transformation URL if available)
    const watermarkedUrl =
      uploadResult.eager && uploadResult.eager.length > 0
        ? uploadResult.eager[0].secure_url
        : uploadResult.secure_url;

    return {
      ...uploadResult,
      secure_url: watermarkedUrl,
      url: watermarkedUrl.replace("https://", "http://"),
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
}

/**
 * Alternative method using base64 encoding
 */
async function uploadImageWithWatermarkBase64(base64Image, metadata) {
  const { latitude, longitude, timestamp, localTimeString } = metadata;

  // Format timestamp: dd.mm.yyyy hh:mm:ss (using . instead of / to avoid URL encoding)
  // QUAN TRỌNG: Sử dụng localTimeString nếu có (đã được format đúng local time trong controller)
  // Nếu không có, format từ timestamp (đã được điều chỉnh về local time)
  let timeString;
  if (localTimeString) {
    // Sử dụng local time string đã format sẵn từ controller
    timeString = localTimeString;
  } else {
    // Fallback: format từ timestamp (đã là local time sau khi điều chỉnh)
    const date = new Date(timestamp);
    // Sử dụng UTC methods vì timestamp đã được điều chỉnh về local time
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year = date.getUTCFullYear();
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const seconds = String(date.getUTCSeconds()).padStart(2, "0");
    timeString = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  }

  // Create watermark text: Use compact format to prevent overlap
  // Ensure latitude and longitude are numbers before calling toFixed
  const latNum =
    latitude !== null && latitude !== undefined ? parseFloat(latitude) : null;
  const lonNum =
    longitude !== null && longitude !== undefined
      ? parseFloat(longitude)
      : null;
  const latValue =
    latNum !== null && !isNaN(latNum) ? latNum.toFixed(6) : "N/A";
  const lonValue =
    lonNum !== null && !isNaN(lonNum) ? lonNum.toFixed(6) : "N/A";
  const { province, district } = await getProvinceDistrict(latNum, lonNum);
  const locationText = `Tỉnh: ${province || "N/A"}\nQuận/Huyện: ${
    district || "N/A"
  }`;

  const watermarkText = `L:${latValue} Lo:${lonValue} ${timeString}\n${locationText}`;

  try {
    // Upload image with watermark transformation applied eagerly (stored permanently)
    // This ensures watermark is always visible, not just in URL transformation
    // Tối ưu hóa: quality auto, progressive JPEG
    // Lưu ý: format auto không được hỗ trợ trong eager, sẽ áp dụng qua URL transformations
    const uploadResult = await cloudinary.uploader.upload(base64Image, {
      folder: "auditapp",
      transformation: [
        {
          width: TARGET_WIDTH,
          height: TARGET_HEIGHT,
          crop: "fill",
          gravity: "auto",
          quality: TARGET_QUALITY,
          flags: "progressive",
        },
      ],
      eager: [
        {
          width: TARGET_WIDTH,
          height: TARGET_HEIGHT,
          crop: "fill",
          gravity: "auto",
          overlay: {
            font_family: "Arial",
            font_size: 12,
            font_weight: "bold",
            text: watermarkText,
          },
          color: "#FFFFFF",
          gravity: "north_east",
          x: 20,
          y: 20,
          quality: TARGET_QUALITY,
          flags: "progressive",
        },
      ],
      eager_async: false,
    });

    // Return the URL with watermark (use eager transformation URL if available)
    const watermarkedUrl =
      uploadResult.eager && uploadResult.eager.length > 0
        ? uploadResult.eager[0].secure_url
        : uploadResult.secure_url;

    return {
      ...uploadResult,
      secure_url: watermarkedUrl,
      url: watermarkedUrl.replace("https://", "http://"),
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
}

module.exports = {
  uploadImageWithWatermark,
  uploadImageWithWatermarkBase64,
};
