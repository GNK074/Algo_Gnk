import Link from 'next/link';

export default function Contact() {
  return <main className="panel">
    <Link href="/">GNK Algo</Link>
    <h1>Contact Us</h1>
    <p>Public support contact details are currently unavailable.</p>
    <Link href="/legal/security">Read account security guidance</Link>
  </main>;
}
