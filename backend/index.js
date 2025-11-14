const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database and cloudinary connections
const { getPool } = require("./config/database");
require("./config/cloudinary");
const { seedAdminUser } = require("./utils/seedAdmin");

// Middleware
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/stores", require("./routes/stores"));
app.use("/api/audits", require("./routes/audits"));
app.use("/api/images", require("./routes/images"));

// Health check endpoint
app.get("/health", async (req, res) => {
  const healthStatus = {
    status: "OK",
    message: "Auditapp Backend is running",
    timestamp: new Date().toISOString(),
    services: {
      database: "unknown",
      cloudinary: "unknown",
    },
  };

  // Check Cloudinary configuration (independent check)
  const cloudinaryConfigured =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;
  healthStatus.services.cloudinary = cloudinaryConfigured
    ? "configured"
    : "not configured";

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
  } catch (error) {
    console.error(
      "❌ Failed to initialize database connection:",
      error.message
    );
    console.error("   Please check your database configuration in .env file");
  }

  // Check Cloudinary configuration
  const cloudinaryConfigured =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;

  if (cloudinaryConfigured) {
    console.log("✅ Cloudinary configuration loaded successfully");
  } else {
    console.warn("⚠️  Cloudinary not configured. Image upload will not work.");
    console.warn(
      "   Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env"
    );
  }

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

  console.log("=".repeat(50));
  console.log(`✅ Server ready! Health check: http://localhost:${PORT}/health`);
  console.log("=".repeat(50));
});

module.exports = app;
