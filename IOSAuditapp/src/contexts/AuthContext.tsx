import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: number;
  userCode: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  avatar?: string;
  isChangePassword: boolean;
  position?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ user: User; token: string }>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const REMEMBER_PASSWORD_KEY = 'remember_password';
const SAVED_USERNAME_KEY = 'saved_username';
const SAVED_PASSWORD_KEY = 'saved_password';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (!storedToken || !storedUser) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
        setLoading(false);
        return;
      }

      let parsedUser: User | null = null;
      try {
        parsedUser = JSON.parse(storedUser);
      } catch {
        console.warn('Invalid user data in storage, clearing auth state');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
        setLoading(false);
        return;
      }

      // Validate token by fetching current user profile
      try {
        const response = await api.get(`/users/${parsedUser.id}`);
        if (response.status >= 200 && response.status < 300 && response.data) {
          const apiUser = response.data;

          const mergedUser: User = {
            id: apiUser.Id ?? parsedUser.id,
            userCode: apiUser.UserCode ?? parsedUser.userCode,
            username: apiUser.Username ?? parsedUser.username,
            fullName: apiUser.FullName ?? parsedUser.fullName,
            email: apiUser.Email ?? parsedUser.email,
            phone: apiUser.Phone ?? parsedUser.phone,
            role: apiUser.Role ?? parsedUser.role,
            avatar: apiUser.Avatar ?? parsedUser.avatar,
            position: apiUser.Position ?? parsedUser.position,
            isChangePassword:
              typeof apiUser.IsChangePassword === 'boolean'
                ? apiUser.IsChangePassword
                : apiUser.IsChangePassword !== undefined
                ? Boolean(apiUser.IsChangePassword)
                : parsedUser.isChangePassword ?? false,
          };

          setToken(storedToken);
          setUser(mergedUser);
          localStorage.setItem('user', JSON.stringify(mergedUser));
        } else {
          throw new Error('Invalid API response');
        }
      } catch (error: any) {
        console.warn('Stored token invalid or API error, clearing auth state', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      const { token: newToken, user: userData } = response.data;

      setToken(newToken);
      setUser(userData);
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(userData));

      return { user: userData, token: newToken };
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Đăng nhập thất bại');
    }
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem(REMEMBER_PASSWORD_KEY);
    localStorage.removeItem(SAVED_USERNAME_KEY);
    localStorage.removeItem(SAVED_PASSWORD_KEY);
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        loading,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper functions for remember password
export const saveCredentials = (username: string, password: string) => {
  localStorage.setItem(REMEMBER_PASSWORD_KEY, 'true');
  localStorage.setItem(SAVED_USERNAME_KEY, username);
  localStorage.setItem(SAVED_PASSWORD_KEY, password);
};

export const getSavedCredentials = (): { username: string; password: string } | null => {
  const rememberPassword = localStorage.getItem(REMEMBER_PASSWORD_KEY);
  if (rememberPassword === 'true') {
    const username = localStorage.getItem(SAVED_USERNAME_KEY);
    const password = localStorage.getItem(SAVED_PASSWORD_KEY);
    if (username && password) {
      return { username, password };
    }
  }
  return null;
};

export const clearSavedCredentials = () => {
  localStorage.removeItem(REMEMBER_PASSWORD_KEY);
  localStorage.removeItem(SAVED_USERNAME_KEY);
  localStorage.removeItem(SAVED_PASSWORD_KEY);
};

