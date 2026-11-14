'use client';

import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'carbon' | 'royal';

function normalize(value: string | null | undefined): Theme {
  if (value === 'dark') return 'carbon';
  return value === 'light' || value === 'carbon' || value === 'royal' ? value : 'system';
}

export default function ThemeControl() {
  const [theme, setTheme] = useState<Theme>('system');

  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystem = () => setSystemDark(media.matches);
    syncSystem();
    media.addEventListener('change', syncSystem);
    setTheme(normalize(root.dataset.theme));
    function sync(event: StorageEvent) {
      if (event.key !== 'gnk-theme' && event.key !== null) return;
      const value = normalize(event.newValue);
      root.dataset.theme = value;
      setTheme(value);
    }
    window.addEventListener('storage', sync);
    return () => {
      media.removeEventListener('change', syncSystem);
      window.removeEventListener('storage', sync);
    };
  }, []);

  function select(value: Theme) {
    document.documentElement.dataset.theme = value;
    setTheme(value);
    try { localStorage.setItem('gnk-theme', value); } catch {}
  }

  const dark = theme === 'system' ? systemDark : theme !== 'light';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return <div className="theme-select">
    <button className="theme-shortcut" type="button" aria-label={label} title={label}
      onClick={() => select(dark ? 'light' : 'carbon')}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>
          : <path d="M20.9 13.3A9 9 0 0 1 10.7 3.1a9 9 0 1 0 10.2 10.2Z" />}
      </svg>
    </button>
    <select aria-label="Theme" value={theme} onChange={event => select(normalize(event.target.value))}>
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="carbon">Carbon Black</option>
      <option value="royal">Royal Blue</option>
    </select>
  </div>;
}
