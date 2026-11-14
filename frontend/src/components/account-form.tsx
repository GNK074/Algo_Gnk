'use client';

import { useState, type FormEvent } from 'react';

export default function AccountForm({ register = false }: { register?: boolean }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(register ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...Object.fromEntries(data),
          acceptTerms: data.has('acceptTerms'),
          acknowledgePrivacy: data.has('acknowledgePrivacy'),
          consentVersion: 'draft-2026-11-13',
        }),
      });
      const result = await response.json();
      setMessage(response.ok ? 'Check your inbox for an email verification link.' : result.message ?? 'Please try again.');
    } catch {
      setMessage('The account service is temporarily unavailable.');
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit}>
    {register && <>
      <label>First name<input name="firstName" autoComplete="given-name" maxLength={100} required /></label>
      <label>Last name<input name="lastName" autoComplete="family-name" maxLength={100} required /></label>
      <label>Mobile number<input name="mobile" type="tel" autoComplete="tel" placeholder="+919876543210" required /></label>
    </>}
    <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
    <label>Password<input name="password" type={visible ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 15 : undefined} maxLength={128} required /></label>
    <button type="button" className="secondary" onClick={() => setVisible(!visible)}>{visible ? 'Hide password' : 'Show password'}</button>
    {register && <>
      <label>Confirm password<input name="confirmPassword" type={visible ? 'text' : 'password'} autoComplete="new-password" minLength={15} maxLength={128} required /></label>
      <p>Use at least 15 characters. A long, unique passphrase works well.</p>
      <label className="check"><input type="checkbox" name="acceptTerms" required /> <span>I accept the draft <a href="/legal/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>.</span></label>
      <label className="check"><input type="checkbox" name="acknowledgePrivacy" required /> <span>I acknowledge the draft <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</span></label>
    </>}
    <button disabled={busy}>{register ? 'Create account' : 'Log in'}</button>
    <p role="status">{message}</p>
  </form>;
}
