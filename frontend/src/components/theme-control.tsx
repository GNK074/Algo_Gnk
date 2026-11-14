'use client';

import { useEffect, useState } from 'react';

const choices = ['system', 'light', 'carbon', 'royal'] as const;
type Theme = typeof choices[number];

export default function ThemeControl() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const saved = document.documentElement.dataset.theme;
    if (saved === 'light' || saved === 'carbon' || saved === 'royal') setTheme(saved);
  }, []);

  function change(value: Theme) {
    setTheme(value);
    document.documentElement.dataset.theme = value;
    try { localStorage.setItem('gnk-theme', value); } catch {}
  }

  return <label className="theme-control">
    Theme
    <select value={theme} onChange={event => change(event.target.value as Theme)}>
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="carbon">Carbon Black</option><option value="royal">Royal Blue</option>
    </select>
  </label>;
}
