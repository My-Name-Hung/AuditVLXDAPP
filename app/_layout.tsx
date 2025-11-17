import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";

import PermissionModal, {
  checkPermissionsAsked,
} from "@/src/components/PermissionModal";
import { AuthProvider } from "@/src/contexts/AuthContext";
import { ThemeProvider as CustomThemeProvider } from "@/src/contexts/ThemeContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

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
          <Stack>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal"
              options={{ presentation: "modal", title: "Modal" }}
            />
          </Stack>
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
