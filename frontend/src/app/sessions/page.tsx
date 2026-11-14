'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Session = { id: string; createdAt: string; expiresAt: string; current: boolean };

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [message, setMessage] = useState('Loading sessions...');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/sessions', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (response.status === 401) { window.location.replace('/login'); return; }
        if (!response.ok) throw new Error();
        setSessions(await response.json());
        setMessage('');
      })
      .catch(() => { if (!controller.signal.aborted) setMessage('Could not load sessions.'); });
    return () => controller.abort();
  }, []);

  async function revoke(id: string) {
    setBusy(true);
    try {
      const response = await fetch('/api/auth/sessions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error();
      setSessions(previous => previous.filter(session => session.id !== id));
      setMessage('Session revoked.');
    } catch {
      setMessage('Could not revoke the session. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="panel">
    <Link href="/dashboard">Dashboard</Link>
    <h1>Active sessions</h1>
    <p role="status">{message}</p>
    <ul>{sessions.map(session => <li key={session.id}>
      <p>{session.current ? 'Current session' : 'Other session'}</p>
      <p>Started {new Date(session.createdAt).toLocaleString()}</p>
      <p>Expires {new Date(session.expiresAt).toLocaleString()}</p>
      {!session.current && <button disabled={busy} onClick={() => revoke(session.id)}>Revoke session</button>}
    </li>)}</ul>
  </main>;
}
