'use client';

import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'carbon' | 'royal';

function normalize(value: string | null | undefined): Theme {
  if (value === 'dark') return 'carbon';
  return value === 'light' || value === 'carbon' || value === 'royal' ? value : 'system';
}

export default function ThemeControl() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const root = document.documentElement;
    setTheme(normalize(root.dataset.theme));
    function sync(event: StorageEvent) {
      if (event.key !== 'gnk-theme' && event.key !== null) return;
      const value = normalize(event.newValue);
      root.dataset.theme = value;
      setTheme(value);
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  return <label className="theme-select">
    <span>Theme</span>
    <select value={theme} onChange={event => {
      const value = normalize(event.target.value);
      document.documentElement.dataset.theme = value;
      setTheme(value);
      try { localStorage.setItem('gnk-theme', value); } catch {}
    }}>
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="carbon">Carbon Black</option>
      <option value="royal">Royal Blue</option>
    </select>
  </label>;
}
