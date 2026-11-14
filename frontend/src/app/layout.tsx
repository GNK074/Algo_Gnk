import "./globals.css";
import type { ReactNode } from 'react';
import ThemeControl from '../components/theme-control';

export const metadata = { title: 'GNK Algo', description: 'GNK Algo account management' };

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: "try { var theme = localStorage.getItem('gnk-theme'); if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme; } catch {}" }} /></head>
    <body><aside className="theme-bar"><ThemeControl /></aside>{children}</body>
  </html>;
}
