import axios from "axios";

// Get API base URL with validation
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;

  // Validate URL format
  if (envUrl && typeof envUrl === "string" && envUrl.trim() !== "") {
    try {
      // Validate URL format
      new URL(envUrl);
      return envUrl;
    } catch {
      console.warn("Invalid VITE_API_BASE_URL format, using default:", envUrl);
    }
  }

  // Default fallback
  return "https://auditvlxdapp.onrender.com/api";
};

const API_BASE_URL = getApiBaseUrl();

// Log API URL in development
if (import.meta.env.DEV) {
  console.log("API Base URL:", API_BASE_URL);
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) {
      const errorMessage = error.response?.data?.error || "";
      if (
        errorMessage.includes("token") ||
        errorMessage.includes("Token") ||
        errorMessage.includes("truy cập")
      ) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        // Redirect to login if not already there
        if (window.location.pathname !== "/login") {
          // Use relative path to avoid URL construction issues
          const loginPath = "/login";
          try {
            // Try to use current origin to construct valid URL
            const loginUrl = new URL(loginPath, window.location.origin);
            window.location.href = loginUrl.pathname;
          } catch {
            // Fallback to simple pathname change
            window.location.pathname = loginPath;
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
