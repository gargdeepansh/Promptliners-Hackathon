export type ThemeMode = 'system' | 'dark' | 'light';

const THEME_KEY = 'sortie_theme_preference';

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem(THEME_KEY) as ThemeMode) || 'system';
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.removeItem(THEME_KEY);
  } else if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
    root.classList.add('dark');
    localStorage.setItem(THEME_KEY, 'dark');
  } else {
    root.setAttribute('data-theme', 'light');
    root.classList.remove('dark');
    localStorage.setItem(THEME_KEY, 'light');
  }
}

export function initThemeListener(): () => void {
  if (typeof window === 'undefined') return () => {};

  const current = getStoredTheme();
  applyTheme(current);

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (getStoredTheme() === 'system') {
      applyTheme('system');
    }
  };

  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}
