const Image = require("../models/Image");
const Audit = require("../models/Audit");
const { uploadImageWithWatermark, deleteImage as deleteLocalImage } = require("../services/localUploadService");
const {
  getResponsiveUrls,
} = require("../services/localUploadService");

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

    // Upload to local storage with watermark
    // Convert latitude and longitude to numbers (they come as strings from FormData)
    const latitudeNum = latitude ? parseFloat(latitude) : null;
    const longitudeNum = longitude ? parseFloat(longitude) : null;
    const timezoneOffsetNum = timezoneOffset !== undefined && timezoneOffset !== null
      ? parseInt(timezoneOffset, 10)
      : null;

    const metadata = {
      latitude: latitudeNum,
      longitude: longitudeNum,
      timestamp: timestamp || new Date().toISOString(),
      timezoneOffset: timezoneOffsetNum,
    };

    // Upload image with watermark and get all responsive URLs
    const uploadResult = await uploadImageWithWatermark(
      req.file.buffer,
      metadata,
    );

    // Save to database
    const image = await Image.create({
      AuditId: parsedAuditId,
      ImageUrl: uploadResult.secure_url,
      ReferenceImageUrl: referenceImageUrl || null,
      Latitude: latitudeNum,
      Longitude: longitudeNum,
      CapturedAt: timestamp ? new Date(timestamp) : new Date(),
    });

    // Get responsive URLs for different sizes
    const responsiveUrls = getResponsiveUrls(uploadResult.baseFilename);

    res.status(201).json({
      ...image,
      localStorage: true,
      baseFilename: uploadResult.baseFilename,
      responsiveUrls: responsiveUrls,
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
    const images = await Image.findByAuditId(auditId);

    // Return images with responsive URLs
    const optimizedImages = images.map((image) => {
      // Extract baseFilename from URL if stored as local URL
      let baseFilename = image.ImageUrl;
      if (image.ImageUrl && image.ImageUrl.includes("/uploads/")) {
        // Extract path like: uploads/1234567890_abc123/medium.jpg
        const match = image.ImageUrl.match(/\/uploads\/([^/]+)\//);
        if (match) {
          baseFilename = match[1];
        }
      }

      // Generate responsive URLs
      const responsiveUrls = getResponsiveUrls(baseFilename);

      return {
        ...image,
        responsiveUrls,
        // Default optimized URL based on source
        optimizedUrl: responsiveUrls.medium,
      };
    });

    // Set cache headers để tăng tốc độ
    res.set({
      "Cache-Control": "public, max-age=3600", // Cache 1 giờ
      ETag: `"${auditId}-${images.length}"`,
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
    const image = await Image.findById(id);

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    // Extract baseFilename from URL if stored as local URL
    let baseFilename = image.ImageUrl;
    if (image.ImageUrl && image.ImageUrl.includes("/uploads/")) {
      const match = image.ImageUrl.match(/\/uploads\/([^/]+)\//);
      if (match) {
        baseFilename = match[1];
      }
    }

    // Generate responsive URLs
    const responsiveUrls = getResponsiveUrls(baseFilename);

    // Set cache headers
    res.set({
      "Cache-Control": "public, max-age=86400", // Cache 24 giờ cho single image
      ETag: `"${id}"`,
    });

    res.json({
      ...image,
      responsiveUrls,
      optimizedUrl: responsiveUrls.medium,
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
    const { size = "medium" } = req.query;

    const image = await Image.findById(id);
    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    // Extract baseFilename from URL if stored as local URL
    let baseFilename = image.ImageUrl;
    if (image.ImageUrl && image.ImageUrl.includes("/uploads/")) {
      const match = image.ImageUrl.match(/\/uploads\/([^/]+)\//);
      if (match) {
        baseFilename = match[1];
      }
    }

    // Generate URL for requested size
    const optimizedUrl = getResponsiveUrls(baseFilename)[size] || getResponsiveUrls(baseFilename).medium;

    // Set cache headers (ảnh có thể cache lâu hơn vì đã được optimize)
    res.set({
      "Cache-Control": "public, max-age=31536000", // Cache 1 năm
      ETag: `"${id}-${size}"`,
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
      baseFilename,
      responsiveUrls: getResponsiveUrls(baseFilename),
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

    // Delete local files if using local storage
    if (image.ImageUrl && image.ImageUrl.includes("/uploads/")) {
      const match = image.ImageUrl.match(/\/uploads\/([^/]+)\//);
      if (match) {
        const baseFilename = match[1];
        const { UPLOAD_DIR } = require("../services/localUploadService");
        const folderPath = require("path").join(UPLOAD_DIR, baseFilename);
        await deleteLocalImage(folderPath);
      }
    }

    // Delete from database
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
