'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import RiskDisclosure from './risk-disclosure';
import ThemeControl from './theme-control';
import styles from './trading-dashboard.module.css';

type Candle = { date: string; open: number; high: number; low: number; close: number };
type Dashboard = {
  name: string;
  admin: boolean;
  portfolio: { holdingsValue?: string | null; realizedPnl?: string | null; unrealizedPnl?: string | null };
  market: { symbol: string; source: string; candles: Candle[] } | null;
  activity: { id: string; event: string; createdAt: string }[];
};

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const labels: Record<string, string> = {
  SIGNED_IN: 'Signed in', SIGNED_OUT: 'Signed out', PASSWORD_RESET: 'Password reset',
  MFA_ENROLLED: 'Authenticator enrolled', SESSION_REVOKED: 'Session revoked',
};

function Chart({ candles }: { candles: Candle[] }) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!canvas || !candles.length) return;
    const target = canvas;
    function draw() {
      const context = target.getContext('2d');
      if (!context) return;
      const { width, height } = target.getBoundingClientRect();
      const ratio = window.devicePixelRatio;
      target.width = width * ratio;
      target.height = height * ratio;
      context.scale(ratio, ratio);
      const high = Math.max(...candles.map(candle => candle.high));
      const low = Math.min(...candles.map(candle => candle.low));
      const y = (value: number) => 20 + (height - 40) * (high - value) / (high - low || 1);
      const step = (width - 24) / candles.length;
      candles.forEach((candle, index) => {
        const x = 12 + step * (index + .5);
        const color = candle.close >= candle.open ? '#19d5a3' : '#ff626e';
        context.fillStyle = color;
        context.fillRect(x, y(candle.high), 1, Math.max(1, y(candle.low) - y(candle.high)));
        const body = Math.max(2, step * .62);
        context.fillRect(x - body / 2, y(Math.max(candle.open, candle.close)), body, Math.max(1, Math.abs(y(candle.open) - y(candle.close))));
      });
    }
    const observer = new ResizeObserver(draw);
    observer.observe(target);
    return () => observer.disconnect();
  }, [canvas, candles]);
  return <canvas ref={setCanvas} className={styles.canvas} role="img" aria-label="Historical daily candlesticks" />;
}

export default function TradingDashboard() {
  const [data, setData] = useState<Dashboard>();
  const [error, setError] = useState('');
  const [disclosure, setDisclosure] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/dashboard', { cache: 'no-store', signal: abort.signal }).then(async response => {
      if (response.status === 403) { setDisclosure(true); return; }
      if (response.status === 401) { setError('Sign in to open your dashboard.'); return; }
      if (!response.ok) throw new Error();
      setData(await response.json());
    }).catch(() => { if (!abort.signal.aborted) setError('Could not load your dashboard.'); });
    return () => abort.abort();
  }, []);

  if (disclosure) return <RiskDisclosure />;
  if (!data) return <main className="panel"><h1>Dashboard</h1><p role="status">{error || 'Loading dashboard…'}</p>
    {error && <Link href="/login">Sign in</Link>}</main>;

  const metrics = [
    ['Holdings value', data.portfolio.holdingsValue],
    ['Realized position P&L', data.portfolio.realizedPnl],
    ['Unrealized position P&L', data.portfolio.unrealizedPnl],
  ];
  const latest = data.market?.candles.at(-1);

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <strong>GnKAlgo</strong>
      <nav aria-label="Trading workspace">
        <Link href="/dashboard" aria-current="page">Dashboard</Link>
        <a href="#market-chart">Market chart</a>
        <Link href="/user/portfolio">Portfolio &amp; positions</Link>
        <Link href="/user/profile">Account &amp; security</Link>
        <Link href="/user/activity">Account activity</Link>
        <Link href="/agreements">Agreements</Link>
        {data.admin && <Link href="/admin">Admin console</Link>}
      </nav>
    </aside>
    <section className={styles.workspace} aria-labelledby="dashboard-title">
      <div className={styles.heading}>
        <div><h1 id="dashboard-title">Trading dashboard</h1><p>Welcome, {data.name}</p></div>
        <ThemeControl />
      </div>
      <dl className={styles.metrics}>
        {metrics.map(([label, value]) => <div key={label}><dt>{label}</dt>
          <dd>{value == null ? '—' : money.format(Number(value))}</dd></div>)}
      </dl>
      <div className={styles.marketRow}>
        <section id="market-chart" className={styles.card}>
          <h2>NIFTY 50 <small>Daily candles</small></h2>
          {data.market?.candles.length ? <><Chart candles={data.market.candles} /><p>{data.market.source} · through {latest?.date}</p></>
            : <div className={styles.chartEmpty}><p>Historical candles will appear when a market-data source is configured.</p></div>}
        </section>
        <section className={styles.card}><h2>Market overview</h2><dl className={styles.quote}>
          {['NIFTY 50', 'BANKNIFTY', 'SENSEX'].map((symbol, index) => <div key={symbol}><dt>{symbol}</dt>
            <dd>{index === 0 && latest ? latest.close.toLocaleString('en-IN') : '—'}</dd></div>)}
        </dl><p>{latest ? 'Last historical close' : 'Quotes unavailable'}</p></section>
      </div>
      <div className={styles.bottomRow}>
        <section className={styles.card}><h2>Risk monitor</h2><p>Risk metrics become available with position and exposure data.</p></section>
        <section className={styles.card}><h2>Strategy performance</h2><p>No strategy results available.</p></section>
        <section className={styles.card}><h2>Recent activity</h2>{data.activity.length ? <ul className={styles.events}>
          {data.activity.map(event => <li key={event.id}>{labels[event.event] ?? 'Account event'}
            <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time></li>)}
        </ul> : <p>No account activity recorded.</p>}<Link href="/user/activity">View account activity</Link></section>
      </div>
    </section>
  </main>;
}
