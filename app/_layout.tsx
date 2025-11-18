import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";

import PermissionModal, {
  checkPermissionsAsked,
} from "@/src/components/PermissionModal";
import { AuthProvider, useAuth } from "@/src/contexts/AuthContext";
import { ThemeProvider as CustomThemeProvider } from "@/src/contexts/ThemeContext";

function RootNavigation() {
  const { isAuthenticated, loading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inTabsGroup = segments[0] === "(tabs)";
    const inChangePasswordScreen =
      inAuthGroup && segments[1] === "change-password";

    const requiresChangePassword = !!user?.isChangePassword;

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace("/(auth)/login");
    } else if (
      isAuthenticated &&
      requiresChangePassword &&
      !inChangePasswordScreen
    ) {
      // Force user to go to change password screen on first login or when required
      router.replace("/(auth)/change-password");
    } else if (isAuthenticated && inAuthGroup && !requiresChangePassword) {
      // Redirect to stores if authenticated but in auth group and no password change required
      router.replace("/(tabs)/stores");
    }
  }, [isAuthenticated, loading, segments, user]);

  if (loading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}

export default function RootLayout() {
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    checkInitialPermissions();
    loadDarkModePreference();
  }, []);

  const checkInitialPermissions = async () => {
    const asked = await checkPermissionsAsked();
    if (!asked) {
      setShowPermissionModal(true);
    }
  };

  const loadDarkModePreference = async () => {
    try {
      const saved = await AsyncStorage.getItem("dark_mode_enabled");
      setIsDarkMode(saved === "true");
    } catch (error) {
      console.error("Error loading dark mode preference:", error);
    }
  };

  // Listen for dark mode changes
  useEffect(() => {
    const interval = setInterval(() => {
      AsyncStorage.getItem("dark_mode_enabled").then((saved) => {
        setIsDarkMode(saved === "true");
      });
    }, 500); // Check every 500ms

    return () => clearInterval(interval);
  }, []);

  return (
    <AuthProvider>
      <CustomThemeProvider>
        <ThemeProvider value={isDarkMode ? DarkTheme : DefaultTheme}>
          <RootNavigation />
          <StatusBar style="auto" />
          <PermissionModal
            visible={showPermissionModal}
            onComplete={() => setShowPermissionModal(false)}
          />
        </ThemeProvider>
      </CustomThemeProvider>
    </AuthProvider>
  );
}
