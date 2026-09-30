'use client';

import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';
import { Moon, Sun } from 'lucide-react';

type Theme = 'system' | 'light' | 'dark';
const storageKey = 'aulify.theme';
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({
  theme: 'system',
  setTheme: () => {},
});

function readPreference(): Theme {
  const value = document.documentElement.dataset.themePreference;
  return value === 'light' || value === 'dark' ? value : 'system';
}

function applyTheme(preference: Theme) {
  const dark =
    preference === 'dark' ||
    (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.themePreference = preference;
  window.dispatchEvent(new Event('aulify:theme'));
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystem = () => {
    if (readPreference() === 'system') applyTheme('system');
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) {
      applyTheme(
        event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : 'system',
      );
    }
  };
  media.addEventListener('change', onSystem);
  window.addEventListener('storage', onStorage);
  window.addEventListener('aulify:theme', onChange);
  return () => {
    media.removeEventListener('change', onSystem);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('aulify:theme', onChange);
  };
}
const serverSnapshot = (): Theme => 'system';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readPreference, serverSnapshot);
  const setTheme = useCallback((preference: Theme) => {
    try {
      localStorage.setItem(storageKey, preference);
    } catch {
      /* Keep this session usable. */
    }
    const update = () => flushSync(() => applyTheme(preference));
    if (
      document.startViewTransition &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      document.documentElement.dataset.themeTransition = 'circle';
      const transition = document.startViewTransition(update);
      void transition.finished
        .catch(() => {})
        .finally(() => {
          delete document.documentElement.dataset.themeTransition;
        });
    } else update();
  }, []);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

function resolvedSnapshot(): 'dark' | 'light' {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}
const serverResolvedSnapshot = (): 'light' => 'light';

export function useResolvedTheme() {
  return useSyncExternalStore(subscribe, resolvedSnapshot, serverResolvedSnapshot);
}

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { setTheme } = useTheme();
  const dark = useResolvedTheme() === 'dark';
  const label = dark ? 'Tema claro' : 'Tema oscuro';
  return (
    <button
      className={`theme-switcher${compact ? ' compact' : ''}`}
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
    </button>
  );
}
