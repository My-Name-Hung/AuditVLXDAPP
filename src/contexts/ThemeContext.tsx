import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DARK_MODE_KEY = 'dark_mode_enabled';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: (value: boolean) => Promise<void>;
  colors: {
    text: string;
    background: string;
    tint: string;
    icon: string;
    tabIconDefault: string;
    tabIconSelected: string;
    primary: string;
    secondary: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    loadDarkModePreference();
  }, []);

  // Listen for dark mode changes
  useEffect(() => {
    const interval = setInterval(() => {
      AsyncStorage.getItem(DARK_MODE_KEY).then((saved) => {
        setIsDarkMode(saved === 'true');
      });
    }, 500); // Check every 500ms

    return () => clearInterval(interval);
  }, []);

  const loadDarkModePreference = async () => {
    try {
      const saved = await AsyncStorage.getItem(DARK_MODE_KEY);
      setIsDarkMode(saved === 'true');
    } catch (error) {
      console.error('Error loading dark mode preference:', error);
    }
  };

  const toggleDarkMode = async (value: boolean) => {
    try {
      setIsDarkMode(value);
      await AsyncStorage.setItem(DARK_MODE_KEY, value ? 'true' : 'false');
    } catch (error) {
      console.error('Error saving dark mode preference:', error);
    }
  };

  const { Colors } = require('../constants/theme');
  const colors = isDarkMode ? Colors.dark : Colors.light;

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

