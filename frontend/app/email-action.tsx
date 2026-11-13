'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

const actions = {
  'verify-email': 'Verify email',
  'reset-password': 'Update password',
  'forgot-password': 'Send password reset link',
  'resend-verification': 'Resend verification email',
};

type Action = keyof typeof actions;

export default function EmailAction({ action }: { action: Action }) {
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const redeem = action === 'verify-email' || action === 'reset-password';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    try {
      const response = await fetch('/api/auth/' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, token: redeem ? window.location.hash.slice(1) : undefined }),
      });
      if (!response.ok) {
        const result = await response.json();
        setMessage(typeof result.message === 'string' ? result.message : 'Please try again.');
        return;
      }
      if (redeem) {
        window.history.replaceState(null, '', window.location.pathname);
        setDone(true);
      }
      setMessage(action === 'verify-email' ? 'Email verified. You can now log in.' :
        action === 'reset-password' ? 'Your password has been updated. Please log in using your new password.' :
        'If an eligible account matches, check your inbox for a link.');
    } catch {
      setMessage('The account service is temporarily unavailable.');
    } finally {
      setPending(false);
    }
  }

  return <main className="panel">
    <Link href="/">GNK Algo</Link><h1>{actions[action]}</h1>
    {!done && <form onSubmit={submit}>
      {!redeem && <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>}
      {action === 'reset-password' && <>
        <label>New password<input name="password" type="password" autoComplete="new-password" minLength={15} maxLength={128} required /></label>
        <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={15} maxLength={128} required /></label>
      </>}
      <button disabled={pending}>{actions[action]}</button>
    </form>}
    <p role="status">{message}</p>
    <Link href="/login">Back to login</Link>
  </main>;
}
