import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Colors } from '../constants/theme';

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

  const loadDarkModePreference = () => {
    try {
      const saved = localStorage.getItem(DARK_MODE_KEY);
      setIsDarkMode(saved === 'true');
    } catch (error) {
      console.error('Error loading dark mode preference:', error);
    }
  };

  const toggleDarkMode = async (value: boolean) => {
    try {
      setIsDarkMode(value);
      localStorage.setItem(DARK_MODE_KEY, value ? 'true' : 'false');
    } catch (error) {
      console.error('Error saving dark mode preference:', error);
    }
  };

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

