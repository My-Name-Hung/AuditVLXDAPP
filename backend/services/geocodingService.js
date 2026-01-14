const fetch = require("node-fetch");
const https = require("https");

// VN2000 API configuration (revert from VietMap back to VN2000)
// Example:
// VN2000_ENDPOINT=https://vn2000.vn/api/thongtindiachinh
// VN2000_INSECURE_TLS=true   // optional, allow self-signed certs
const VN2000_ENDPOINT =
  process.env.VN2000_ENDPOINT || "https://vn2000.vn/api/thongtindiachinh";
const VN2000_INSECURE_TLS =
  (process.env.VN2000_INSECURE_TLS || "false").toLowerCase() === "true";
const REQUEST_INTERVAL_MS = 500; // basic rate limit to avoid hammering the API
const REQUEST_TIMEOUT_MS = Number(process.env.VN2000_TIMEOUT_MS || 8000); // Fail fast if provider is unreachable
const MAX_RETRIES = Number(process.env.VN2000_MAX_RETRIES || 3);
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const CACHE_VERSION = "v6"; // Update version to invalidate old cache after switching provider

const cache = new Map();
const pendingRequests = new Map();
const requestQueue = [];
let lastRequestTime = 0;
let isProcessingQueue = false;

// Optional HTTPS agent for insecure TLS (self-signed certificate)
const insecureAgent = VN2000_INSECURE_TLS
  ? new https.Agent({
      rejectUnauthorized: false,
    })
  : null;

const userAgent =
  process.env.VN2000_USER_AGENT || "AuditApp/1.0 (contact@ximangtaydo.vn)";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const roundCoordinate = (value) => Number.parseFloat(value).toFixed(4);

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < REQUEST_INTERVAL_MS) {
    await sleep(REQUEST_INTERVAL_MS - elapsed);
  }
  lastRequestTime = Date.now();
}

function getCacheKey(lat, lon) {
  return `${CACHE_VERSION}|${roundCoordinate(lat)}|${roundCoordinate(lon)}`;
}

function getCachedLocation(lat, lon) {
  const key = getCacheKey(lat, lon);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

function setCachedLocation(lat, lon, data) {
  const key = getCacheKey(lat, lon);
  cache.set(key, { timestamp: Date.now(), data });
}

function enqueueGeocode(lat, lon) {
  const cacheKey = getCacheKey(lat, lon);
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  const promise = new Promise((resolve) => {
    requestQueue.push({
      lat,
      lon,
      cacheKey,
      resolve,
      enqueuedAt: Date.now(),
    });
    processQueue();
  }).finally(() => {
    pendingRequests.delete(cacheKey);
  });

  pendingRequests.set(cacheKey, promise);
  return promise;
}

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const job = requestQueue.shift();
    const waitedMs = Date.now() - job.enqueuedAt;
    console.info("[Geocode] processing job", {
      lat: job.lat,
      lon: job.lon,
      waitedMs,
      remainingQueue: requestQueue.length,
    });
    const result = await fetchProvinceDistrict(job.lat, job.lon);
    if (result?.province || result?.district) {
      setCachedLocation(job.lat, job.lon, result);
    }
    job.resolve(result);
  }

  isProcessingQueue = false;
}

async function fetchProvinceDistrict(lat, lon) {
  // Build VN2000 API URL
  // Example: https://vn2000.vn/api/thongtindiachinh?vido=16.0302630&kinhdo=107.904724
  const params = new URLSearchParams({
    vido: lat.toString(),
    kinhdo: lon.toString(),
  });

  const url = `${VN2000_ENDPOINT}?${params.toString()}`;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      await rateLimit();
      const response = await fetch(url, {
        headers: {
          "User-Agent": userAgent,
        },
        timeout: REQUEST_TIMEOUT_MS,
        // Allow insecure TLS if VN2000_INSECURE_TLS=true
        agent: insecureAgent || undefined,
      });

      if (!response.ok) {
        throw new Error(
          `VietMap error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      // VN2000 response structure (example):
      // {
      //   "success": true,
      //   "message": "Lấy dữ liệu thành công",
      //   "data": {
      //     "lat": 16.030263,
      //     "lng": 107.904724,
      //     "diachinh_sausapnhap": {
      //       "properties": {
      //         "ten_xa": "Sông Vàng",
      //         "ten_tinh": "Đà Nẵng",
      //         ...
      //       }
      //     }
      //   }
      // }

      if (!data?.success) {
        console.warn("[Geocode] VN2000 error response", {
          lat,
          lon,
          success: data?.success,
          message: data?.message,
        });
        return { province: null, district: null };
      }

      const propsSauSapNhap =
        data?.data?.diachinh_sausapnhap?.properties || null;
      const propsTruocSapNhap =
        data?.data?.diachinh_truocsapnhap?.properties || null;

      let province = null;
      let district = null;

      // Ưu tiên dùng địa giới hành chính sau sáp nhập
      if (propsSauSapNhap) {
        if (propsSauSapNhap.ten_tinh) {
          province = String(propsSauSapNhap.ten_tinh).trim();
        }
        if (propsSauSapNhap.ten_xa) {
          district = String(propsSauSapNhap.ten_xa).trim();
        }
      }

      // Fallback: dùng thông tin trước sáp nhập nếu cần
      if ((!province || !district) && propsTruocSapNhap) {
        if (!province && propsTruocSapNhap.ten_tinh) {
          province = String(propsTruocSapNhap.ten_tinh).trim();
        }
        if (!district && propsTruocSapNhap.ten_xa) {
          district = String(propsTruocSapNhap.ten_xa).trim();
        }
      }

      console.log("[Geocode] VN2000 result", {
        lat,
        lon,
        province,
        district,
        hasSauSapNhap: !!propsSauSapNhap,
        hasTruocSapNhap: !!propsTruocSapNhap,
      });

      return {
        province: province || null,
        district: district || null,
      };
    } catch (error) {
      attempt += 1;
      console.warn("[Geocode] attempt failed", {
        attempt,
        maxRetries: MAX_RETRIES,
        lat,
        lon,
        message: error.message || error,
        type: error.type,
        code: error.code,
        url,
      });
      if (attempt >= MAX_RETRIES) {
        return { province: null, district: null };
      }
      await sleep(REQUEST_INTERVAL_MS * attempt);
    }
  }

  return { province: null, district: null };
}

async function getProvinceDistrict(lat, lon) {
  if (lat === null || lon === null || Number.isNaN(lat) || Number.isNaN(lon)) {
    return { province: null, district: null };
  }

  const cached = getCachedLocation(lat, lon);
  if (cached) {
    return cached;
  }

  return enqueueGeocode(lat, lon);
}

module.exports = {
  getProvinceDistrict,
};
