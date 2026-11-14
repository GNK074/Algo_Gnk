'use client';

import { useEffect, useState } from 'react';

function normalize(value: string | null) {
  if (value === 'light') return 'light';
  if (value && ['dark', 'carbon', 'royal'].includes(value)) return 'dark';
}

export default function ThemeControl() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const root = document.documentElement;
    function sync() {
      setDark(root.dataset.theme ? root.dataset.theme === 'dark' : media.matches);
    }
    function storage(event: StorageEvent) {
      if (event.key !== 'gnk-theme' && event.key !== null) return;
      const theme = normalize(event.newValue);
      if (theme) root.dataset.theme = theme;
      else delete root.dataset.theme;
      sync();
    }
    sync();
    media.addEventListener('change', sync);
    window.addEventListener('storage', storage);
    return () => {
      media.removeEventListener('change', sync);
      window.removeEventListener('storage', storage);
    };
  }, []);

  function toggle() {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    setDark(!dark);
    try { localStorage.setItem('gnk-theme', next); } catch {}
  }

  return <button className="theme-toggle" type="button" onClick={toggle}
    aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
    <svg className="theme-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.9 13.3A9 9 0 0 1 10.7 3.1a9 9 0 1 0 10.2 10.2Z" /></svg>
    <svg className="theme-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg>
  </button>;
}
