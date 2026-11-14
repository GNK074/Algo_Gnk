'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AgreementAdmin from './admin';

type Version = { id: string; title: string; version: number; format: 'text' | 'pdf'; sha256: string };
type History = { id: string; versionId: string; acceptedAt: string; sha256: string; version: { title: string } };
type Agreements = { admin: boolean; versions: Version[]; accepted: History[] };

export default function AgreementPage() {
  const [data, setData] = useState<Agreements>();
  const [preview, setPreview] = useState<string>();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function refresh() {
    const response = await fetch('/api/agreements', { cache: 'no-store' });
    if (!response.ok) throw new Error('Log in to view your agreements.');
    setData(await response.json());
  }
  useEffect(() => { void refresh().catch(error => setMessage(error.message)); }, []);

  async function accept(version: Version) {
    setBusy(true);
    try {
      const response = await fetch('/api/agreements/' + version.id + '/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: checked, sha256: version.sha256 }),
      });
      if (!response.ok) throw new Error('Could not accept this agreement. Refresh and try again.');
      const result = await response.json();
      setMessage(result.emailSent ? 'Agreement accepted and confirmation sent.' :
        'Agreement recorded. Download your copy below.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not complete request.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function openPreview(version: Version) {
    try {
      const response = await fetch('/api/agreements/' + version.id + '/source');
      if (!response.ok) throw new Error();
      const bytes = await response.arrayBuffer();
      setPreview(URL.createObjectURL(new Blob([bytes], {
        type: version.format === 'pdf' ? 'application/pdf' : 'text/plain;charset=utf-8',
      })));
    } catch {
      setMessage('Could not load the agreement preview.');
    }
  }

  async function resend(id: string) {
    setBusy(true);
    try {
      const response = await fetch('/api/agreements/' + id + '/resend-email', { method: 'POST' });
      const result = await response.json();
      setMessage(response.ok && result.emailSent ? 'Confirmation sent.' : result.message ?? 'Email could not be sent.');
    } catch {
      setMessage('Email could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  const current = data?.versions[0];
  return <main className="panel">
    <Link href="/dashboard">Dashboard</Link>
    <h1>My Agreements</h1>{data?.admin && <AgreementAdmin onPublish={refresh} />}
    {data && !current && <p>No agreement is currently published.</p>}
    {current && <section>
      <h2>{current.title}</h2>
      <p>Version {current.version}</p>
      <a href={'/api/agreements/' + current.id + '/source'}>Download and read agreement</a><p><button onClick={() => openPreview(current)}>Preview agreement</button></p>{preview && <iframe title="Agreement preview" sandbox="" src={preview} width="100%" height="480" />}
      {!data?.accepted.some(item => item.versionId === current.id) && <form onSubmit={event => {
        event.preventDefault();
        if (checked) void accept(current);
      }}>
        <label className="check"><input type="checkbox" required checked={checked} onChange={event => setChecked(event.target.checked)} /> I confirm that I have read and agree to this version of the agreement.</label>
        <button disabled={!checked || busy}>Accept agreement</button>
      </form>}
    </section>}
    <p role="status">{message}</p>
    {data?.accepted.map(item => <p key={item.id}>
      <a href={'/api/agreements/' + item.id + '/download'}>Download {item.version.title}</a>
      {' accepted ' + new Date(item.acceptedAt).toLocaleDateString()} <button disabled={busy} onClick={() => resend(item.id)}>Resend email</button>
    </p>)}
  </main>;
}
