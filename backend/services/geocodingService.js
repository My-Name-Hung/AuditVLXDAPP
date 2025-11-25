const fetch = require("node-fetch");

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const REQUEST_INTERVAL_MS = 1000; // Respect Nominatim rate limit (~1 req/sec)
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours
const CACHE_VERSION = "v2";
const cache = new Map();
let lastRequestTime = 0;

const userAgent =
  process.env.NOMINATIM_USER_AGENT || "AuditApp/1.0 (contact@ximangtaydo.vn)"; // Required by Nominatim

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

  try {
    await rateLimit();
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: lat.toString(),
      lon: lon.toString(),
      zoom: "12",
      addressdetails: "1",
    });

    const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
      headers: {
        "User-Agent": userAgent,
        "Accept-Language": "vi,en",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Nominatim error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const address = data.address || {};

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
    console.error("Reverse geocoding error:", error.message || error);
    return { province: null, district: null };
  }
}

module.exports = {
  getProvinceDistrict,
};
