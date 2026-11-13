'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

export default function Disclaimer() {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!dialog.current || sessionStorage.getItem('gnk-disclaimer-seen')) return;
      dialog.current.showModal();
      sessionStorage.setItem('gnk-disclaimer-seen', '1');
    }, 5000);
    return () => window.clearTimeout(timer);
  }, []);

  return <dialog ref={dialog} aria-labelledby="disclaimer-title" className="panel">
    <h2 id="disclaimer-title">Important Disclaimer</h2>
    <p>GNK Algo is currently a technology platform providing account registration, authentication, security management and account-related services.</p>
    <p>The current application does not provide live trading, paper trading, investment recommendations, brokerage execution or guaranteed financial returns.</p>
    <p>Financial markets involve risks, including potential loss of capital. Creating a GNK Algo account does not activate any trading service.</p>
    <p>Please review our Terms of Service, Privacy Policy and Risk Disclaimer before continuing.</p>
    <form method="dialog">
      <button autoFocus>I Understand</button>
      <Link href="/legal/risk" onClick={() => dialog.current?.close()}>Read Full Disclaimer</Link>
      <button className="secondary">Close</button>
    </form>
  </dialog>;
}
