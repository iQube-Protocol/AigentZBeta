'use client';

import React, { useEffect, useState } from 'react';
import { personaFetch } from '@/utils/personaSpine';
import { CopilotInferenceBodyRenderer } from '@/app/components/codex/CopilotInferenceBodyRenderer';
import { CONSTITUTIONAL_PILOT_DOCUMENTS } from '@/services/knowledge/constitutionalPilotDocuments';

export function ConstitutionalPilotDocumentsTab({ developmentOnly = false }: { developmentOnly?: boolean }) {
  const docs = CONSTITUTIONAL_PILOT_DOCUMENTS.filter(d => !developmentOnly || d.development);
  const [selected, setSelected] = useState<string>(developmentOnly ? docs.find(d => d.path.includes('09_CLAUDE'))!.path : docs.find(d => d.path.endsWith('README.md'))!.path);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setContent(''); setError('');
    personaFetch(`/api/admin/registry/docs?path=${encodeURIComponent(selected)}`, { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Administrator access is required.' : 'Unable to load this document. Please try again.');
        const data = await response.json();
        if (!cancelled) setContent(data.content);
      })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);
  return <section className="flex h-full min-h-0 flex-col p-3 gap-3">
    <header><h2 className="text-lg font-semibold">Constitutional Yield &amp; Risk</h2>
      <p className="text-sm text-slate-400">Venture Lab α · Constitutional Financial Services / Vela pilot{developmentOnly ? ' · Development documents' : ''}</p>
      <p className="text-xs text-amber-400">Working specifications and unratified research · implementation status is stated in each document.</p>
    </header>
    <div className="flex min-h-0 flex-1 flex-col md:flex-row gap-3">
      <nav aria-label="Pilot documents" className="md:w-64 shrink-0 overflow-y-auto max-h-48 md:max-h-none">
        {docs.map(doc => <button key={doc.id} aria-current={selected === doc.path ? 'page' : undefined} onClick={() => setSelected(doc.path)} className={`block w-full text-left px-3 py-2 rounded text-sm ${selected === doc.path ? 'bg-slate-800 text-amber-300' : 'text-slate-400 hover:text-slate-200'}`}>{doc.label}</button>)}
      </nav>
      <article aria-label="Selected pilot document" aria-busy={loading} className="flex-1 min-w-0 overflow-y-auto p-3 border border-slate-800 rounded">
        {loading ? <p role="status">Loading document…</p> : error ? <p role="alert">{error}</p> : selected.endsWith('.json') ? <pre className="whitespace-pre-wrap break-words text-xs">{content}</pre> : <CopilotInferenceBodyRenderer content={content} />}
      </article>
    </div>
    <a className="text-xs text-slate-400 underline" target="_blank" rel="noopener noreferrer" href={`https://github.com/iQube-Protocol/AigentZBeta/blob/dev/${selected}`}>View source in repository</a>
  </section>;
}
