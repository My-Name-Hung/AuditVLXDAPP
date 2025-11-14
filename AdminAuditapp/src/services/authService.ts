import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  async login(username: string, password: string) {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },

  async register(userData: any) {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
};

export default api;

