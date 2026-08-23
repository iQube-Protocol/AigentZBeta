'use client';

/**
 * QriptoPapersTab
 *
 * Renders Qriptopian Papers (or Magazines, when `group='magazines'`) as PDF
 * cards. `group='essays'` projects canonical Threshold essays from QubeBase
 * through the same registered Codex component slot, keeping Essays a distinct
 * publication class without duplicating the TabRenderer registry.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileText, Loader2, ImageOff, BookOpen } from 'lucide-react';
import { PDFLiteReaderModal } from '@/app/triad/components/content/PDFLiteReaderModal';
import { SmartContentListenButton } from '@/components/shared/SmartContentListenButton';
import { QriptoEssaysTab } from './QriptoEssaysTab';

type PaperCard = {
  id: string;
  title: string;
  scope: string;
  scopeLabel: string;
  pdfUrl: string;
  coverUrl: string | null;
  coverMime: string | null;
  mimeType: string;
  uploadedAt: string | null;
};

interface QriptoPapersTabProps {
  theme?: 'light' | 'dark';
  /** Papers/Magazines are PDF assets; Essays are canonical QubeBase content. */
  group?: 'papers' | 'magazines' | 'essays';
}

export function QriptoPapersTab({ theme = 'dark', group = 'papers' }: QriptoPapersTabProps) {
  if (group === 'essays') {
    return <QriptoEssaysTab theme={theme} />;
  }
  return <QriptoPdfAssetsTab theme={theme} group={group} />;
}

function QriptoPdfAssetsTab({
  theme = 'dark',
  group,
}: {
  theme?: 'light' | 'dark';
  group: 'papers' | 'magazines';
}) {
  const [papers, setPapers] = useState<PaperCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePdf, setActivePdf] = useState<{ url: string; title: string } | null>(null);

  const searchParams = useSearchParams();
  const initialScope = searchParams?.get('scope') || null;
  const [scopeFilter, setScopeFilter] = useState<string | null>(initialScope);

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

  const visiblePapers = scopeFilter ? papers.filter((p) => p.scope === scopeFilter) : papers;
  const grouped = visiblePapers.reduce<Record<string, PaperCard[]>>((acc, p) => {
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
      {scopeFilter && (
        <button
          type="button"
          onClick={() => setScopeFilter(null)}
          className={`text-xs font-medium ${isDark ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-600 hover:text-indigo-700'}`}
        >
          ← Show all Papers
        </button>
      )}
      {Object.entries(grouped).map(([label, items]) => (
        <section key={label}>
          <h3 className={`mb-3 text-sm font-semibold uppercase tracking-wide ${mutedClass}`}>
            {label}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePdf({ url: p.pdfUrl, title: p.title })}
                className="group relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 hover:ring-2 hover:ring-white/30 bg-slate-900"
                aria-label={`Open ${p.title}`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-black" />
                {p.coverUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={p.coverUrl}
                    alt={p.title}
                    className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${mutedClass}`}>
                    <ImageOff className="h-8 w-8" />
                    <span className="text-xs">No cover</span>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-3 pt-10">
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-white/80" />
                    <p className="text-sm font-medium leading-snug text-white line-clamp-2">{p.title}</p>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-white/60">
                    <span>{p.uploadedAt ? new Date(p.uploadedAt).toLocaleDateString() : ''}</span>
                    <span className="inline-flex items-center gap-1 text-purple-300 group-hover:text-purple-200">
                      Read <BookOpen className="h-3 w-3" />
                    </span>
                  </div>
                </div>
                <span className="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur-sm text-white text-[10px] font-semibold rounded">
                  {p.scopeLabel}
                </span>
                {/* Listen is honestly disabled here: codex_media_assets (PDF papers)
                    has no extracted/canonical text field anywhere in the schema, so
                    there is nothing yet to synthesize speech from. Rendered as an
                    inert <span> (see SmartContentListenButton's disabledReason
                    branch), which is why it's safe to nest inside this card's own
                    outer <button> without a nested-button HTML violation. */}
                <span className="absolute top-2 left-2" onClick={(e) => e.stopPropagation()}>
                  <SmartContentListenButton
                    compact
                    item={{ id: p.id, title: p.title, getText: () => '' }}
                    disabledReason="No readable text available for this paper yet"
                  />
                </span>
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
        listenDisabledReason="No readable text available for this paper yet"
      />
    </div>
  );
}
