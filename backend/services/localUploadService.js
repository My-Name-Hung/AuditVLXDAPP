const sharp = require("sharp");
const path = require("path");
const fs = require("fs").promises;
const { getProvinceDistrict } = require("./geocodingService");

// Upload directory - configurable via environment
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "..", "uploads");
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

// Auto-detect BASE_URL from request if behind proxy/load balancer
function getBaseUrl(req) {
  // Check for reverse proxy headers first
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

// Image sizes for responsive images (in pixels)
const IMAGE_SIZES = {
  thumbnail: { width: 200, height: 200, quality: 70 },
  small: { width: 400, height: 400, quality: 75 },
  medium: { width: 800, height: 800, quality: 80 },
  large: { width: 1200, height: 1200, quality: 85 },
};

// Watermark text settings
const WATERMARK_FONT_SIZE = 14;

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
 * Create SVG watermark with location info
 */
async function createWatermarkSvg(metadata) {
  const { latitude, longitude, timestamp, timezoneOffset, province, district } = metadata;

  const latNum = latitude !== null && latitude !== undefined ? parseFloat(latitude) : null;
  const lonNum = longitude !== null && longitude !== undefined ? parseFloat(longitude) : null;
  const latValue = latNum !== null && !isNaN(latNum) ? latNum.toFixed(6) : "N/A";
  const lonValue = lonNum !== null && !isNaN(lonNum) ? lonNum.toFixed(6) : "N/A";

  const timeString = formatTimestamp(timestamp, timezoneOffset);
  const locationText = province && district
    ? `Tỉnh: ${province}\nQuận/Huyện: ${district}`
    : province
      ? `Tỉnh: ${province}`
      : district
        ? `Quận/Huyện: ${district}`
        : "";

  const lines = [
    `Lat: ${latValue}  Long: ${lonValue}  ${timeString}`,
    locationText,
  ].filter(line => line.length > 0);

  const lineHeight = 20;
  const padding = 10;
  const textHeight = lines.length * lineHeight;
  const rectHeight = textHeight + padding * 2;

  const svgLines = lines.map((line, i) =>
    `<text x="${padding}" y="${padding + 14 + i * lineHeight}" fill="white" font-family="Arial" font-size="${WATERMARK_FONT_SIZE}" font-weight="bold">${escapeXml(line)}</text>`
  ).join("\n");

  return `<svg width="400" height="${rectHeight}">
    <rect x="0" y="0" width="400" height="${rectHeight}" fill="rgba(0,0,0,0.6)"/>
    ${svgLines}
  </svg>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Resize and optimize image with sharp
 * @param {Buffer} imageBuffer - Image buffer
 * @param {Object} options - Resize options
 * @returns {Promise<Buffer>} Optimized image buffer
 */
async function resizeImage(imageBuffer, options = {}) {
  const {
    width = null,
    height = null,
    quality = 80,
    fit = "inside",
    withoutEnlargement = true,
  } = options;

  return sharp(imageBuffer)
    .rotate() // Auto-rotate based on EXIF
    .resize(width, height, {
      fit,
      withoutEnlargement,
      withoutReduction: false,
    })
    .jpeg({
      quality,
      progressive: true,
      mozjpeg: true,
    })
    .toBuffer();
}

/**
 * Upload image with watermark and create all responsive sizes
 * @param {Buffer} imageBuffer - Image buffer from frontend
 * @param {Object} metadata - Metadata containing latitude, longitude, timestamp, timezoneOffset
 * @param {Object} options - Optional settings
 * @returns {Promise<Object>} Upload result with URLs
 */
async function uploadImageWithWatermark(imageBuffer, metadata, options = {}) {
  // Ensure upload directory exists
  await ensureUploadDir();

  const { latitude, longitude, timestamp, timezoneOffset } = metadata;

  // Get province and district from coordinates
  const latNum = latitude !== null && latitude !== undefined ? parseFloat(latitude) : null;
  const lonNum = longitude !== null && longitude !== undefined ? parseFloat(longitude) : null;
  const { province, district } = await getProvinceDistrict(latNum, lonNum);

  // Create watermark
  const watermarkSvg = await createWatermarkSvg({
    latitude: latNum,
    longitude: lonNum,
    timestamp,
    timezoneOffset,
    province,
    district,
  });

  // Generate unique filename
  const timestampStr = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const baseFilename = `${timestampStr}_${randomStr}`;
  const folderPath = path.join(UPLOAD_DIR, baseFilename);

  // Create folder for this image
  await fs.mkdir(folderPath, { recursive: true });

  // Process and upload all sizes
  const results = {};
  const metadataEnhance = { ...metadata, province, district };

  for (const [sizeName, sizeConfig] of Object.entries(IMAGE_SIZES)) {
    try {
      // Resize image
      const resizedBuffer = await resizeImage(imageBuffer, {
        width: sizeConfig.width,
        height: sizeConfig.height,
        quality: sizeConfig.quality,
      });

      // Apply watermark for medium and larger sizes only (not thumbnail)
      let finalBuffer = resizedBuffer;
      if (sizeName !== "thumbnail") {
        const watermarkBuffer = Buffer.from(watermarkSvg);
        finalBuffer = await sharp(resizedBuffer)
          .composite([
            {
              input: watermarkBuffer,
              gravity: "southeast",
            },
          ])
          .toBuffer();
      }

      // Save file
      const filePath = path.join(folderPath, `${sizeName}.jpg`);
      await fs.writeFile(filePath, finalBuffer);

      // Generate URL
      const relativePath = path.relative(path.join(__dirname, ".."), filePath);
      const url = `${BASE_URL}/uploads/${baseFilename}/${sizeName}.jpg`;

      results[sizeName] = {
        path: filePath,
        url,
        width: sizeConfig.width,
        height: sizeConfig.height,
      };

      console.log(`✅ Saved ${sizeName}: ${url}`);
    } catch (error) {
      console.error(`❌ Error processing ${sizeName}:`, error.message);
      throw error;
    }
  }

  // Save original (no resize, just optimize quality)
  try {
    const optimizedOriginal = await sharp(imageBuffer)
      .rotate()
      .jpeg({ quality: 90, progressive: true })
      .toBuffer();

    const originalPath = path.join(folderPath, "original.jpg");
    await fs.writeFile(originalPath, optimizedOriginal);

    const originalUrl = `${BASE_URL}/uploads/${baseFilename}/original.jpg`;
    results.original = {
      path: originalPath,
      url: originalUrl,
    };

    // Also save watermark version of original
    const watermarkedOriginal = await sharp(optimizedOriginal)
      .composite([
        {
          input: Buffer.from(watermarkSvg),
          gravity: "southeast",
        },
      ])
      .toBuffer();

    const watermarkedPath = path.join(folderPath, "watermarked.jpg");
    await fs.writeFile(watermarkedPath, watermarkedOriginal);

    results.watermarked = {
      path: watermarkedPath,
      url: `${BASE_URL}/uploads/${baseFilename}/watermarked.jpg`,
    };
  } catch (error) {
    console.error(`❌ Error saving original:`, error.message);
  }

  return {
    baseFilename,
    folderPath,
    sizes: results,
    // Default URL (medium)
    secure_url: results.medium?.url || results.original?.url,
    url: results.medium?.url || results.original?.url,
  };
}

/**
 * Upload image from base64 string
 */
async function uploadImageWithWatermarkBase64(base64Image, metadata, options = {}) {
  // Remove data URI prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
  const imageBuffer = Buffer.from(base64Data, "base64");
  return uploadImageWithWatermark(imageBuffer, metadata, options);
}

/**
 * Delete image folder and all sizes
 */
async function deleteImageFolder(folderPath) {
  try {
    await fs.rm(folderPath, { recursive: true, force: true });
    console.log(`🗑️ Deleted image folder: ${folderPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error deleting image folder:`, error.message);
    return false;
  }
}

/**
 * Get image URL by size
 */
function getImageUrl(baseFilename, size = "medium") {
  return `${BASE_URL}/uploads/${baseFilename}/${size}.jpg`;
}

/**
 * Get responsive image URLs
 */
function getResponsiveUrls(baseFilename) {
  return {
    thumbnail: getImageUrl(baseFilename, "thumbnail"),
    small: getImageUrl(baseFilename, "small"),
    medium: getImageUrl(baseFilename, "medium"),
    large: getImageUrl(baseFilename, "large"),
    original: getImageUrl(baseFilename, "original"),
    watermarked: getImageUrl(baseFilename, "watermarked"),
  };
}

/**
 * Check if using local storage (for backward compatibility check)
 */
function isLocalStorage() {
  return !process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY;
}

module.exports = {
  uploadImageWithWatermark,
  uploadImageWithWatermarkBase64,
  deleteImageFolder,
  getImageUrl,
  getResponsiveUrls,
  isLocalStorage,
  resizeImage,
  ensureUploadDir,
  UPLOAD_DIR,
  BASE_URL,
};
