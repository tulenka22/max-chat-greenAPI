// держим тему, вешаем класс light-theme на body и сохраняем выбор

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { loadStoredTheme, THEME_STORAGE_KEY, ThemeContext } from './themeContext';
import type { Theme } from './themeContext';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(loadStoredTheme);

  // Класс именно на <body>: переменные в .light-theme переопределяют :root.
  useEffect(() => {
    document.body.classList.toggle('light-theme', theme === 'light');
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Приватный режим — просто не сохраняем.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}