import "./globals.css";
import type { ReactNode } from 'react';
import ThemeControl from '../components/theme-control';

export const metadata = { title: 'GNK Algo', description: 'GNK Algo account management' };

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: "try { var theme = localStorage.getItem('gnk-theme'); if (theme === 'light' || ['dark','carbon','royal'].includes(theme)) document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark'; } catch {}" }} /></head>
    <body><aside className="theme-bar"><a className="gnk-brand" href="/" aria-label="GNK Algo home"><img src="/gnk-brand.jpg" alt="GNK Algo" /></a><ThemeControl /></aside>{children}</body>
  </html>;
}
