const sql = require("mssql");

const config = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || "1433"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
    enableArithAbort: true,
    requestTimeout: 60000, // 60 seconds default timeout
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 30000, // 30 seconds connection timeout
  requestTimeout: 60000, // 60 seconds request timeout
};

let pool = null;

const getPool = async () => {
  try {
    if (pool) {
      return pool;
    }

    // Validate database configuration
    if (
      !config.server ||
      !config.user ||
      !config.password ||
      !config.database
    ) {
      throw new Error(
        "Database configuration incomplete. Please check DB_SERVER, DB_USER, DB_PASSWORD, and DB_NAME in .env file"
      );
    }

    console.log(
      `🔌 Connecting to SQL Server: ${config.server}:${config.port}/${config.database}...`
    );
    pool = await sql.connect(config);
    console.log("✅ Connected to SQL Server database successfully");
    return pool;
  } catch (error) {
    console.error("❌ Database connection error:", error.message);

    // Check for certificate/SSL errors
    if (
      error.message &&
      error.message.includes("unable to get local issuer certificate")
    ) {
      console.error("   ⚠️  SSL Certificate error detected!");
      console.error(
        "   Solution: Set DB_TRUST_SERVER_CERTIFICATE=true in .env file"
      );
      console.error(
        "   This is required for AWS RDS and some SQL Server instances."
      );
    } else if (error.code === "ELOGIN") {
      console.error(
        "   Authentication failed. Please check DB_USER and DB_PASSWORD."
      );
    } else if (error.code === "ETIMEOUT") {
      console.error(
        "   Connection timeout. Please check DB_SERVER and network connectivity."
      );
    } else if (error.code === "ESOCKET") {
      console.error(
        "   Cannot reach database server. Please check DB_SERVER and DB_PORT."
      );
    } else if (error.message && error.message.includes("certificate")) {
      console.error("   ⚠️  Certificate/SSL error detected!");
      console.error(
        "   Try setting DB_TRUST_SERVER_CERTIFICATE=true in .env file"
      );
    }

    throw error;
  }
};

const closePool = async () => {
  try {
    if (pool) {
      await pool.close();
      pool = null;
      console.log("✅ Database connection closed");
    }
  } catch (error) {
    console.error("❌ Error closing database connection:", error);
    throw error;
  }
};

module.exports = {
  getPool,
  closePool,
  sql,
};
