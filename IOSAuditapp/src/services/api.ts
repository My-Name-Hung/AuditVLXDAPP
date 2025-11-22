import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://auditvlxdapp.onrender.com/api";

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
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
