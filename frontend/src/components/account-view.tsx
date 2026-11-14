'use client';

import Link from 'next/link';
import RiskDisclosure from './risk-disclosure';
import { useEffect, useState } from 'react';

type Account = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  createdAt: string;
  emailVerifiedAt: string | null;
};

export default function AccountView({ profile = false }: { profile?: boolean }) {
  const [needsDisclosure, setNeedsDisclosure] = useState(false);
  const [account, setAccount] = useState<Account>();
  const [message, setMessage] = useState('Checking your session...');
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store', signal: controller.signal });
        if (response.status === 403) { setNeedsDisclosure(true); setMessage(''); return; }
        if (response.status === 401) { setMessage('Your session has ended. Please log in.'); return; }
        if (!response.ok) throw new Error();
        setAccount(await response.json());
        setMessage('');
      } catch {
        if (!controller.signal.aborted) setMessage('The account service is unavailable.');
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  async function logout() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      window.location.replace('/login');
    } catch {
      setMessage('Sign-out failed. Try again.');
    }
  }

  if (needsDisclosure) return <RiskDisclosure />;

  return <main className="panel">
    <Link href="/">GNK Algo</Link>
    <h1>{profile ? 'Profile' : 'Dashboard'}</h1>
    {account ? <>
      <nav aria-label="Account"><Link href="/dashboard">Dashboard</Link><Link href="/profile">Profile</Link><Link href="/sessions">Sessions</Link><button onClick={logout}>Sign out</button></nav>
      <h2>{profile ? account.firstName + ' ' + account.lastName : 'Welcome, ' + account.firstName}</h2>
      <dl>
        <dt>Email</dt><dd>{account.email}</dd>
        <dt>Email status</dt><dd>{account.emailVerifiedAt ? 'Verified' : 'Pending verification'}</dd>
        {profile && <><dt>User ID</dt><dd>{account.id}</dd><dt>Mobile</dt><dd>{account.mobile}</dd>
          <dt>Member since</dt><dd>{new Date(account.createdAt).toLocaleDateString()}</dd></>}
      </dl>
      <Link href="/legal/security">Security awareness</Link>
    </> : <Link href="/login">Log in</Link>}
    <p role="status">{message}</p>
  </main>;
}
