'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Overview = {
  accounts: { total: number; enabled: number; disabled: number };
  services: { api: string; postgres: string };
};
type User = { id: string; email: string; firstName: string; lastName: string; disabledAt: string | null };
type Audit = { id: string; userId: string; event: string; createdAt: string };

async function getAdminData<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch('/api/admin/' + path, { cache: 'no-store', signal });
  if (response.status === 401) throw new Error('Sign in to continue.');
  if (response.status === 403) throw new Error('Administrator access is required.');
  if (!response.ok) throw new Error('Administration data is unavailable.');
  return response.json();
}

export default function AdminPage() {
  const [overview, setOverview] = useState<Overview>();
  const [audit, setAudit] = useState<Audit[]>([]);
  const [users, setUsers] = useState<User[]>();
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getAdminData<Overview>('overview', controller.signal),
      getAdminData<Audit[]>('audit', controller.signal),
    ]).then(([summary, events]) => {
      setOverview(summary);
      setAudit(events);
    }).catch(err => {
      if (!controller.signal.aborted) setError(err.message);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!overview) return;
    const controller = new AbortController();
    getAdminData<User[]>('users?q=' + encodeURIComponent(search), controller.signal)
      .then(setUsers)
      .catch(err => { if (!controller.signal.aborted) setSearchError(err.message); });
    return () => controller.abort();
  }, [overview, search]);

  return <main className="panel">
    <Link href="/dashboard">Dashboard</Link>
    <h1>Administration</h1>
    {error ? <p role="alert">{error}</p> : !overview ? <p role="status">Loading administration...</p> : <>
      <h2>Platform overview</h2>
      <p>{overview.accounts.total} registered, {overview.accounts.enabled} enabled, {overview.accounts.disabled} disabled</p>
      <p>API {overview.services.api} · PostgreSQL {overview.services.postgres}</p>
      <h2>Users</h2>
      <form onSubmit={event => {
        event.preventDefault();
        if (query.trim() === search) return;
        setSearchError('');
        setUsers(undefined);
        setSearch(query.trim());
      }}>
        <label>Email <input value={query} onChange={event => setQuery(event.target.value)} maxLength={254} /></label>
        <button type="submit">Search</button>
      </form>
      {searchError ? <p role="alert">{searchError}</p> : !users ? <p role="status">Loading users...</p>
        : !users.length ? <p>No users found.</p> : <ul>{users.map(user => <li key={user.id}>
          {user.firstName} {user.lastName} · {user.email} · {user.disabledAt ? 'Disabled' : 'Enabled'}
        </li>)}</ul>}
      <h2>Recent account activity</h2>
      {!audit.length ? <p>No activity recorded.</p> : <ul>{audit.map(event => <li key={event.id}>
        {event.event} · {event.userId} · <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
      </li>)}</ul>}
    </>}
  </main>;
}
