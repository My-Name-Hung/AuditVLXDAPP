const sql = require("mssql");

const dbName = process.env.DB_NAME; // DBXMTD – current live data (post 10/04/2026)
const dbBackupName = process.env.DB_BACKUP_NAME; // RE_SALE_20260410 – backup up to 10/04/2026

const baseConfig = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || "1433"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
    enableArithAbort: true,
    requestTimeout: 60000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 30000,
  requestTimeout: 60000,
};

const config = { ...baseConfig, database: dbName };
const configBackup = { ...baseConfig, database: dbBackupName };

let pool = null;
let poolBackup = null;

const getPool = async () => {
  try {
    if (pool) return pool;
    if (!config.server || !config.user || !config.password || !config.database) {
      throw new Error("Database configuration incomplete. Please check DB_SERVER, DB_USER, DB_PASSWORD, and DB_NAME in .env file");
    }
    console.log(`🔌 Connecting to SQL Server: ${config.server}:${config.port}/${config.database}...`);
    pool = await sql.connect(config);
    console.log("✅ Connected to SQL Server database successfully");
    return pool;
  } catch (error) {
    console.error("❌ Database connection error:", error.message);
    if (error.message && error.message.includes("unable to get local issuer certificate")) {
      console.error("   ⚠️  SSL Certificate error detected!");
      console.error("   Solution: Set DB_TRUST_SERVER_CERTIFICATE=true in .env file");
      console.error("   This is required for AWS RDS and some SQL Server instances.");
    } else if (error.code === "ELOGIN") {
      console.error("   Authentication failed. Please check DB_USER and DB_PASSWORD.");
    } else if (error.code === "ETIMEOUT") {
      console.error("   Connection timeout. Please check DB_SERVER and network connectivity.");
    } else if (error.code === "ESOCKET") {
      console.error("   Cannot reach database server. Please check DB_SERVER and DB_PORT.");
    } else if (error.message && error.message.includes("certificate")) {
      console.error("   ⚠️  Certificate/SSL error detected!");
      console.error("   Try setting DB_TRUST_SERVER_CERTIFICATE=true in .env file");
    }
    throw error;
  }
};

const getBackupPool = async () => {
  if (!dbBackupName) return null;
  try {
    if (poolBackup) return poolBackup;
    console.log(`🔌 Connecting to backup SQL Server: ${configBackup.server}:${configBackup.port}/${configBackup.database}...`);
    poolBackup = await sql.connect(configBackup);
    console.log("✅ Connected to backup SQL Server database successfully");
    return poolBackup;
  } catch (error) {
    console.warn("⚠️  Could not connect to backup database (this is OK if backup DB is not needed):", error.message);
    return null;
  }
};

const closePool = async () => {
  try {
    if (pool) { await pool.close(); pool = null; console.log("✅ Database connection closed"); }
    if (poolBackup) { await poolBackup.close(); poolBackup = null; console.log("✅ Backup Database connection closed"); }
  } catch (error) {
    console.error("❌ Error closing database connection:", error);
    throw error;
  }
};

/**
 * Dual-DB helper: automatically merges data from DBXMTD (live) + RE_SALE_20260410 (backup).
 *
 * MERGE STRATEGY:
 *   1. Both DBs contribute their rows (UNION ALL style).
 *   2. Deduplication: rows from the live DBXMTD take precedence.
 *      → same Id found in both DBs = keep the one from DBXMTD.
 *   3. For date-safe tables (Audits, Images) → deduplicate by (Id, AuditDate/CapturedAt)
 *      to avoid row explosion when DBXMTD has new entries on the same PK.
 *
 * USAGE in controllers:
 *   const { getPool, getBackupPool, dualDB } = require('../config/database');
 *
 *   const pools = await dualDB.getBothPools();
 *   if (!pools.backup) { /* fallback to single DB *\/ }
 *   const result = await dualDB.execDualUnion({ mainQuery, backupQuery, pools });
 */
const dualDB = {
  /**
   * Open both DB pools. Returns null for backup if unavailable or DB_BACKUP_NAME not set.
   */
  async getBothPools() {
    const main = await getPool();
    const backup = await getBackupPool();
    return { main, backup };
  },

  /**
   * Run two different queries (one for each DB) and merge/deduplicate results.
   * Returns { recordset: mergedRows } to match mssql result shape.
   * Key for dedup = Id column (stringified if composite).
   */
  async execDualUnion({ mainQuery, backupQuery, pools }) {
    const { main, backup } = pools;
    const [mainResult, backupResult] = await Promise.all([
      main.query(mainQuery),
      backupQuery && backup ? backup.query(backupQuery) : Promise.resolve({ recordset: [] }),
    ]);

    const seenKeys = new Set();
    const merged = [];
    for (const row of mainResult.recordset) {
      seenKeys.add(row.Id || JSON.stringify(row));
      merged.push(row);
    }
    for (const row of backupResult.recordset) {
      const k = row.Id || JSON.stringify(row);
      if (!seenKeys.has(k)) merged.push(row);
    }
    return { recordset: merged };
  },
};

module.exports = {
  getPool,
  getBackupPool,
  closePool,
  dualDB,
  sql,
};
