/**
 * Image Optimization Service
 * Tối ưu hóa ảnh từ Cloudinary hoặc Local Storage
 * Hỗ trợ cả 2: Cloudinary (legacy) và Local Storage (mới)
 */

const cloudinary = require("../config/cloudinary");
const path = require("path");

// BASE_URL for local images
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

/**
 * Check if URL is from local storage
 */
function isLocalUrl(url) {
  return url && (
    url.includes("/uploads/") ||
    url.includes("api.ximangtaydo.vn/uploads/") ||
    url.includes("localhost/uploads/")
  );
}

/**
 * Extract baseFilename from local URL
 */
function extractBaseFilename(url) {
  if (!url) return null;

  // For local URLs
  if (isLocalUrl(url)) {
    const match = url.match(/\/uploads\/([^/]+)\//);
    if (match) {
      return match[1];
    }
  }

  // For Cloudinary URLs
  if (url.includes("cloudinary.com")) {
    const urlParts = url.split("/");
    const uploadIndex = urlParts.findIndex((part) => part === "upload");
    if (uploadIndex !== -1 && urlParts[uploadIndex + 2]) {
      const folderAndFile = urlParts.slice(uploadIndex + 2).join("/");
      return folderAndFile.split(".")[0];
    }
  }

  return null;
}

/**
 * Get local image URL by size
 */
function getLocalImageUrl(baseFilename, size = "medium") {
  return `${BASE_URL}/uploads/${baseFilename}/${size}.jpg`;
}

/**
 * Get responsive URLs for local images
 */
function getLocalResponsiveUrls(baseFilename) {
  return {
    thumbnail: getLocalImageUrl(baseFilename, "thumbnail"),
    small: getLocalImageUrl(baseFilename, "small"),
    medium: getLocalImageUrl(baseFilename, "medium"),
    large: getLocalImageUrl(baseFilename, "large"),
    original: getLocalImageUrl(baseFilename, "original"),
    watermarked: getLocalImageUrl(baseFilename, "watermarked"),
  };
}

/**
 * Tạo optimized URL với Cloudinary transformations
 * @param {string} publicId - Cloudinary public_id hoặc full URL
 * @param {Object} options - Transformation options
 * @returns {string} Optimized URL
 */
function getOptimizedImageUrl(publicId, options = {}) {
  const {
    width = null,
    height = null,
    quality = "auto",
    format = "auto",
    crop = "limit",
    fetchFormat = "auto",
    flags = ["progressive"],
  } = options;

  // Nếu là local URL, return local URL với size
  if (isLocalUrl(publicId)) {
    const baseFilename = extractBaseFilename(publicId);
    if (baseFilename) {
      // Map options.width/height to size name
      if (width && width <= 200) return getLocalImageUrl(baseFilename, "thumbnail");
      if (width && width <= 400) return getLocalImageUrl(baseFilename, "small");
      if (width && width <= 800) return getLocalImageUrl(baseFilename, "medium");
      if (width && width <= 1200) return getLocalImageUrl(baseFilename, "large");
      return getLocalImageUrl(baseFilename, "medium");
    }
  }

  // Nếu là full URL, extract public_id
  let imagePublicId = publicId;
  if (publicId.includes("http")) {
    // Extract public_id from Cloudinary URL
    const urlParts = publicId.split("/");
    const uploadIndex = urlParts.findIndex((part) => part === "upload");
    if (uploadIndex !== -1 && urlParts[uploadIndex + 2]) {
      const folderAndFile = urlParts.slice(uploadIndex + 2).join("/");
      imagePublicId = folderAndFile.split(".")[0];
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
 * @param {string} publicIdOrUrl - Cloudinary public_id hoặc local URL
 * @returns {Object} URLs với các kích thước khác nhau
 */
function getResponsiveImageUrls(publicIdOrUrl) {
  // Check if local URL
  if (isLocalUrl(publicIdOrUrl)) {
    const baseFilename = extractBaseFilename(publicIdOrUrl);
    if (baseFilename) {
      return getLocalResponsiveUrls(baseFilename);
    }
  }

  // Cloudinary URLs
  return {
    thumbnail: getOptimizedImageUrl(publicIdOrUrl, {
      width: 200,
      height: 200,
      crop: "fill",
      quality: "auto",
      format: "auto",
    }),
    small: getOptimizedImageUrl(publicIdOrUrl, {
      width: 400,
      height: 400,
      crop: "limit",
      quality: "auto",
      format: "auto",
    }),
    medium: getOptimizedImageUrl(publicIdOrUrl, {
      width: 800,
      height: 800,
      crop: "limit",
      quality: "auto",
      format: "auto",
    }),
    large: getOptimizedImageUrl(publicIdOrUrl, {
      width: 1200,
      height: 1200,
      crop: "limit",
      quality: "auto",
      format: "auto",
    }),
    original: getOptimizedImageUrl(publicIdOrUrl, {
      quality: "auto",
      format: "auto",
    }),
  };
}

/**
 * Tạo optimized URL cho mobile app (tối ưu cho mạng chậm)
 * @param {string} publicIdOrUrl - public_id hoặc local URL
 * @param {string} size - Size: 'thumbnail', 'small', 'medium', 'large', 'original'
 * @returns {string} Optimized URL
 */
function getMobileOptimizedUrl(publicIdOrUrl, size = "medium") {
  // Check if local URL
  if (isLocalUrl(publicIdOrUrl)) {
    const baseFilename = extractBaseFilename(publicIdOrUrl);
    if (baseFilename) {
      return getLocalImageUrl(baseFilename, size);
    }
  }

  const sizeMap = {
    thumbnail: { width: 150, height: 150, crop: "fill" },
    small: { width: 400, height: 400, crop: "limit" },
    medium: { width: 800, height: 800, crop: "limit" },
    large: { width: 1200, height: 1200, crop: "limit" },
    original: {},
  };

  return getOptimizedImageUrl(publicIdOrUrl, {
    ...sizeMap[size],
    quality: "auto:good",
    format: "auto",
    flags: ["progressive"],
  });
}

/**
 * Tạo optimized URL cho web (tối ưu cho desktop)
 * @param {string} publicIdOrUrl - public_id hoặc local URL
 * @param {string} size - Size: 'thumbnail', 'small', 'medium', 'large', 'original'
 * @returns {string} Optimized URL
 */
function getWebOptimizedUrl(publicIdOrUrl, size = "large") {
  // Check if local URL
  if (isLocalUrl(publicIdOrUrl)) {
    const baseFilename = extractBaseFilename(publicIdOrUrl);
    if (baseFilename) {
      return getLocalImageUrl(baseFilename, size);
    }
  }

  const sizeMap = {
    thumbnail: { width: 200, height: 200, crop: "fill" },
    small: { width: 500, height: 500, crop: "limit" },
    medium: { width: 1000, height: 1000, crop: "limit" },
    large: { width: 1600, height: 1600, crop: "limit" },
    original: {},
  };

  return getOptimizedImageUrl(publicIdOrUrl, {
    ...sizeMap[size],
    quality: "auto:best",
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
  // Check if local URL
  if (isLocalUrl(url)) {
    return extractBaseFilename(url);
  }

  if (!url || !url.includes("cloudinary.com")) {
    return url;
  }

  try {
    const urlParts = url.split("/");
    const uploadIndex = urlParts.findIndex((part) => part === "upload");
    if (uploadIndex !== -1 && urlParts[uploadIndex + 2]) {
      const folderAndFile = urlParts.slice(uploadIndex + 2).join("/");
      return folderAndFile.split(".")[0];
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
  extractBaseFilename,
  isLocalUrl,
  getLocalImageUrl,
  getLocalResponsiveUrls,
};
