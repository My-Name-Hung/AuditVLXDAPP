const fetch = require("node-fetch");
const https = require("https");

const VN2000_ENDPOINT =
  process.env.VN2000_ENDPOINT || "https://vn2000.vn/api/thongtindiachinh";
const REQUEST_INTERVAL_MS = 500; // basic rate limit to avoid hammering the API
const REQUEST_TIMEOUT_MS = Number(process.env.VN2000_TIMEOUT_MS || 8000); // Fail fast if provider is unreachable
const MAX_RETRIES = Number(process.env.VN2000_MAX_RETRIES || 3);
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const CACHE_VERSION = "v4";

const cache = new Map();
const pendingRequests = new Map();
const requestQueue = [];
let lastRequestTime = 0;
let isProcessingQueue = false;

// Optional: allow disabling TLS verification for VN2000 endpoint.
// ONLY enable this via env VN2000_INSECURE_TLS=true nếu bạn chấp nhận rủi ro bảo mật.
const insecureTlsAgent =
  process.env.VN2000_INSECURE_TLS === "true"
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined;

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
        // Use insecure agent only when explicitly enabled for VN2000
        agent: insecureTlsAgent,
        timeout: REQUEST_TIMEOUT_MS,
      });

      if (!response.ok) {
        throw new Error(
          `VN2000 error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      if (!data?.success || !data?.data) {
        throw new Error(
          `VN2000 invalid response: ${JSON.stringify(data).slice(0, 200)}`
        );
      }

      const propsAfter =
        data.data.diachinh_sausapnhap?.properties ||
        data.data.diachinh_truocsapnhap?.properties ||
        {};

      const propsBefore =
        data.data.diachinh_truocsapnhap?.properties ||
        data.data.diachinh_sausapnhap?.properties ||
        {};

      const province =
        propsAfter.ten_tinh ||
        propsBefore.ten_tinh ||
        propsAfter.ten_huyen ||
        propsBefore.ten_huyen ||
        null;

      const district =
        propsAfter.ten_xa ||
        propsBefore.ten_xa ||
        propsAfter.ten_huyen ||
        propsBefore.ten_huyen ||
        null;

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
        stack: error.stack,
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
