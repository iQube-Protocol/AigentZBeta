'use client';

/**
 * IQubeRegistryDocsTab — PRD + reference docs reader.
 *
 * Stage 8+. Lists every doc in the allowlist served by
 * /api/admin/registry/docs and renders the selected one via
 * react-markdown.
 *
 * Read-only. The allowlist is server-side; this UI just navigates it.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { personaFetch } from '@/utils/personaSpine';

interface DocEntry {
  id: string;
  path: string;
  label: string;
  group: 'primary' | 'prd' | 'stage' | 'audit';
  order: number;
  description?: string;
}

interface DocsCatalog {
  docs: DocEntry[];
  total: number;
}

interface DocContentResponse {
  doc: DocEntry;
  content: string;
  bytes: number;
}

const GROUP_LABEL: Record<DocEntry['group'], string> = {
  primary: 'Primary contract',
  prd: 'PRD trail',
  audit: 'Audit + transitions',
  stage: 'Stage close reports',
};

const GROUP_COLOR: Record<DocEntry['group'], string> = {
  primary: 'border-violet-500/40 bg-violet-900/15',
  prd: 'border-blue-500/40 bg-blue-900/15',
  audit: 'border-amber-500/40 bg-amber-900/15',
  stage: 'border-emerald-500/40 bg-emerald-900/15',
};

function cls(...xs: Array<string | false | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export function IQubeRegistryDocsTab() {
  const [catalog, setCatalog] = useState<DocEntry[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState<DocContentResponse | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await personaFetch('/api/admin/registry/docs', { cache: 'no-store' });
      if (!res.ok) {
        setCatalogError(`HTTP ${res.status}`);
        setCatalog([]);
        return;
      }
      const body = (await res.json()) as DocsCatalog;
      setCatalog(body.docs ?? []);
      if (!selectedId && body.docs.length > 0) {
        setSelectedId(body.docs[0].id);
      }
    } catch (e) {
      setCatalogError((e as Error).message || 'Network error');
    } finally {
      setCatalogLoading(false);
    }
  }, [selectedId]);

  const loadDoc = useCallback(async (entry: DocEntry) => {
    setContentLoading(true);
    setContentError(null);
    try {
      const res = await personaFetch(
        `/api/admin/registry/docs?path=${encodeURIComponent(entry.path)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setContentError(`HTTP ${res.status}${body?.error ? ` — ${body.error}` : ''}`);
        setContent(null);
        return;
      }
      setContent((await res.json()) as DocContentResponse);
    } catch (e) {
      setContentError((e as Error).message || 'Network error');
      setContent(null);
    } finally {
      setContentLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!selectedId) return;
    const entry = catalog.find((d) => d.id === selectedId);
    if (entry) loadDoc(entry);
  }, [selectedId, catalog, loadDoc]);

  // Group docs by their group field
  const grouped = React.useMemo(() => {
    const out: Record<DocEntry['group'], DocEntry[]> = {
      primary: [],
      prd: [],
      audit: [],
      stage: [],
    };
    for (const d of catalog) {
      out[d.group].push(d);
    }
    return out;
  }, [catalog]);

  const orderedGroups: ReadonlyArray<DocEntry['group']> = ['primary', 'prd', 'audit', 'stage'];

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-violet-400" />
            PRD + Docs
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Legibility profile, full PRD trail (v0.1 → v1.1), Stage 0 audit, and stage close reports. Read-only;
            server-side allowlist enforced.
          </p>
        </div>
        <button
          onClick={loadCatalog}
          disabled={catalogLoading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-slate-600 disabled:opacity-50"
        >
          {catalogLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Refresh
        </button>
      </header>

      {catalogError && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-rose-900/30 border border-rose-700/50 text-rose-200 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>{catalogError}</div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4 min-h-[600px]">
        {/* Left rail — doc list */}
        <aside className="col-span-12 lg:col-span-4 space-y-3">
          {orderedGroups.map((g) => {
            const docs = grouped[g];
            if (docs.length === 0) return null;
            return (
              <section key={g} className={cls('border rounded-md', GROUP_COLOR[g])}>
                <header className="px-3 py-2 text-xs uppercase tracking-wide text-slate-300 border-b border-slate-700/40">
                  {GROUP_LABEL[g]}
                </header>
                <ul className="divide-y divide-slate-800/60">
                  {docs.map((d) => (
                    <li key={d.id}>
                      <button
                        onClick={() => setSelectedId(d.id)}
                        className={cls(
                          'w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-slate-800/40 transition-colors text-xs',
                          selectedId === d.id && 'bg-slate-800/60',
                        )}
                      >
                        <ChevronRight
                          className={cls(
                            'w-3 h-3 mt-0.5 text-slate-500 transition-transform flex-shrink-0',
                            selectedId === d.id && 'rotate-90 text-violet-400',
                          )}
                        />
                        <div>
                          <div className="font-medium text-slate-200">{d.label}</div>
                          {d.description && (
                            <div className="text-[11px] text-slate-500 mt-0.5">{d.description}</div>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </aside>

        {/* Right pane — content */}
        <section className="col-span-12 lg:col-span-8 border border-slate-700/50 rounded-md overflow-hidden">
          {contentLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading doc…
            </div>
          )}
          {contentError && (
            <div className="flex items-start gap-2 p-4 m-4 rounded-md bg-rose-900/30 border border-rose-700/50 text-rose-200 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>{contentError}</div>
            </div>
          )}
          {!contentLoading && !contentError && content && (
            <article className="p-6 overflow-y-auto max-h-[80vh]">
              <header className="mb-4 pb-3 border-b border-slate-800">
                <h3 className="text-lg font-semibold text-slate-100">{content.doc.label}</h3>
                <div className="text-xs text-slate-500 font-mono mt-1">{content.doc.path}</div>
              </header>
              <div className="prose prose-invert prose-sm max-w-none prose-code:text-violet-300 prose-code:bg-slate-800/60 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 prose-headings:text-slate-100 prose-strong:text-slate-100 prose-a:text-violet-300 prose-table:text-xs">
                <ReactMarkdown>{content.content}</ReactMarkdown>
              </div>
            </article>
          )}
          {!contentLoading && !contentError && !content && (
            <div className="text-sm text-slate-500 py-12 text-center">
              Select a doc from the left rail.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
