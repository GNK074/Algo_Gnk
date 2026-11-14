'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';

type Disclosure = { version: string; introduction: string; points: string[] };

export default function RiskDisclosure() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [disclosure, setDisclosure] = useState<Disclosure>();
  const [message, setMessage] = useState('Loading disclosure...');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
    fetch('/api/auth/risk-disclosure', { cache: 'no-store' }).then(async response => {
      if (response.status === 401) { window.location.replace('/login'); return; }
      if (!response.ok) throw new Error();
      const current = await response.json();
      if (current.accepted) { window.location.replace('/dashboard'); return; }
      setDisclosure(current);
      setMessage('');
    }).catch(() => setMessage('The disclosure is temporarily unavailable.'));
  }, []);

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disclosure) return;
    const accepted = new FormData(event.currentTarget).has('accepted');
    setBusy(true);
    try {
      const response = await fetch('/api/auth/risk-disclosure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: disclosure.version, accepted }),
      });
      if (response.status === 401) { window.location.replace('/login'); return; }
      if (!response.ok) throw new Error();
      window.location.replace('/dashboard');
    } catch {
      setMessage('Could not save acknowledgment. Reload the page and try again.');
    } finally {
      setBusy(false);
    }
  }

  return <dialog ref={dialog} className="panel" aria-labelledby="risk-disclosure-title" onCancel={() => window.location.replace('/')}>
    <h1 id="risk-disclosure-title">Risk Disclosure &amp; Trading Disclaimer</h1>
    {disclosure && <>
      <p>Version {disclosure.version}</p>
      <p>{disclosure.introduction}</p>
      <ul>{disclosure.points.map(point => <li key={point}>{point}</li>)}</ul>
      <p>GNK ALGO provides account and security tools. Trading services are unavailable.</p>
      <form onSubmit={accept}>
        <label className="check"><input name="accepted" type="checkbox" required /> I have read and understood the Risk Disclosure. I acknowledge and accept the risks associated with trading in financial markets.</label>
        <button disabled={busy}>Accept &amp; Continue</button>
      </form>
    </>}
    <p role="status">{message}</p>
    <Link href="/">Return to homepage</Link>
  </dialog>;
}
