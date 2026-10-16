import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeProvider from './ThemeProvider';
import { THEME_STORAGE_KEY, useTheme } from '../hooks/useTheme';

let media: MediaQueryList;
let onSystemChange: () => void;

function Controls() {
  const { theme, preference, setPreference } = useTheme();
  return <><span>{theme}:{preference}</span><button onClick={() => setPreference('light')}>Light</button><button onClick={() => setPreference('dark')}>Dark</button><button onClick={() => setPreference('system')}>System</button></>;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.head.innerHTML = '<meta name="theme-color" content="#0B1020" />';
  media = {
    matches: false,
    addEventListener: vi.fn((_event, listener) => { onSystemChange = listener; }),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList;
  window.matchMedia = vi.fn(() => media);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('MovieMatch appearance', () => {
  it('starts in Midnight Cinema and persists changes across remounts', () => {
    const view = render(<ThemeProvider><Controls /></ThemeProvider>);
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(view.getByText('Light'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#F6F7FB');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    view.unmount();
    const restored = render(<ThemeProvider><Controls /></ThemeProvider>);
    expect(restored.getByText('light:light')).toBeTruthy();
    fireEvent.click(restored.getByText('Dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('follows system changes only while System is selected and cleans up listeners', () => {
    const view = render(<ThemeProvider><Controls /></ThemeProvider>);
    fireEvent.click(view.getByText('System'));
    expect(view.getByText('light:system')).toBeTruthy();
    act(() => { Object.assign(media, { matches: true }); onSystemChange(); });
    expect(view.getByText('dark:system')).toBeTruthy();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    fireEvent.click(view.getByText('Light'));
    act(() => { Object.assign(media, { matches: false }); onSystemChange(); });
    act(() => { Object.assign(media, { matches: true }); onSystemChange(); });
    expect(view.getByText('light:light')).toBeTruthy();
    view.unmount();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', onSystemChange);
  });

  it('synchronizes an appearance change from another tab', () => {
    const view = render(<ThemeProvider><Controls /></ThemeProvider>);
    act(() => {
      localStorage.setItem(THEME_STORAGE_KEY, 'light');
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY, newValue: 'light' }));
    });
    expect(view.getByText('light:light')).toBeTruthy();
  });

  it('uses dark mode for invalid preferences and works when storage is unavailable', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'invalid');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    const view = render(<ThemeProvider><Controls /></ThemeProvider>);
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(view.getByText('Light'));
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
