import React, { createContext, useContext, useEffect, useState } from 'react';
import { ThemePreference, TrufosTheme, useAppSettings } from './AppSettingsContext';

export { TrufosTheme };

interface ThemeContextType {
  theme: TrufosTheme;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const getSystemTheme = (): TrufosTheme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? TrufosTheme.Dark : TrufosTheme.Light;

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, updateSettings } = useAppSettings();

  const [resolvedTheme, setResolvedTheme] = useState<TrufosTheme>(() =>
    settings.theme === 'system' ? getSystemTheme() : (settings.theme as TrufosTheme)
  );

  useEffect(() => {
    if (settings.theme !== 'system') {
      setResolvedTheme(settings.theme as TrufosTheme);
      return;
    }
    setResolvedTheme(getSystemTheme());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) =>
      setResolvedTheme(e.matches ? TrufosTheme.Dark : TrufosTheme.Light);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(TrufosTheme.Light, TrufosTheme.Dark);
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = (theme: ThemePreference) => updateSettings({ theme });
  const toggleTheme = () =>
    updateSettings({
      theme: resolvedTheme === TrufosTheme.Light ? TrufosTheme.Dark : TrufosTheme.Light,
    });

  return (
    <ThemeContext.Provider value={{ theme: resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
