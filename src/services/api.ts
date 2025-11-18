import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://auditvlxdapp.onrender.com/api";

// Log API URL in development to verify env vars are loaded
if (__DEV__) {
  console.log("API Base URL:", API_BASE_URL);
  console.log("Environment:", process.env.EXPO_PUBLIC_ENV || "development");
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => {
    // Only clear token if it's a 401 error, not for successful responses
    return response;
  },
  async (error) => {
    // Only handle 401 errors, ignore if response is successful
    if (error.response?.status === 401) {
      // Token expired or invalid - only clear if it's actually an auth error
      // Don't clear token if the request was successful but response format is unexpected
      const errorMessage = error.response?.data?.error || "";
      // Only clear token if it's actually an authentication error
      if (
        errorMessage.includes("token") ||
        errorMessage.includes("Token") ||
        errorMessage.includes("truy cập")
      ) {
        await AsyncStorage.removeItem("token");
        await AsyncStorage.removeItem("user");
      }
    }
    return Promise.reject(error);
  }
);

export default api;
