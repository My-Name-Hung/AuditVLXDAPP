const Image = require("../models/Image");
const Audit = require("../models/Audit");
const { uploadImageWithWatermark } = require("../services/cloudinaryService");
const {
  getOptimizedImageUrl,
  getResponsiveImageUrls,
  getMobileOptimizedUrl,
  getWebOptimizedUrl,
  extractPublicId,
} = require("../services/imageOptimizationService");

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
      return res.status(400).json({ error: "Image file is required" });
    }

    if (!auditId) {
      return res.status(400).json({ error: "AuditId is required" });
    }

    // Validate and parse auditId
    const parsedAuditId = parseInt(auditId, 10);
    if (Number.isNaN(parsedAuditId) || parsedAuditId <= 0) {
      return res.status(400).json({
        error: "Invalid AuditId. AuditId must be a positive integer.",
      });
    }

    // Verify that the Audit exists before inserting the image
    const audit = await Audit.findById(parsedAuditId);
    if (!audit) {
      return res.status(404).json({
        error: `Audit with ID ${parsedAuditId} does not exist. Please create the audit first before uploading images.`,
      });
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

    // Determine font size based on source (header or user agent)
    // Mobile app: fontSize 60 (default)
    // Web iosauditapp: fontSize 10
    const userAgent = req.headers["user-agent"] || "";
    const source = req.headers["x-source"] || req.query.source || "";
    const isWebIOS =
      userAgent.includes("Mozilla") &&
      (userAgent.includes("iPhone") ||
        userAgent.includes("iPad") ||
        source === "web");

    const fontSize = isWebIOS ? 10 : 30; // 10 for web iosauditapp, 60 for mobile app

    const uploadResult = await uploadImageWithWatermark(
      req.file.buffer,
      metadata,
      { fontSize }
    );

    // Save to database
    const image = await Image.create({
      AuditId: parsedAuditId,
      ImageUrl: uploadResult.secure_url,
      ReferenceImageUrl: referenceImageUrl || null,
      Latitude: latitudeNum,
      Longitude: longitudeNum,
      CapturedAt: adjustedTimestamp,
    });

    // Note: Store status refresh is now done once after all images are uploaded
    // to improve performance. See auditsController for batch refresh logic.

    // Tạo optimized URLs cho các kích thước khác nhau
    const optimizedUrls = getResponsiveImageUrls(uploadResult.public_id);

    res.status(201).json({
      ...image,
      cloudinaryId: uploadResult.public_id,
      optimizedUrls: {
        thumbnail: optimizedUrls.thumbnail,
        small: optimizedUrls.small,
        medium: optimizedUrls.medium,
        large: optimizedUrls.large,
        original: optimizedUrls.original,
      },
      // Giữ URL gốc để backward compatibility
      ImageUrl: image.ImageUrl,
    });
  } catch (error) {
    console.error("Upload image error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};

const getImagesByAudit = async (req, res) => {
  try {
    const { auditId } = req.params;
    const { size = "medium", source = "mobile" } = req.query; // size: thumbnail, small, medium, large, original
    const images = await Image.findByAuditId(auditId);

    // Tối ưu hóa URLs cho từng ảnh
    const optimizedImages = images.map((image) => {
      const publicId = extractPublicId(image.ImageUrl);
      
      // Xác định source (mobile hoặc web)
      const userAgent = req.headers["user-agent"] || "";
      const isWeb = userAgent.includes("Mozilla") || source === "web";
      
      // Tạo optimized URL dựa trên source và size
      const optimizedUrl = isWeb
        ? getWebOptimizedUrl(publicId, size)
        : getMobileOptimizedUrl(publicId, size);

      // Tạo responsive URLs cho tất cả sizes
      const responsiveUrls = getResponsiveImageUrls(publicId);

      return {
        ...image,
        optimizedUrl, // URL tối ưu cho size được yêu cầu
        optimizedUrls: responsiveUrls, // Tất cả sizes
        // Giữ URL gốc để backward compatibility
        ImageUrl: image.ImageUrl,
      };
    });

    // Set cache headers để tăng tốc độ
    res.set({
      "Cache-Control": "public, max-age=3600", // Cache 1 giờ
      "ETag": `"${auditId}-${images.length}"`,
    });

    res.json(optimizedImages);
  } catch (error) {
    console.error("Get images by audit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getImageById = async (req, res) => {
  try {
    const { id } = req.params;
    const { size = "medium", source = "mobile" } = req.query;
    const image = await Image.findById(id);

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    const publicId = extractPublicId(image.ImageUrl);
    
    // Xác định source (mobile hoặc web)
    const userAgent = req.headers["user-agent"] || "";
    const isWeb = userAgent.includes("Mozilla") || source === "web";
    
    // Tạo optimized URL
    const optimizedUrl = isWeb
      ? getWebOptimizedUrl(publicId, size)
      : getMobileOptimizedUrl(publicId, size);

    // Tạo responsive URLs
    const responsiveUrls = getResponsiveImageUrls(publicId);

    // Set cache headers
    res.set({
      "Cache-Control": "public, max-age=86400", // Cache 24 giờ cho single image
      "ETag": `"${id}"`,
    });

    res.json({
      ...image,
      optimizedUrl,
      optimizedUrls: responsiveUrls,
      // Giữ URL gốc để backward compatibility
      ImageUrl: image.ImageUrl,
    });
  } catch (error) {
    console.error("Get image by id error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getOptimizedImage = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      width,
      height,
      quality = "auto",
      format = "auto",
      crop = "limit",
      size, // Shortcut: thumbnail, small, medium, large, original
      source = "mobile", // mobile hoặc web
    } = req.query;

    const image = await Image.findById(id);
    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    const publicId = extractPublicId(image.ImageUrl);
    let optimizedUrl;

    // Nếu có size shortcut, sử dụng nó
    if (size) {
      const userAgent = req.headers["user-agent"] || "";
      const isWeb = userAgent.includes("Mozilla") || source === "web";
      optimizedUrl = isWeb
        ? getWebOptimizedUrl(publicId, size)
        : getMobileOptimizedUrl(publicId, size);
    } else {
      // Sử dụng custom transformations
      optimizedUrl = getOptimizedImageUrl(publicId, {
        width: width ? parseInt(width) : null,
        height: height ? parseInt(height) : null,
        quality,
        format,
        crop,
      });
    }

    // Set cache headers (ảnh có thể cache lâu hơn vì đã được optimize)
    res.set({
      "Cache-Control": "public, max-age=31536000", // Cache 1 năm (Cloudinary CDN sẽ handle)
      "ETag": `"${id}-${width || ""}-${height || ""}-${size || ""}"`,
    });

    // Redirect đến optimized URL hoặc trả về URL
    if (req.query.redirect === "true") {
      return res.redirect(optimizedUrl);
    }

    res.json({
      id: image.Id,
      auditId: image.AuditId,
      optimizedUrl,
      originalUrl: image.ImageUrl,
      publicId,
    });
  } catch (error) {
    console.error("Get optimized image error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const deleteImage = async (req, res) => {
  try {
    const { id } = req.params;

    const image = await Image.findById(id);
    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    const { getPool, sql } = require("../config/database");
    const pool = await getPool();
    const request = pool.request();
    request.input("Id", sql.Int, id);

    await request.query("DELETE FROM Images WHERE Id = @Id");

    res.json({ message: "Image deleted successfully" });
  } catch (error) {
    console.error("Delete image error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  uploadImage,
  getImagesByAudit,
  getImageById,
  getOptimizedImage,
  deleteImage,
};
