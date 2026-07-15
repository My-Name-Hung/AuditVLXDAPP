const sharp = require("sharp");
const path = require("path");
const fs = require("fs").promises;
const { getProvinceDistrict } = require("./geocodingService");

// Upload directory - configurable via environment
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads");
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// Auto-detect BASE_URL from request if behind proxy/load balancer
function getBaseUrl(req) {
  const forwardedProto = req?.headers?.["x-forwarded-proto"];
  const forwardedHost = req?.headers?.["x-forwarded-host"];
  const forwardedPort = req?.headers?.["x-forwarded-port"];

  if (forwardedHost) {
    const protocol = forwardedProto || "https";
    const port = forwardedPort && forwardedPort !== "80" && forwardedPort !== "443"
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
 * Format timestamp for watermark
 */
function formatTimestamp(timestamp, timezoneOffset) {
  let adjustedTimestamp = timestamp;
  if (timestamp && timezoneOffset !== undefined && timezoneOffset !== null) {
    const offsetMinutes = parseInt(timezoneOffset, 10);
    if (!isNaN(offsetMinutes) && offsetMinutes !== 0) {
      adjustedTimestamp = new Date(new Date(timestamp).getTime() - offsetMinutes * 60000);
    }
  }

  const date = adjustedTimestamp instanceof Date ? adjustedTimestamp : new Date(adjustedTimestamp || Date.now());
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
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
 * Create SVG watermark with location info (responsive to image size)
 */
function createWatermarkSvg(metadata) {
  const { latitude, longitude, timestamp, timezoneOffset, province, district, width = 300, height = 50 } = metadata;

  const latNum = latitude !== null && latitude !== undefined ? parseFloat(latitude) : null;
  const lonNum = longitude !== null && longitude !== undefined ? parseFloat(longitude) : null;
  const latValue = latNum !== null && !isNaN(latNum) ? latNum.toFixed(6) : "N/A";
  const lonValue = lonNum !== null && !isNaN(lonNum) ? lonNum.toFixed(6) : "N/A";

  const timeString = formatTimestamp(timestamp, timezoneOffset);
  const locationText = province && district
    ? `T: ${province} - H: ${district}`
    : province
      ? `T: ${province}`
      : district
        ? `H: ${district}`
        : "";

  const lines = [
    `Lat: ${latValue}  Long: ${lonValue}  ${timeString}`,
    locationText,
  ].filter(line => line.length > 0);

  const fontSize = Math.max(10, Math.min(14, Math.floor(width / 40)));
  const lineHeight = fontSize + 4;
  const padding = 6;
  const textHeight = lines.length * lineHeight;
  const rectHeight = textHeight + padding * 2;

  const svgLines = lines.map((line, i) =>
    `<text x="${padding}" y="${padding + fontSize + 2 + i * lineHeight}" fill="white" font-family="Arial" font-size="${fontSize}" font-weight="bold">${escapeXml(line)}</text>`
  ).join("\n");

  return `<svg width="${width}" height="${rectHeight}">
    <rect x="0" y="0" width="${width}" height="${rectHeight}" fill="rgba(0,0,0,0.6)"/>
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
  const latNum = latitude !== null && latitude !== undefined ? parseFloat(latitude) : null;
  const lonNum = longitude !== null && longitude !== undefined ? parseFloat(longitude) : null;
  const { province, district } = await getProvinceDistrict(latNum, lonNum);

  // Get original dimensions for responsive watermark
  const originalMeta = await sharp(imageBuffer).metadata();

  // Calculate watermark size based on image dimensions (responsive)
  const wmWidth = Math.min(400, Math.max(200, Math.floor(originalMeta.width * 0.4)));
  const wmHeight = Math.min(80, Math.max(30, Math.floor(originalMeta.height * 0.12)));

  // Create watermark SVG with responsive dimensions
  const watermarkSvg = createWatermarkSvg({
    latitude: latNum,
    longitude: lonNum,
    timestamp,
    timezoneOffset,
    province,
    district,
    width: wmWidth,
    height: wmHeight,
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
        gravity: "southeast",
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
