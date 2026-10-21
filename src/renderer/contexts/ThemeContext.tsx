import React, { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { TrufosTheme } from 'shim/app-settings';
import { selectThemePreference, useAppSettingsStore } from '@/state/appSettingsStore';

export { TrufosTheme };

interface ThemeContextType {
  theme: TrufosTheme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

const subscribeToSystemTheme = (onChange: () => void) => {
  const mq = window.matchMedia(DARK_SCHEME_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};

const getSystemTheme = (): TrufosTheme =>
  window.matchMedia(DARK_SCHEME_QUERY).matches ? TrufosTheme.Dark : TrufosTheme.Light;

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const themePreference = useAppSettingsStore(selectThemePreference);
  const systemTheme = useSyncExternalStore(subscribeToSystemTheme, getSystemTheme);
  const theme = themePreference === 'system' ? systemTheme : themePreference;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(TrufosTheme.Light, TrufosTheme.Dark);
    root.classList.add(theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>;
};
