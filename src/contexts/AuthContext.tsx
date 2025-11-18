import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import api from "../services/api";

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
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (
    username: string,
    password: string
  ) => Promise<{ user: User; token: string }>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  authenticateWithBiometrics: () => Promise<boolean>;
  isBiometricAvailable: boolean;
  isBiometricEnabled: boolean;
  enableBiometric: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BIOMETRIC_KEY = "biometric_enabled";
const REMEMBER_PASSWORD_KEY = "remember_password";
const SAVED_USERNAME_KEY = "saved_username";
const SAVED_PASSWORD_KEY = "saved_password";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);

  useEffect(() => {
    checkBiometricAvailability();
    loadStoredAuth();
  }, []);

  const checkBiometricAvailability = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setIsBiometricAvailable(compatible && enrolled);

    const enabled = await AsyncStorage.getItem(BIOMETRIC_KEY);
    setIsBiometricEnabled(enabled === "true");
  };

  const loadStoredAuth = async () => {
    try {
      const [storedToken, storedUser, biometricEnabled] = await Promise.all([
        AsyncStorage.getItem("token"),
        AsyncStorage.getItem("user"),
        AsyncStorage.getItem(BIOMETRIC_KEY),
      ]);

      // If no token or user stored, clear everything and show login
      if (!storedToken || !storedUser) {
        // Clear any partial data
        await AsyncStorage.removeItem("token");
        await AsyncStorage.removeItem("user");
        setToken(null);
        setUser(null);
        setIsBiometricEnabled(false);
        setLoading(false);
        return;
      }

      // Try to parse user data
      let parsedUser;
      try {
        parsedUser = JSON.parse(storedUser);
      } catch {
        console.warn("Invalid user data in storage, clearing auth state");
        await AsyncStorage.removeItem("token");
        await AsyncStorage.removeItem("user");
        await AsyncStorage.removeItem(BIOMETRIC_KEY);
        setToken(null);
        setUser(null);
        setIsBiometricEnabled(false);
        setLoading(false);
        return;
      }

      // Validate token by fetching current user profile
      try {
        const response = await api.get(`/users/${parsedUser.id}`);
        // Only set auth state if response is successful and contains valid user data
        if (response.status >= 200 && response.status < 300 && response.data) {
          setToken(storedToken);
          setUser(parsedUser);
          setIsBiometricEnabled(biometricEnabled === "true");
        } else {
          throw new Error("Invalid API response");
        }
      } catch (error: any) {
        // Token invalid or API error - clear everything
        console.warn(
          "Stored token invalid or API error, clearing auth state",
          error
        );
        await AsyncStorage.removeItem("token");
        await AsyncStorage.removeItem("user");
        await AsyncStorage.removeItem(BIOMETRIC_KEY);
        setToken(null);
        setUser(null);
        setIsBiometricEnabled(false);
      }
    } catch (error) {
      console.error("Error loading stored auth:", error);
      // On any error, clear auth state to ensure login screen shows
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");
      setToken(null);
      setUser(null);
      setIsBiometricEnabled(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await api.post("/auth/login", { username, password });
      const { token: newToken, user: userData } = response.data;

      setToken(newToken);
      setUser(userData);
      await AsyncStorage.setItem("token", newToken);
      await AsyncStorage.setItem("user", JSON.stringify(userData));

      return { user: userData, token: newToken };
    } catch (error: any) {
      throw new Error(error.response?.data?.error || "Đăng nhập thất bại");
    }
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user");
    await AsyncStorage.removeItem(BIOMETRIC_KEY);
    await AsyncStorage.removeItem(REMEMBER_PASSWORD_KEY);
    await AsyncStorage.removeItem(SAVED_USERNAME_KEY);
    await AsyncStorage.removeItem(SAVED_PASSWORD_KEY);
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      AsyncStorage.setItem("user", JSON.stringify(updatedUser));
    }
  };

  const authenticateWithBiometrics = async (
    skipEnabledCheck = false
  ): Promise<boolean> => {
    try {
      if (!isBiometricAvailable) {
        return false;
      }

      if (!skipEnabledCheck && !isBiometricEnabled) {
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Xác thực bằng vân tay",
        cancelLabel: "Hủy",
        fallbackLabel: "Sử dụng mật khẩu",
      });

      return result.success;
    } catch (error) {
      console.error("Biometric authentication error:", error);
      return false;
    }
  };

  const enableBiometric = async () => {
    await AsyncStorage.setItem(BIOMETRIC_KEY, "true");
    setIsBiometricEnabled(true);
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
        authenticateWithBiometrics,
        isBiometricAvailable,
        isBiometricEnabled,
        enableBiometric,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Helper functions for remember password
export const saveCredentials = async (username: string, password: string) => {
  await AsyncStorage.setItem(REMEMBER_PASSWORD_KEY, "true");
  await AsyncStorage.setItem(SAVED_USERNAME_KEY, username);
  await AsyncStorage.setItem(SAVED_PASSWORD_KEY, password);
};

export const getSavedCredentials = async (): Promise<{
  username: string;
  password: string;
} | null> => {
  const rememberPassword = await AsyncStorage.getItem(REMEMBER_PASSWORD_KEY);
  if (rememberPassword === "true") {
    const username = await AsyncStorage.getItem(SAVED_USERNAME_KEY);
    const password = await AsyncStorage.getItem(SAVED_PASSWORD_KEY);
    if (username && password) {
      return { username, password };
    }
  }
  return null;
};

export const clearSavedCredentials = async () => {
  await AsyncStorage.removeItem(REMEMBER_PASSWORD_KEY);
  await AsyncStorage.removeItem(SAVED_USERNAME_KEY);
  await AsyncStorage.removeItem(SAVED_PASSWORD_KEY);
};
