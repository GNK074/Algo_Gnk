import Link from 'next/link';
import Disclaimer from './disclaimer';

export default function Home() {
  return <>
    <header><Link href="/">GNK Algo</Link><nav><a href="#about">About</a><Link href="/login">Log in</Link><Link className="button" href="/register">Create account</Link></nav></header>
    <main>
      <section className="hero"><h1>Welcome to GNK Algo</h1><p>Manage your account and its security in one place.</p><Link className="button" href="/register">Create account</Link></section>
      <section id="about" className="cards">
        <article><h2>Account management</h2><p>Set up your GNK Algo account using your email address and mobile number.</p></article>
        <article><h2>Email verification</h2><p>Confirm ownership of your email address before accessing your account.</p></article>
        <article><h2>Authenticator security</h2><p>Protect access to your account with an authenticator app.</p></article>
      </section>
    </main>
    <footer><nav aria-label="Legal"><Link href="/legal/terms">Terms of Service</Link><Link href="/legal/privacy">Privacy Policy</Link><Link href="/legal/risk">Risk Disclaimer</Link><Link href="/legal/security">Security Awareness</Link><Link href="/legal/cookies">Cookie Notice</Link></nav></footer><Disclaimer />
  </>;
}
