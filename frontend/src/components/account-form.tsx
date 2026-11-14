'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';

export default function AccountForm({ register = false }: { register?: boolean }) {
  const [message, setMessage] = useState('');
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mfa, setMfa] = useState<{ challenge: string; secret: string | null }>();
  const [recovery, setRecovery] = useState<string[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [qr, setQr] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const success = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (recovery.length && success.current && !success.current.open) success.current.showModal();
  }, [recovery]);

  useEffect(() => {
    if (!signedIn || recovery.length) return;
    const timer = window.setTimeout(() => window.location.replace('/risk-disclosure'), 1500);
    return () => window.clearTimeout(timer);
  }, [signedIn, recovery]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(mfa ? '/api/auth/mfa' : register ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...Object.fromEntries(data),
          challenge: mfa?.challenge,
          acceptTerms: data.has('acceptTerms'),
          acknowledgePrivacy: data.has('acknowledgePrivacy'),
          consentVersion: 'draft-2026-11-13',
        }),
      });
      const result = await response.json();
      if (response.ok && register && result.status === 'verification_required') {
        setRegistered(true);
      } else if (response.ok && result.status === 'mfa_required') {
        setMfa({ challenge: result.challenge, secret: result.secret });
        setUseRecovery(false);
        setQr('');
        if (result.secret) {
          const label = encodeURIComponent('GNK Algo:' + String(data.get('email')).trim().toLowerCase());
          const uri = 'otpauth://totp/' + label + '?issuer=GNK%20Algo&secret=' + encodeURIComponent(result.secret);
          try { setQr(await QRCode.toDataURL(uri, { width: 240, margin: 4 })); }
          catch { setMessage('QR code unavailable. Enter the setup key manually.'); }
        }
      } else if (response.ok && result.status === 'signed_in') {
        setMfa(undefined);
        setRecovery(result.recovery);
        setSignedIn(true);
      } else {
        setMessage(response.ok ? 'Check your inbox for an email verification link.' : result.message ?? 'Please try again.');
      }
    } catch {
      setMessage('The account service is temporarily unavailable.');
    } finally {
      setBusy(false);
    }
  }

  if (registered) return <section>
    <h2>Your account has been successfully created!</h2>
    <p>Email Verification Required <strong>Pending</strong></p>
    <p>Open the secure link sent to your registered email address to activate your GNK ALGO account.</p>
    <p>Thank you for joining GNK ALGO!</p>
    <Link className="button" href="/resend-verification"><span aria-hidden="true">&#9993;</span> Verify Your GNK ALGO Email</Link>
    <p>The verification page lets you request another email if needed.</p>
  </section>;

  if (signedIn) return <section>
    <h2 role="status">Login Successful!</h2>
    {recovery.length > 0 && <dialog className="panel" ref={success} aria-labelledby="mfa-success" onClose={() => setRecovery([])}><h2 id="mfa-success">Multi-factor authentication enabled</h2><p>Save these one-time recovery codes securely.</p>
      <ul>{recovery.map(code => <li key={code}><code>{code}</code></li>)}</ul><form method="dialog"><button>Done</button></form></dialog>}
    <p role="status">{message}</p>
  </section>;

  if (mfa) return <form onSubmit={submit}>
    {qr && <img src={qr} width={240} height={240} alt="Scan this QR code with your authenticator app" />}
    {mfa.secret && <p>Add this key to your authenticator as a time-based account: <code>{mfa.secret}</code></p>}
    <label>{useRecovery ? 'Recovery code' : 'Six-digit authenticator code'}
      <input name="code" autoComplete="one-time-code" key={String(useRecovery)} inputMode={useRecovery ? "text" : "numeric"} pattern={useRecovery ? "[a-fA-F0-9]{32}" : "[0-9]{6}"} maxLength={useRecovery ? 32 : 6} required />
    </label>
    <button disabled={busy}>Verify</button>
    {!mfa.secret && <button disabled={busy} type="button" className="secondary" onClick={() => setUseRecovery(!useRecovery)}>{useRecovery ? "Use authenticator code" : "Use a recovery code"}</button>}
    <button type="button" className="secondary" onClick={() => { setMfa(undefined); setMessage(''); }}>Back to login</button>
    <p role="status">{message}</p>
  </form>;

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
