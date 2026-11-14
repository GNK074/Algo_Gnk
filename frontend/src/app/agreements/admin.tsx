'use client';

import { useState, type FormEvent } from 'react';

type History = {
  versions: { id: string; title: string; version: number; publishedAt: string | null; archivedAt: string | null }[];
  accepted: { id: string; acceptedAt: string; user: { email: string } }[];
};

export default function AgreementAdmin({ onPublish }: { onPublish: () => Promise<void> }) {
  const [history, setHistory] = useState<History>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function request(path: string, options?: RequestInit) {
    const response = await fetch('/api/agreements/admin/' + path, { cache: 'no-store', ...options });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Request failed.');
    return result;
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Request failed.'); }
    finally { setBusy(false); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const file = fields.get('pdf');
    await run(async () => {
      let format = 'text';
      let content = String(fields.get('content') ?? '');
      if (file instanceof File && file.size) {
        if (file.size > 45000) throw new Error('PDF must be 45 KB or smaller.');
        format = 'pdf';
        content = btoa(Array.from(new Uint8Array(await file.arrayBuffer()), byte => String.fromCharCode(byte)).join(''));
      }
      await request('create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: fields.get('title'), format, content }),
      });
      setHistory(await request('history'));
      setMessage('Draft created.');
    });
  }

  return <details><summary>Agreement administration</summary>
    <form onSubmit={create}>
      <label>Title<input name="title" required maxLength={200} /></label>
      <label>Agreement text<textarea name="content" rows={8} maxLength={60000} /></label>
      <label>PDF instead of text<input name="pdf" type="file" accept="application/pdf" /></label>
      <button disabled={busy}>Create draft</button>
    </form>
    <button disabled={busy} onClick={() => run(async () => setHistory(await request('history')))}>Load versions and acceptance history</button>
    {history?.versions.map(version => <p key={version.id}>
      {version.title} v{version.version} ({version.archivedAt ? 'Archived' : version.publishedAt ? 'Published' : 'Draft'})
      {!version.publishedAt && <button disabled={busy} onClick={() => run(async () => {
        await request(version.id + '/publish', { method: 'POST' });
        setHistory(await request('history'));
        await onPublish();
      })}>Publish</button>}
    </p>)}
    {history?.accepted.map(item => <p key={item.id}>{item.user.email} accepted on {new Date(item.acceptedAt).toLocaleString()}</p>)}
    <p role="status">{message}</p>
  </details>;
}
