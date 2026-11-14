'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Portfolio = {
  status: 'unavailable' | 'unlinked' | 'empty' | 'ready' | 'incomplete';
  holdingsValue?: string | null;
  realizedPnl?: string | null;
  unrealizedPnl?: string | null;
  oldestSnapshotAt?: string | null;
};

const messages: Record<Portfolio['status'], string> = {
  unavailable: 'No portfolio data source is configured.',
  unlinked: 'Your account has no linked trading profile.',
  empty: 'Your first broker snapshot will appear here when available.',
  incomplete: 'Some broker snapshots are missing or stale.',
  ready: 'Showing the latest available broker snapshots.',
};

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const money = (value?: string | null) => value == null ? '—' : inr.format(Number(value));

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<Portfolio>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/portfolio/summary', { cache: 'no-store', signal: controller.signal });
        if (response.status === 401) { window.location.replace('/login'); return; }
        if (response.status === 403) { window.location.replace('/risk-disclosure'); return; }
        if (!response.ok) throw new Error();
        setPortfolio(await response.json());
      } catch {
        if (!controller.signal.aborted) setError('Could not load portfolio data.');
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);

  function retry() {
    setError('');
    setPortfolio(undefined);
    setAttempt(previous => previous + 1);
  }

  const loading = !portfolio && !error;

  return <main className="account-workspace">
    <aside className="account-sidebar">
      <nav aria-label="Account">
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/user/portfolio" aria-current="page">Portfolio</Link>
        <Link href="/user/profile">Profile</Link>
        <Link href="/user/sessions">Sessions</Link>
        <Link href="/user/activity">Account activity</Link>
      </nav>
    </aside>
    <section className="account-content portfolio-view" aria-labelledby="portfolio-heading">
      <div className="portfolio-heading">
        <div>
          <h1 id="portfolio-heading">Portfolio</h1>
          <p>Holdings and position P&amp;L</p>
        </div>
        <button type="button" className="secondary" onClick={retry} disabled={loading}>Refresh</button>
      </div>

      <dl className="account-details portfolio-metrics" aria-busy={loading}>
        <div><dt>Holdings value</dt><dd>{money(portfolio?.holdingsValue)}</dd></div>
        <div><dt>Realized position P&amp;L</dt><dd>{money(portfolio?.realizedPnl)}</dd></div>
        <div><dt>Unrealized position P&amp;L</dt><dd>{money(portfolio?.unrealizedPnl)}</dd></div>
      </dl>

      <section className="portfolio-status" aria-labelledby="portfolio-data">
        <h2 id="portfolio-data">Broker snapshots</h2>
        {error ? <p role="alert">{error} Use Refresh to try again.</p>
          : <p role="status">{portfolio ? messages[portfolio.status] : 'Loading portfolio…'}</p>}
        {portfolio?.oldestSnapshotAt && <p>Oldest available snapshot{' '}
          <time dateTime={portfolio.oldestSnapshotAt}>{new Date(portfolio.oldestSnapshotAt).toLocaleString()}</time>
        </p>}
      </section>
    </section>
  </main>;
}
