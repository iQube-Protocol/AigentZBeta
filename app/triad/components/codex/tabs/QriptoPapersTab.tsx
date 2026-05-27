'use client';

/**
 * QriptoPapersTab
 *
 * Renders Qriptopian Papers (or Magazines, when `group='magazines'`) as PDF
 * cards. Data comes from /api/codex/qripto/papers which queries
 * codex_media_assets and groups by series scope parsed from the storage
 * filename (papers/protocols, papers/polity, magazines/2, …).
 *
 * Each card shows the cover (if a cover was uploaded for the same scope)
 * and links to the PDF in a new tab. The PDF link is the direct Supabase
 * Storage URL because Qripto papers are currently uploaded to a public
 * bucket as WIP — Phase 2 token-gating + cover-paper FK linkage are tracked
 * in the WIP-ContentQube backlog doc.
 */

import { useEffect, useState } from 'react';
import { FileText, Loader2, ImageOff, BookOpen } from 'lucide-react';
import { PDFLiteReaderModal } from '@/app/triad/components/content/PDFLiteReaderModal';

type PaperCard = {
  id: string;
  title: string;
  scope: string;
  scopeLabel: string;
  pdfUrl: string;
  coverUrl: string | null;
  mimeType: string;
  uploadedAt: string | null;
};

interface QriptoPapersTabProps {
  theme?: 'light' | 'dark';
  /** 'papers' (default) renders Papers/* scopes; 'magazines' renders Magazines/*. */
  group?: 'papers' | 'magazines';
}

export function QriptoPapersTab({ theme = 'dark', group = 'papers' }: QriptoPapersTabProps) {
  const [papers, setPapers] = useState<PaperCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // PDF-lite viewer state — clicking a card opens the modal in-place
  // rather than navigating to the raw Supabase URL. Same pattern as
  // KNYT episodes (cover thumbnail → modal viewer → PDF body).
  const [activePdf, setActivePdf] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/codex/qripto/papers?group=${group}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (cancelled) return;
        setPapers(Array.isArray(data.papers) ? data.papers : []);
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error)?.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [group]);

  const isDark = theme === 'dark';
  const headingClass = isDark ? 'text-white' : 'text-slate-900';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600';
  const cardClass = isDark
    ? 'bg-slate-800/50 border-slate-700 hover:border-purple-500/50'
    : 'bg-white border-slate-200 hover:border-purple-500/50';

  // Group cards by scope label for sub-section headers.
  const grouped = papers.reduce<Record<string, PaperCard[]>>((acc, p) => {
    (acc[p.scopeLabel] ??= []).push(p);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className={`h-6 w-6 animate-spin ${mutedClass}`} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className="p-8">
        <h2 className={`text-lg font-medium ${headingClass}`}>
          {group === 'magazines' ? 'Magazines' : 'Papers'}
        </h2>
        <p className={`mt-2 text-sm ${mutedClass}`}>
          {group === 'magazines'
            ? 'No magazine issues uploaded yet. Use the codex manager → Qriptopian → Magazines & Codex to upload.'
            : 'No papers uploaded yet. Use the codex manager → Qriptopian → Magazines & Codex to upload white-papers, articles, and their covers.'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {Object.entries(grouped).map(([label, items]) => (
        <section key={label}>
          <h3 className={`mb-3 text-sm font-semibold uppercase tracking-wide ${mutedClass}`}>
            {label}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePdf({ url: p.pdfUrl, title: p.title })}
                className={`group flex flex-col overflow-hidden rounded-lg border text-left transition ${cardClass}`}
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900">
                  {p.coverUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.coverUrl}
                      alt={p.title}
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className={`flex h-full w-full flex-col items-center justify-center gap-2 ${mutedClass}`}>
                      <ImageOff className="h-8 w-8" />
                      <span className="text-xs">No cover uploaded</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                  <div className="flex items-start gap-2">
                    <FileText className={`mt-0.5 h-4 w-4 shrink-0 ${mutedClass}`} />
                    <p className={`text-sm font-medium leading-snug ${headingClass}`}>{p.title}</p>
                  </div>
                  <div className={`mt-auto flex items-center justify-between text-[11px] ${mutedClass}`}>
                    <span>{p.uploadedAt ? new Date(p.uploadedAt).toLocaleDateString() : ''}</span>
                    <span className="inline-flex items-center gap-1 text-purple-400 group-hover:text-purple-300">
                      Read <BookOpen className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
      <PDFLiteReaderModal
        open={activePdf !== null}
        pdfUrl={activePdf?.url ?? ''}
        title={activePdf?.title}
        onClose={() => setActivePdf(null)}
      />
    </div>
  );
}
