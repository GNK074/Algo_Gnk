'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import ThemeControl from './theme-control';

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  return <header className="site-header" onKeyDown={event => {
    if (event.key === 'Escape' && open) { close(); toggle.current?.focus(); }
  }}>
    <Link className="gnk-brand" href="/" aria-label="GNK Algo home" onClick={close}>
      <img src="/gnk-brand.jpg" alt="GNK Algo" />
    </Link>
    <button ref={toggle} type="button" className="nav-toggle secondary" aria-label={open ? 'Close navigation' : 'Open navigation'}
      aria-controls="site-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span aria-hidden="true">{open ? '\u00d7' : '\u2630'}</span>
    </button>
    <nav id="site-navigation" aria-label="Main navigation" className="site-nav" data-open={open}>
      <Link href="/" onClick={close}>Home</Link>
      <Link href="/#about" onClick={close}>About</Link>
      <Link className="nav-login" href="/login" onClick={close}>Log in</Link>
      <Link className="button nav-register" href="/register" onClick={close}>Create account</Link>
      <ThemeControl />
    </nav>
  </header>;
}
