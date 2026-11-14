'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Activity = { id: string; event: string; createdAt: string };

const labels: Record<string, string> = {
  SIGNED_IN: 'Signed in',
  SIGNED_OUT: 'Signed out',
  PASSWORD_RESET: 'Password reset',
  MFA_ENROLLED: 'Authenticator enrolled',
  SESSION_REVOKED: 'Session revoked',
};

export default function ActivityPage() {
  const [events, setEvents] = useState<Activity[]>();
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/auth/activity', { signal: controller.signal, cache: 'no-store' });
        if (response.status === 401) { window.location.replace('/login'); return; }
        if (!response.ok) throw new Error();
        setEvents(await response.json());
      } catch {
        if (!controller.signal.aborted) setError('Could not load account activity.');
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  return <main className="panel">
    <Link href="/dashboard">Dashboard</Link>
    <h1>Account activity</h1>
    {error ? <p role="alert">{error}</p> : !events ? <p role="status">Loading account activity...</p>
      : events.length === 0 ? <p>No activity recorded yet.</p>
      : <ul>{events.map(event => <li key={event.id}>
        {labels[event.event] ?? 'Account event'}{' '}
        <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
      </li>)}</ul>}
  </main>;
}
