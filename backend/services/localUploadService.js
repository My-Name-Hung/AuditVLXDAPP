const sharp = require("sharp");
const path = require("path");
const fs = require("fs").promises;
const { getProvinceDistrict } = require("./geocodingService");

// Upload directory - configurable via environment
const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads");
const BASE_URL =
  process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// Auto-detect BASE_URL from request if behind proxy/load balancer
function getBaseUrl(req) {
  const forwardedProto = req?.headers?.["x-forwarded-proto"];
  const forwardedHost = req?.headers?.["x-forwarded-host"];
  const forwardedPort = req?.headers?.["x-forwarded-port"];

  if (forwardedHost) {
    const protocol = forwardedProto || "https";
    const port =
      forwardedPort && forwardedPort !== "80" && forwardedPort !== "443"
        ? `:${forwardedPort}`
        : "";
    return `${protocol}://${forwardedHost}${port}`;
  }

  return BASE_URL;
}

/**
 * Ensure upload directory exists
 */
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    console.log(`📁 Created upload directory: ${UPLOAD_DIR}`);
  }
}

/**
 * Format timestamp for watermark (convert UTC to local time)
 * Format: DD-MM-YYYY HH:MM:SS (Vietnam time)
 */
function formatTimestamp(timestamp, timezoneOffset) {
  // timestamp là UTC ISO string, timezoneOffset từ JS getTimezoneOffset()
  // VD: 21:39:00 local (UTC+7) gửi lên -> timestamp = UTC 14:39:00Z, offset = -420
  // Công thức: localHours = utcHours + (-offset/60) = 14 + 7 = 21 ✓

  let hours = 0,
    minutes = 0,
    seconds = 0,
    day = 1,
    month = 1,
    year = 2026;

  if (timestamp) {
    const date = new Date(timestamp);
    // Lấy giờ UTC
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();
    const utcSeconds = date.getUTCSeconds();
    const utcDay = date.getUTCDate();
    const utcMonth = date.getUTCMonth() + 1;
    const utcYear = date.getUTCFullYear();

    // Tính local time từ UTC + offset
    // offset từ getTimezoneOffset() có dấu ngược: UTC+7 -> offset = -420
    // local = UTC + (-offset/60)
    const offsetHours =
      timezoneOffset !== undefined && timezoneOffset !== null
        ? -parseInt(timezoneOffset, 10) / 60
        : 0;

    // Tính local time với ngày chính xác (có thể chuyển ngày)
    const totalMinutes =
      utcHours * 60 + utcMinutes + Math.round(offsetHours * 60);
    const totalSeconds = utcSeconds;

    // Normalize: ngày có thể thay đổi nếu qua nửa đêm
    const dayOffset = Math.floor(totalMinutes / 1440);
    const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;

    hours = Math.floor(normalizedMinutes / 60);
    minutes = normalizedMinutes % 60;
    seconds = totalSeconds;

    // Tính ngày mới
    const baseDate = new Date(Date.UTC(utcYear, utcMonth - 1, utcDay));
    baseDate.setUTCDate(baseDate.getUTCDate() + dayOffset);
    day = baseDate.getUTCDate();
    month = baseDate.getUTCMonth() + 1;
    year = baseDate.getUTCFullYear();
  }

  // Format: DD-MM-YYYY HH:MM:SS
  return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Create SVG watermark with location info (optimized for readability)
 * Watermark size adapts to image dimensions but stays within readable bounds
 */
function createWatermarkSvg(metadata) {
  const {
    latitude,
    longitude,
    timestamp,
    timezoneOffset,
    province,
    district,
    imageWidth = 1920,
    imageHeight = 1080,
  } = metadata;

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

  const timeString = formatTimestamp(timestamp, timezoneOffset);
  const locationText =
    province && district
      ? `${province} - ${district}`
      : province
        ? province
        : district
          ? district
          : "";

  // Build lines for watermark
  const lines = [
    { text: `Lat: ${latValue}  Long: ${lonValue}`, primary: true },
    { text: timeString, primary: true },
  ];

  if (locationText) {
    lines.push({ text: locationText, primary: false });
  }

  // Calculate font size - proportional to image: min 12px, max 24px
  const fontSize = Math.max(12, Math.min(24, Math.floor(imageWidth / 40)));

  // Estimate text width based on longest line and font size
  // Average char width ≈ 60% of font size
  const longestText = lines.reduce((max, line) => Math.max(max, line.text.length), 0);
  const estimatedTextWidth = longestText * fontSize * 0.6;
  
  // Watermark width: fit text + padding, min 150px, max 90% of image
  const padding = fontSize;
  const wmWidth = Math.min(Math.max(estimatedTextWidth + padding * 2, 150), Math.floor(imageWidth * 0.9));
  
  // Watermark height: fit all lines
  const lineHeight = Math.ceil(fontSize * 1.3);
  const textHeight = lines.length * lineHeight;
  const wmHeight = textHeight + padding * 2;
  
  // Limit height to 30% of image height
  const maxWmHeight = Math.floor(imageHeight * 0.3);
  const finalHeight = Math.min(wmHeight, maxWmHeight);

  // Create SVG lines
  const svgLines = lines
    .map(
      (line, i) =>
        `<text x="${padding}" y="${padding + fontSize + (i * lineHeight)}" fill="white" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="${line.primary ? "bold" : "normal"}">${escapeXml(line.text)}</text>`,
    )
    .join("\n");

  return `<svg width="${wmWidth}" height="${finalHeight}">
    <rect x="0" y="0" width="${wmWidth}" height="${finalHeight}" fill="rgba(0,0,0,0.75)" rx="3" ry="3"/>
    ${svgLines}
  </svg>`;
}

/**
 * Upload image with watermark (no resize, keep original quality)
 * @param {Buffer} imageBuffer - Image buffer from frontend
 * @param {Object} metadata - Metadata containing latitude, longitude, timestamp, timezoneOffset
 * @param {Object} options - Optional settings
 * @returns {Promise<Object>} Upload result with URL
 */
async function uploadImageWithWatermark(imageBuffer, metadata, options = {}) {
  // Ensure upload directory exists
  await ensureUploadDir();

  const { latitude, longitude, timestamp, timezoneOffset } = metadata;

  // Get province and district from coordinates
  const latNum =
    latitude !== null && latitude !== undefined ? parseFloat(latitude) : null;
  const lonNum =
    longitude !== null && longitude !== undefined
      ? parseFloat(longitude)
      : null;
  const { province, district } = await getProvinceDistrict(latNum, lonNum);

  // Get original dimensions for watermark sizing
  const originalMeta = await sharp(imageBuffer).metadata();

  // Create watermark SVG with actual image dimensions for proper sizing
  const watermarkSvg = createWatermarkSvg({
    latitude: latNum,
    longitude: lonNum,
    timestamp,
    timezoneOffset,
    province,
    district,
    imageWidth: originalMeta.width,
    imageHeight: originalMeta.height,
  });

  // Generate unique filename
  const timestampStr = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const baseFilename = `${timestampStr}_${randomStr}`;
  const folderPath = path.join(UPLOAD_DIR, baseFilename);

  // Create folder for this image
  await fs.mkdir(folderPath, { recursive: true });

  // Apply watermark to original image
  const watermarkedBuffer = await sharp(imageBuffer)
    .rotate() // Auto-rotate based on EXIF
    .composite([
      {
        input: Buffer.from(watermarkSvg),
        gravity: "southeast", // Watermark ở góc dưới bên phải
        left: 10, // Cách mép 10px
        top: 10,  // Cách mép 10px
      },
    ])
    .jpeg({ quality: 90, progressive: true })
    .toBuffer();

  // Save watermarked image
  const filePath = path.join(folderPath, "image.jpg");
  await fs.writeFile(filePath, watermarkedBuffer);

  // Generate URL
  const url = `${BASE_URL}/uploads/${baseFilename}/image.jpg`;

  console.log(`✅ Saved image with watermark: ${url}`);
  console.log(`   Image size: ${originalMeta.width}x${originalMeta.height}`);

  return {
    baseFilename,
    folderPath,
    url,
    originalUrl: url,
    thumbnailUrl: url,
    smallUrl: url,
    mediumUrl: url,
    largeUrl: url,
    secure_url: url,
    width: originalMeta.width,
    height: originalMeta.height,
  };
}

/**
 * Delete uploaded image folder
 */
async function deleteUploadedImage(baseFilename) {
  const folderPath = path.join(UPLOAD_DIR, baseFilename);
  try {
    await fs.rm(folderPath, { recursive: true, force: true });
    console.log(`🗑️ Deleted folder: ${folderPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting folder:`, error.message);
    return false;
  }
}

module.exports = {
  uploadImageWithWatermark,
  deleteUploadedImage,
  getBaseUrl,
  ensureUploadDir,
  getResponsiveUrls: (baseFilename) => ({
    thumbnail: `${BASE_URL}/uploads/${baseFilename}/image.jpg`,
    small: `${BASE_URL}/uploads/${baseFilename}/image.jpg`,
    medium: `${BASE_URL}/uploads/${baseFilename}/image.jpg`,
    large: `${BASE_URL}/uploads/${baseFilename}/image.jpg`,
    original: `${BASE_URL}/uploads/${baseFilename}/image.jpg`,
  }),
};
