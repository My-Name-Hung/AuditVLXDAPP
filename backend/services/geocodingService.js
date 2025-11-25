const fetch = require("node-fetch");

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const REQUEST_INTERVAL_MS = 1000; // Respect Nominatim rate limit (~1 req/sec)
const REQUEST_TIMEOUT_MS = Number(process.env.NOMINATIM_TIMEOUT_MS || 8000); // Fail fast if provider is unreachable
const MAX_RETRIES = Number(process.env.NOMINATIM_MAX_RETRIES || 3);
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const CACHE_VERSION = "v3";
const cache = new Map();
let lastRequestTime = 0;

const userAgent =
  process.env.NOMINATIM_USER_AGENT || "AuditApp/1.0 (contact@ximangtaydo.vn)"; // Required by Nominatim
const contactEmail = process.env.NOMINATIM_EMAIL || "contact@ximangtaydo.vn"; // Recommended by Nominatim

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

async function getProvinceDistrict(lat, lon) {
  if (lat === null || lon === null || Number.isNaN(lat) || Number.isNaN(lon)) {
    return { province: null, district: null };
  }

  const cached = getCachedLocation(lat, lon);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    format: "jsonv2",
    lat: lat.toString(),
    lon: lon.toString(),
    zoom: "12",
    addressdetails: "1",
  });

  if (contactEmail) {
    params.set("email", contactEmail);
  }

  const url = `${NOMINATIM_ENDPOINT}?${params.toString()}`;

  try {
    let attempt = 0;
    let responseData = null;
    while (attempt < MAX_RETRIES) {
      try {
        await rateLimit();
        const response = await fetch(url, {
          headers: {
            "User-Agent": userAgent,
            "Accept-Language": "vi,en",
          },
          timeout: REQUEST_TIMEOUT_MS,
        });

        if (!response.ok) {
          throw new Error(
            `Nominatim error: ${response.status} ${response.statusText}`
          );
        }

        responseData = await response.json();
        break;
      } catch (error) {
        attempt += 1;
        if (attempt >= MAX_RETRIES) {
          throw error;
        }
        await sleep(REQUEST_INTERVAL_MS * attempt);
      }
    }

    const address = responseData?.address || {};

    const pickField = (fields, exclude) => {
      for (const field of fields) {
        const value = address[field];
        if (value && value !== exclude) {
          return value;
        }
      }
      return null;
    };

    const province =
      pickField(
        [
          "state",
          "region",
          "province",
          "state_district",
          "county",
          "city",
          "municipality",
        ],
        null
      ) || null;

    const district =
      pickField(
        [
          "district",
          "city_district",
          "borough",
          "county",
          "municipality",
          "town",
          "city",
          "suburb",
          "village",
        ],
        province
      ) || null;

    const normalized = {
      province: province || null,
      district: district || null,
    };

    setCachedLocation(lat, lon, normalized);
    return normalized;
  } catch (error) {
    console.error("Reverse geocoding error:", {
      message: error.message || error,
      url,
    });
    return { province: null, district: null };
  }
}

module.exports = {
  getProvinceDistrict,
};
