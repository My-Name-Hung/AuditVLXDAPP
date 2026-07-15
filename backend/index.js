const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database and cloudinary connections
const { getPool } = require("./config/database");
require("./config/cloudinary");
const { seedAdminUser } = require("./utils/seedAdmin");
const seedSampleData = require("./utils/seedSampleData");
const { ensureUploadDir, UPLOAD_DIR } = require("./services/localUploadService");

// Middleware
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images as static files
const uploadsDir = path.join(__dirname, "uploads");
app.use("/api/uploads", express.static(uploadsDir, {
  maxAge: "1d", // Cache 1 day
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  },
}));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/stores", require("./routes/stores"));
app.use("/api/audits", require("./routes/audits"));
app.use("/api/images", require("./routes/images"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/territories", require("./routes/territories"));
app.use("/api/import", require("./routes/import"));
app.use("/api/cement-products", require("./routes/cementProducts"));
app.use("/api/store-surveys", require("./routes/storeSurveys"));
app.use("/api/store-survey-products", require("./routes/storeSurveyProducts"));

// Health check endpoint
app.get("/health", async (req, res) => {
  const healthStatus = {
    status: "OK",
    message: "Auditapp Backend is running",
    timestamp: new Date().toISOString(),
    services: {
      database: "unknown",
      localStorage: "unknown",
      uploadDir: "unknown",
    },
  };

  // Check local storage configuration
  const baseUrl = process.env.BASE_URL;
  healthStatus.services.localStorage = baseUrl ? "configured" : "using_default";
  healthStatus.services.uploadDir = UPLOAD_DIR;

  // Check database connection
  try {
    const pool = await getPool();
    await pool.request().query("SELECT 1 as health");
    healthStatus.services.database = "connected";
  } catch (error) {
    healthStatus.status = "ERROR";
    healthStatus.message = "Service unavailable - Database connection failed";
    healthStatus.services.database = "disconnected";

    if (process.env.NODE_ENV === "development") {
      healthStatus.error = error.message;
      if (error.message && error.message.includes("certificate")) {
        healthStatus.suggestion =
          "Set DB_TRUST_SERVER_CERTIFICATE=true in .env file";
      }
    }

    return res.status(503).json(healthStatus);
  }

  res.json(healthStatus);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Initialize connections on startup
async function initializeServices() {
  console.log("🔧 Initializing services...");

  // Initialize database connection
  try {
    await getPool();
    console.log("✅ Database connection initialized successfully");

    // Seed default admin user (after DB ready)
    await seedAdminUser();

    // Seed sample data if in development
    if (
      process.env.NODE_ENV === "development" &&
      process.env.SEED_SAMPLE_DATA === "true"
    ) {
      await seedSampleData();
    }
  } catch (error) {
    console.error(
      "❌ Failed to initialize database connection:",
      error.message
    );
    console.error("   Please check your database configuration in .env file");
  }

  // Log local storage configuration
  console.log(`📁 Upload directory: ${UPLOAD_DIR}`);
  console.log(`🔗 Base URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);

  // Check JWT secret
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.warn(
      "⚠️  JWT_SECRET is not set or too short (minimum 32 characters)"
    );
    console.warn(
      "   This is a security risk! Please set a strong JWT_SECRET in .env"
    );
  } else {
    console.log("✅ JWT configuration loaded");
  }
}

// Start server
app.listen(PORT, async () => {
  console.log("=".repeat(50));
  console.log(`🚀 Auditapp Backend Server`);
  console.log(`📍 Running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("=".repeat(50));

  // Initialize services
  await initializeServices();

  // Ensure upload directory exists
  try {
    await ensureUploadDir();
    console.log("✅ Local storage initialized successfully");
  } catch (error) {
    console.error("⚠️  Failed to create upload directory:", error.message);
  }

  // Setup cleanup job for import history (run every 24 hours)
  const { cleanupImportHistory } = require("./utils/cleanupImportHistory");

  // Run cleanup immediately on startup
  cleanupImportHistory().catch((err) => {
    console.error("Error running initial cleanup:", err);
  });

  // Schedule cleanup to run every 24 hours
  setInterval(() => {
    cleanupImportHistory().catch((err) => {
      console.error("Error running scheduled cleanup:", err);
    });
  }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds

  console.log("=".repeat(50));
  console.log(`✅ Server ready! Health check: http://localhost:${PORT}/health`);
  console.log(`🧹 Import history cleanup scheduled (runs every 24 hours)`);
  console.log("=".repeat(50));
});

module.exports = app;
