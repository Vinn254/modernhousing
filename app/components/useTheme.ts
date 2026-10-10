'use client';

import { useCallback, useEffect, useState } from 'react';
import { applyTheme, getStoredTheme, setStoredTheme, type Theme } from '../../lib/theme';

/**
 * Single source of truth for dark mode across every authenticated page.
 * Reads/writes one localStorage key ('theme') and reflects it on <html data-theme>,
 * so the toggle in the app header and any in-page toggle stay in sync.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    setStoredTheme(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      setStoredTheme(next);
      return next;
    });
  }, []);

  return { theme, isDark: theme === 'dark', setTheme, toggle };
}

export default useTheme;
