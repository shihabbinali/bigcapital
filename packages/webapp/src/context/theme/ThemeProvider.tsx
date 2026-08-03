// @ts-nocheck
import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';

export const THEME_STORAGE_KEY = 'theme';

export interface AppThemeConfig {
  label: string;
  bpDark: boolean;
}

export interface AppThemes {
  light: AppThemeConfig;
  dark: AppThemeConfig;
}

export type AppThemeName = keyof AppThemes;

export const appThemes: AppThemes = {
  light: { label: 'Light', bpDark: false },
  dark: { label: 'Dark', bpDark: true },
};

export const APP_THEMES = appThemes;

export const defaultThemeName: AppThemeName = 'light';

const resolveInitialTheme = (): AppThemeName => {
  if (typeof window === 'undefined') return defaultThemeName;

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored && stored in appThemes) {
    return stored as AppThemeName;
  }
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return defaultThemeName;
};

/**
 * Applies the given theme to the document: sets `data-theme` on `<html>` and
 * toggles the Blueprint dark class on both `<html>` and `<body>` (so portal
 * components like dialogs/drawers/toasts inherit the theme).
 */
export const applyTheme = (theme: AppThemeName) => {
  if (typeof document === 'undefined') return;

  document.documentElement.dataset.theme = theme;

  const applyDark = appThemes[theme].bpDark;
  const elements = [document.documentElement, document.body];

  elements.forEach((el) => {
    if (applyDark) {
      el.classList.add('bp4-dark');
    } else {
      el.classList.remove('bp4-dark');
    }
  });
};

interface AppThemeContextValue {
  theme: AppThemeName;
  isDark: boolean;
  setTheme: (theme: AppThemeName) => void;
  toggleTheme: () => void;
}

const AppThemeContext = createContext<AppThemeContextValue>(
  {} as AppThemeContextValue,
);

interface AppThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Application theme provider.
 *
 * Resolves the initial theme (stored preference -> OS preference -> light) and
 * keeps the document (html/body classes + data-theme attribute) in sync.
 */
export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const [theme, setThemeState] = useState<AppThemeName>(resolveInitialTheme);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/payment')) {
      applyTheme('light');
      return;
    }
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme: AppThemeName) => {
    setThemeState(nextTheme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (_) {}
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch (_) {}
      return next;
    });
  }, []);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

export const useTheme = () => React.useContext(AppThemeContext);
