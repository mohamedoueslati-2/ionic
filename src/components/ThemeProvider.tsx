import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { readThemePreference, THEME_STORAGE_KEY, ThemeContext } from '../hooks/useTheme';
import type { ThemePreference } from '../hooks/useTheme';

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true);
  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media?.matches ?? true);
    media?.addEventListener('change', update);
    return () => media?.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0B1020' : '#F6F7FB');
    try { localStorage.setItem(THEME_STORAGE_KEY, preference); } catch { /* Storage is optional. */ }
  }, [preference, theme]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) setPreference(readThemePreference());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  return <ThemeContext.Provider value={{ preference, theme, setPreference }}>{children}</ThemeContext.Provider>;
}
