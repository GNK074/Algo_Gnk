'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

export default function Disclaimer() {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!dialog.current) return;
      try { if (sessionStorage.getItem('gnk-disclaimer-seen')) return; } catch {}
      dialog.current.showModal();
      try { sessionStorage.setItem('gnk-disclaimer-seen', '1'); } catch {}
    }, 5000);
    return () => window.clearTimeout(timer);
  }, []);

  return <dialog ref={dialog} aria-labelledby="disclaimer-title" className="panel risk-disclosure">
        <div className="risk-heading">
      <span aria-hidden="true" className="risk-icon">&#9888;</span>
      <h2 id="disclaimer-title">Trade Responsibly in Futures &amp; Options</h2>
    </div>
    <div className="risk-content" tabIndex={0} role="region" aria-label="Derivatives risk disclosures">
      <h3>Risk Disclosures on Derivatives</h3>
      <p>SEBI study findings for FY 2021–22</p>
      <ul>
        <li>About 9 in 10 individual equity F&amp;O traders incurred net losses.</li>
        <li>Loss-making traders averaged close to &#8377;50,000 in net trading losses.</li>
        <li>They paid an additional 28% of their net trading losses in transaction costs.</li>
        <li>Profitable traders incurred transaction costs equivalent to 15% to 50% of their net trading profits.</li>
      </ul>
      <hr />
      <h3>SEBI presents “Samajh Se Investing Simple”</h3>
      <ul>
        <li>Understand Before You Invest.</li>
        <li>Choose Regulated Investment Products.</li>
        <li>Start Early, Stay Invested.</li>
        <li>Beware of Investment Frauds.</li>
      </ul>
      <p><a href="https://www.sebi.gov.in/sebi_data/attachdocs/jan-2023/1674645296493.pdf" target="_blank" rel="noreferrer">Source: SEBI study, January 25, 2023 (PDF)</a></p>
    </div>
    <h3>About GNK Algo</h3>
    <p>GNK Algo is currently a technology platform providing account registration, authentication, security management and account-related services.</p>
    <p>The current application does not provide live trading, paper trading, investment recommendations, brokerage execution or guaranteed financial returns.</p>
    <p>Financial markets involve risks, including potential loss of capital. Creating a GNK Algo account does not activate any trading service.</p>
    <p>Please review our Terms of Service, Privacy Policy and Risk Disclaimer before continuing.</p>
    <form method="dialog">
      <button autoFocus>I understand — continue to GNK Algo</button>
      <Link href="/legal/risk" onClick={() => dialog.current?.close()}>Read Full Disclaimer</Link>
      <button className="secondary">Close</button>
    </form>
  </dialog>;
}
