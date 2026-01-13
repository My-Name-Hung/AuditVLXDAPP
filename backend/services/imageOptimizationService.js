/**
 * Image Optimization Service
 * Tối ưu hóa ảnh từ Cloudinary với transformations để tăng tốc độ tải
 */

const cloudinary = require("../config/cloudinary");

/**
 * Tạo optimized URL với Cloudinary transformations
 * @param {string} publicId - Cloudinary public_id hoặc full URL
 * @param {Object} options - Transformation options
 * @returns {string} Optimized URL
 */
function getOptimizedImageUrl(publicId, options = {}) {
  const {
    width = null, // Chiều rộng (auto crop nếu cần)
    height = null, // Chiều cao
    quality = "auto", // Quality: auto, 80, 90, etc.
    format = "auto", // Format: auto (WebP/AVIF), jpg, png, webp
    crop = "limit", // Crop mode: limit, fill, scale, etc.
    fetchFormat = "auto", // Fetch format optimization
    flags = ["progressive"], // Progressive JPEG
  } = options;

  // Nếu là full URL, extract public_id
  let imagePublicId = publicId;
  if (publicId.includes("http")) {
    // Extract public_id from Cloudinary URL
    const urlParts = publicId.split("/");
    const uploadIndex = urlParts.findIndex((part) => part === "upload");
    if (uploadIndex !== -1 && urlParts[uploadIndex + 2]) {
      // Get folder and filename
      const folderAndFile = urlParts.slice(uploadIndex + 2).join("/");
      imagePublicId = folderAndFile.split(".")[0]; // Remove extension
    } else {
      // Fallback: return original URL with transformations
      return cloudinary.url(publicId, {
        width,
        height,
        quality,
        format,
        crop,
        fetch_format: fetchFormat,
        flags,
        secure: true,
      });
    }
  }

  // Build transformation options
  const transformation = {
    width,
    height,
    quality,
    format,
    crop,
    fetch_format: fetchFormat,
    flags,
    secure: true,
  };

  // Remove null/undefined values
  Object.keys(transformation).forEach(
    (key) =>
      transformation[key] === null ||
      (transformation[key] === undefined && delete transformation[key])
  );

  return cloudinary.url(imagePublicId, transformation);
}

/**
 * Tạo multiple sizes cho responsive images
 * @param {string} publicId - Cloudinary public_id hoặc full URL
 * @returns {Object} URLs với các kích thước khác nhau
 */
function getResponsiveImageUrls(publicId) {
  return {
    thumbnail: getOptimizedImageUrl(publicId, {
      width: 200,
      height: 200,
      crop: "fill",
      quality: "auto",
      format: "auto",
    }),
    small: getOptimizedImageUrl(publicId, {
      width: 400,
      height: 400,
      crop: "limit",
      quality: "auto",
      format: "auto",
    }),
    medium: getOptimizedImageUrl(publicId, {
      width: 800,
      height: 800,
      crop: "limit",
      quality: "auto",
      format: "auto",
    }),
    large: getOptimizedImageUrl(publicId, {
      width: 1200,
      height: 1200,
      crop: "limit",
      quality: "auto",
      format: "auto",
    }),
    original: getOptimizedImageUrl(publicId, {
      quality: "auto",
      format: "auto",
    }),
  };
}

/**
 * Tạo optimized URL cho mobile app (tối ưu cho mạng chậm)
 * @param {string} publicId - Cloudinary public_id hoặc full URL
 * @param {string} size - Size: 'thumbnail', 'small', 'medium', 'large', 'original'
 * @returns {string} Optimized URL
 */
function getMobileOptimizedUrl(publicId, size = "medium") {
  const sizeMap = {
    thumbnail: { width: 150, height: 150, crop: "fill" },
    small: { width: 400, height: 400, crop: "limit" },
    medium: { width: 800, height: 800, crop: "limit" },
    large: { width: 1200, height: 1200, crop: "limit" },
    original: {},
  };

  return getOptimizedImageUrl(publicId, {
    ...sizeMap[size],
    quality: "auto:good", // Tối ưu cho mobile
    format: "auto",
    flags: ["progressive"],
  });
}

/**
 * Tạo optimized URL cho web (tối ưu cho desktop)
 * @param {string} publicId - Cloudinary public_id hoặc full URL
 * @param {string} size - Size: 'thumbnail', 'small', 'medium', 'large', 'original'
 * @returns {string} Optimized URL
 */
function getWebOptimizedUrl(publicId, size = "large") {
  const sizeMap = {
    thumbnail: { width: 200, height: 200, crop: "fill" },
    small: { width: 500, height: 500, crop: "limit" },
    medium: { width: 1000, height: 1000, crop: "limit" },
    large: { width: 1600, height: 1600, crop: "limit" },
    original: {},
  };

  return getOptimizedImageUrl(publicId, {
    ...sizeMap[size],
    quality: "auto:best", // Tối ưu cho web
    format: "auto",
    flags: ["progressive"],
  });
}

/**
 * Extract public_id từ Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string} public_id
 */
function extractPublicId(url) {
  if (!url || !url.includes("cloudinary.com")) {
    return url;
  }

  try {
    const urlParts = url.split("/");
    const uploadIndex = urlParts.findIndex((part) => part === "upload");
    if (uploadIndex !== -1 && urlParts[uploadIndex + 2]) {
      const folderAndFile = urlParts.slice(uploadIndex + 2).join("/");
      return folderAndFile.split(".")[0]; // Remove extension
    }
  } catch (error) {
    console.error("Error extracting public_id:", error);
  }

  return url;
}

module.exports = {
  getOptimizedImageUrl,
  getResponsiveImageUrls,
  getMobileOptimizedUrl,
  getWebOptimizedUrl,
  extractPublicId,
};
