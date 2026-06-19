import { createContext, useContext, useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const COOKIE_NAME = 'vega_theme';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readThemeCookie(): Theme | null {
  const match = document.cookie.match(/(?:^|;\s*)vega_theme=(light|dark)\b/);
  return match ? (match[1] as Theme) : null;
}

function writeThemeCookie(theme: Theme) {
  document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

/**
 * Resolves the initial theme. The cookie is the source of truth and works for
 * logged-in and anonymous visitors alike. Light is the default when no cookie
 * is set. (The inline script in index.html applies the class before paint to
 * avoid a flash; this keeps React state in sync with it.)
 */
function getInitialTheme(): Theme {
  return readThemeCookie() ?? 'light';
}

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // Keep <html> class + cookie in sync whenever the theme changes.
  useEffect(() => {
    applyTheme(theme);
    writeThemeCookie(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
    []
  );

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
