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

const messages: Partial<Record<Portfolio['status'], string>> = {
  unavailable: 'Portfolio connectivity is unavailable.',
  unlinked: 'Your trading account has not been linked.',
  empty: 'No broker snapshots are available.',
  incomplete: 'Some broker snapshots are missing or stale.',
};

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const money = (value?: string | null) => value == null ? 'Unavailable' : inr.format(Number(value));

export default function PortfolioPage() {
  const [portfolio, setPortfolio] = useState<Portfolio>();
  const [error, setError] = useState('');

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
  }, []);

  return <main className="panel">
    <Link href="/dashboard">Dashboard</Link>
    <h1>Portfolio</h1>
    {error ? <p role="alert">{error}</p> : !portfolio ? <p role="status">Loading portfolio…</p> : <>
      {messages[portfolio.status] && <p role="status">{messages[portfolio.status]}</p>}
      {(portfolio.status === 'ready' || portfolio.status === 'incomplete') && <dl className="account-details">
        <div><dt>Holdings value</dt><dd>{money(portfolio.holdingsValue)}</dd></div>
        <div><dt>Realized position P&amp;L</dt><dd>{money(portfolio.realizedPnl)}</dd></div>
        <div><dt>Unrealized position P&amp;L</dt><dd>{money(portfolio.unrealizedPnl)}</dd></div>
        <div><dt>Oldest available broker snapshot</dt><dd>{portfolio.oldestSnapshotAt ?
          <time dateTime={portfolio.oldestSnapshotAt}>{new Date(portfolio.oldestSnapshotAt).toLocaleString()}</time> : 'Unavailable'}</dd></div>
      </dl>}
    </>}
  </main>;
}
