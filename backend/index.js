const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database and cloudinary connections
const { getPool } = require("./config/database");
require("./config/cloudinary");
const { seedAdminUser } = require("./utils/seedAdmin");
const seedSampleData = require("./utils/seedSampleData");
const { resetAllStoreAudits } = require("./utils/auditReset");

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

// Helper: check if a date is the last day of its quarter (Mar, Jun, Sep, Dec)
const isLastDayOfQuarter = (date) => {
  const check = new Date(date);
  const month = check.getMonth(); // 0-based: 0 = Jan, 11 = Dec

  // Only quarters ending in March(2), June(5), September(8), December(11)
  const isQuarterEndMonth = [2, 5, 8, 11].includes(month);
  if (!isQuarterEndMonth) return false;

  // Last day of month: next day changes month
  const nextDay = new Date(check);
  nextDay.setDate(check.getDate() + 1);
  return nextDay.getMonth() !== month;
};

// Helper: check if a date is exactly 10 days after the last day of its quarter
// This allows for backup period before automatic deletion
const isLastDayOfQuarterPlus10 = (date) => {
  const check = new Date(date);
  const year = check.getFullYear();
  const month = check.getMonth(); // 0-based: 0 = Jan, 11 = Dec
  const day = check.getDate();

  // Calculate the last day of each quarter
  // Q1 ends: March 31 (month 2, day 31)
  // Q2 ends: June 30 (month 5, day 30)
  // Q3 ends: September 30 (month 8, day 30)
  // Q4 ends: December 31 (month 11, day 31)
  const quarterEndDates = [
    { month: 2, day: 31 }, // March 31
    { month: 5, day: 30 }, // June 30
    { month: 8, day: 30 }, // September 30
    { month: 11, day: 31 }, // December 31
  ];

  // Check if current date is exactly 10 days after any quarter end
  for (const quarterEnd of quarterEndDates) {
    const quarterEndDate = new Date(year, quarterEnd.month, quarterEnd.day);
    const targetDate = new Date(quarterEndDate);
    targetDate.setDate(targetDate.getDate() + 10);

    // Compare year, month, and day
    if (
      check.getFullYear() === targetDate.getFullYear() &&
      check.getMonth() === targetDate.getMonth() &&
      check.getDate() === targetDate.getDate()
    ) {
      return true;
    }
  }

  return false;
};

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

  // Setup cleanup job for import history (run every 24 hours)
  const { cleanupImportHistory } = require('./utils/cleanupImportHistory');
  
  // Run cleanup immediately on startup
  cleanupImportHistory().catch(err => {
    console.error('Error running initial cleanup:', err);
  });
  
  // Schedule cleanup to run every 24 hours
  setInterval(() => {
    cleanupImportHistory().catch(err => {
      console.error('Error running scheduled cleanup:', err);
    });
  }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds

  // Schedule quarterly audit reset at 23:59 every day, only execute on last day of quarter + 10 days (for backup period)
  cron.schedule("0 59 23 * * *", async () => {
    const now = new Date();
    if (!isLastDayOfQuarterPlus10(now)) {
      return;
    }

    console.log("🗓️  Running quarterly audit reset job (quarter + 10 days backup period)...");
    try {
      const result = await resetAllStoreAudits();
      console.log(
        `✅ Quarterly audit reset completed. Audits deleted: ${result.auditsDeleted}, Images deleted: ${result.imagesDeleted}, Stores reset: ${result.storesUpdated}`
      );
    } catch (error) {
      console.error("❌ Quarterly audit reset failed:", error);
    }
  });

  console.log("=".repeat(50));
  console.log(`✅ Server ready! Health check: http://localhost:${PORT}/health`);
  console.log(`🧹 Import history cleanup scheduled (runs every 24 hours)`);
  console.log(`🗓️  Quarterly audit reset scheduled (23:59 on last day of quarter + 10 days for backup)`);
  console.log("=".repeat(50));
});

module.exports = app;
