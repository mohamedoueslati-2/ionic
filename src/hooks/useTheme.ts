import { createContext, useContext } from 'react';

export type ThemePreference = 'dark' | 'light' | 'system';
export type Theme = 'dark' | 'light';
export const THEME_STORAGE_KEY = 'moviematch-theme';

export const ThemeContext = createContext<{
  preference: ThemePreference;
  theme: Theme;
  setPreference: (preference: ThemePreference) => void;
}>({ preference: 'dark', theme: 'dark', setPreference: () => {} });

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'system') return stored;
  } catch { /* Appearance still works when storage is unavailable. */ }
  return 'dark';
}

export const useTheme = () => useContext(ThemeContext);
