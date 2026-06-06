import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderProps = {
  readonly children: ReactNode;
  readonly defaultTheme?: Theme;
  readonly storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'dark',
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  storageKey = 'iptv-thunder-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored as Theme;
      }
    } catch (error) {
      console.error('Failed to read theme from localStorage:', error);
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = globalThis.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');
      const systemTheme = mediaQuery.matches ? 'dark' : 'light';

      root.classList.add(systemTheme);

      const handleChange = () => {
        const newSystemTheme = mediaQuery.matches ? 'dark' : 'light';
        root.classList.remove('light', 'dark');
        root.classList.add(newSystemTheme);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    root.classList.add(theme);
  }, [theme]);

  const setThemeHandler = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
    try {
      localStorage.setItem(storageKey, newTheme);
    } catch (error) {
      console.error('Failed to save theme to localStorage:', error);
    }
  }, [storageKey]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: setThemeHandler,
    }),
    [theme]
  );

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
