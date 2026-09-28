// контекст темы, вынесен отдельно от провайдера ради fast refresh
// тот же приём, что в chatContext.ts

import { createContext, useContext } from 'react';

export type Theme = 'dark' | 'light';

export interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

export const THEME_STORAGE_KEY = 'max-theme';

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme можно вызывать только внутри <ThemeProvider>.');
  return context;
}

// читаем тему из localStorage, дефолт тёмная
export function loadStoredTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === 'light' || value === 'dark') return value;
  } catch {
    // Приватный режим — остаёмся в тёмной теме.
  }
  return 'dark';
}