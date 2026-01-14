const fetch = require("node-fetch");

// VietMap API configuration
const VIETMAP_API_KEY = process.env.VIETMAP_KEY;
const VIETMAP_ENDPOINT = "https://maps.vietmap.vn/api/reverse";
const REQUEST_INTERVAL_MS = 500; // basic rate limit to avoid hammering the API
const REQUEST_TIMEOUT_MS = Number(process.env.VIETMAP_TIMEOUT_MS || 8000); // Fail fast if provider is unreachable
const MAX_RETRIES = Number(process.env.VIETMAP_MAX_RETRIES || 3);
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const CACHE_VERSION = "v5"; // Update version to invalidate old cache

const cache = new Map();
const pendingRequests = new Map();
const requestQueue = [];
let lastRequestTime = 0;
let isProcessingQueue = false;

// Note: VietMap uses HTTPS, no need for insecure TLS agent

const userAgent =
  process.env.VIETMAP_USER_AGENT || "AuditApp/1.0 (contact@ximangtaydo.vn)";

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
  if (!VIETMAP_API_KEY) {
    console.warn("[Geocode] VIETMAP_KEY not configured, returning null");
    return { province: null, district: null };
  }

  // Build VietMap API URL
  const params = new URLSearchParams({
    "api-version": "1.1",
    apikey: VIETMAP_API_KEY,
    "point.lat": lat.toString(),
    "point.lon": lon.toString(),
    layers: "address,venue", // Get address and venue information
    size: "1", // Only need the closest result
  });

  const url = `${VIETMAP_ENDPOINT}?${params.toString()}`;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      await rateLimit();
      const response = await fetch(url, {
        headers: {
          "User-Agent": userAgent,
        },
        timeout: REQUEST_TIMEOUT_MS,
      });

      if (!response.ok) {
        throw new Error(
          `VietMap error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      // VietMap response structure: { code: "OK", data: { features: [...] } }
      // Check response code first
      if (data?.code !== "OK") {
        console.warn("[Geocode] VietMap error response", {
          lat,
          lon,
          code: data?.code,
          message: data?.message,
        });
        return { province: null, district: null };
      }

      // Get features from data.features (not data.features directly)
      const features = data?.data?.features || [];
      if (!Array.isArray(features) || features.length === 0) {
        console.warn("[Geocode] VietMap no results", { lat, lon, data });
        return { province: null, district: null };
      }

      // Get the first (closest) result
      const feature = features[0];
      const properties = feature?.properties || {};

      // Extract province and district from VietMap response
      // VietMap response structure (from actual API):
      // properties.region = "Thành Phố Hồ Chí Minh" (Tỉnh/Thành phố)
      // properties.county = "Quận/Huyện" (có thể empty)
      // properties.locality = "Phường An Đông" (Phường/Xã)
      // properties.address = "233 Trần Phú Phường An Đông,Thành Phố Hồ Chí Minh"
      let province = null;
      let district = null;

      // Primary: Extract from properties (most reliable)
      if (properties.region) {
        province = properties.region.trim();
      }

      // County = Quận/Huyện (preferred)
      if (properties.county && properties.county.trim()) {
        district = properties.county.trim();
      } else if (properties.locality && properties.locality.trim()) {
        // Fallback: Use locality (Phường/Xã) if county is empty
        // Note: Locality is usually Phường/Xã, but can be used as district if county is not available
        district = properties.locality.trim();
      }

      // Last fallback: try to parse from address string
      // Format: "Street Ward,Province" or "Street, Ward, Province"
      if ((!province || !district) && properties.address) {
        const address = properties.address.trim();
        // Split by comma
        const addressParts = address
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s);

        if (addressParts.length >= 1) {
          // Last part is usually province
          if (!province && addressParts.length >= 1) {
            province = addressParts[addressParts.length - 1];
          }
          // If address has format "Street Ward,Province", try to extract ward/district
          if (!district && addressParts.length >= 2) {
            // Second to last might be ward/district
            const secondLast = addressParts[addressParts.length - 2];
            // Check if it contains "Phường", "Xã", "Quận", "Huyện"
            if (
              secondLast.includes("Phường") ||
              secondLast.includes("Xã") ||
              secondLast.includes("Quận") ||
              secondLast.includes("Huyện")
            ) {
              district = secondLast;
            }
          }
        }
      }

      console.log("[Geocode] VietMap result", {
        lat,
        lon,
        province,
        district,
        properties: Object.keys(properties),
        region: properties.region,
        county: properties.county,
        locality: properties.locality,
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
