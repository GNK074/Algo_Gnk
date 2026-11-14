import "./globals.css";
import type { ReactNode } from 'react';
import SiteHeader from '../components/site-header';

export const metadata = { title: 'GNK Algo', description: 'GNK Algo account management' };

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: "try { var theme = localStorage.getItem('gnk-theme'); if (theme === 'light' || ['dark','carbon','royal'].includes(theme)) document.documentElement.dataset.theme = theme === 'dark' ? 'carbon' : theme; } catch {}" }} /></head>
    <body><SiteHeader />{children}</body>
  </html>;
}
