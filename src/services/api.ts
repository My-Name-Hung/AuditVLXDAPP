import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
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
      const errorMessage = error.response?.data?.error || '';
      // Only clear token if it's actually an authentication error
      if (errorMessage.includes('token') || errorMessage.includes('Token') || errorMessage.includes('truy cập')) {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
      }
    }
    return Promise.reject(error);
  }
);

export default api;

