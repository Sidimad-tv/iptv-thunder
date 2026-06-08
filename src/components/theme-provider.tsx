import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Theme = 'dark' | 'light' | 'system';
type ThemePreset = 'oled' | 'ocean' | 'classic';

type ThemeProviderProps = {
  readonly children: ReactNode;
  readonly defaultTheme?: Theme;
  readonly storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themePreset: ThemePreset;
  setThemePreset: (preset: ThemePreset) => void;
};

const initialState: ThemeProviderState = {
  theme: 'dark',
  setTheme: () => null,
  themePreset: 'oled',
  setThemePreset: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);
const PRESET_STORAGE_KEY = 'iptv-thunder-theme-preset';

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  storageKey = 'iptv-thunder-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored as Theme;
    } catch {}
    return defaultTheme;
  });

  const [themePreset, setThemePresetState] = useState<ThemePreset>(() => {
    try {
      const stored = localStorage.getItem(PRESET_STORAGE_KEY);
      if (stored === 'oled' || stored === 'ocean' || stored === 'classic') return stored as ThemePreset;
    } catch {}
    return 'oled';
  });

  useEffect(() => {
    const root = globalThis.document.documentElement;
    root.classList.remove('light', 'dark', 'theme-oled', 'theme-ocean', 'theme-classic');

    if (theme === 'system') {
      const mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');
      const sys = mediaQuery.matches ? 'dark' : 'light';
      root.classList.add(sys, `theme-${themePreset}`);
      const handleChange = () => {
        root.classList.remove('light', 'dark', 'theme-oled', 'theme-ocean', 'theme-classic');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light', `theme-${themePreset}`);
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    root.classList.add(theme, `theme-${themePreset}`);
  }, [theme, themePreset]);

  const setThemeHandler = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
    try { localStorage.setItem(storageKey, newTheme); } catch {}
  }, [storageKey]);

  const setThemePresetHandler = useCallback((preset: ThemePreset) => {
    setThemePresetState(preset);
    try { localStorage.setItem(PRESET_STORAGE_KEY, preset); } catch {}
  }, []);

  const value = useMemo(() => ({ theme, setTheme: setThemeHandler, themePreset, setThemePreset: setThemePresetHandler }), [theme, themePreset, setThemeHandler, setThemePresetHandler]);

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
