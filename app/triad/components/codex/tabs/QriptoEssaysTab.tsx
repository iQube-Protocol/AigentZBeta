'use client';

import { useEffect, useState } from 'react';
import { BookOpenText, Loader2, ImageOff, ArrowUpRight, Share2, Bot } from 'lucide-react';
import { useSmartTriad } from '@/app/components/content/SmartTriadProvider';

interface EssayCard {
  id: string;
  title: string;
  slug?: string | null;
  excerpt?: string;
  thumbnail?: string | null;
  publishedAt?: string | null;
  duration?: string | null;
  position?: number;
}

interface QriptoEssaysTabProps {
  theme?: 'light' | 'dark';
}

export function QriptoEssaysTab({ theme = 'dark' }: QriptoEssaysTabProps) {
  const { actions } = useSmartTriad();
  const [essays, setEssays] = useState<EssayCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/codex/qripto/essays', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!cancelled) setEssays(Array.isArray(data.essays) ? data.essays : []);
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error)?.message || 'Failed to load essays');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openEssay = async (essay: EssayCard) => {
    await actions.loadContent(essay.id);
    actions.setContentAccessGranted(true);
    actions.setViewerModality('read');
    actions.setActiveDrawer('contentViewer');
  };

  const shareEssay = (essay: EssayCard) => {
    actions.openShare({
      id: essay.id,
      title: essay.title,
      description: essay.excerpt,
      section: 'Thresholds',
      type: 'text',
    });
  };

  const isDark = theme === 'dark';
  const heading = isDark ? 'text-white' : 'text-slate-900';
  const muted = isDark ? 'text-slate-400' : 'text-slate-600';
  const card = isDark
    ? 'bg-slate-900/70 border-slate-700/70 hover:border-indigo-400/60'
    : 'bg-white border-slate-200 hover:border-indigo-400';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className={`h-6 w-6 animate-spin ${muted}`} />
      </div>
    );
  }

  if (error) {
    return <div className="p-8 text-sm text-red-400">{error}</div>;
  }

  return (
    <div className="p-6 space-y-8">
      <section>
        <div className="mb-4">
          <p className={`text-xs uppercase tracking-[0.22em] ${muted}`}>Essay Series</p>
          <h2 className={`mt-1 text-xl font-semibold ${heading}`}>Thresholds</h2>
          <p className={`mt-2 max-w-2xl text-sm ${muted}`}>
            Field Notes from a Constitutional Internet — substantial arguments that sit between Qriptopian articles and canonical papers.
          </p>
        </div>

        {essays.length === 0 ? (
          <div className={`rounded-lg border p-8 text-sm ${card} ${muted}`}>
            No published Threshold essays are available yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {essays.map((essay, index) => (
              <article
                key={essay.id}
                className={`group overflow-hidden rounded-xl border text-left transition ${card}`}
              >
                <button
                  type="button"
                  onClick={() => openEssay(essay)}
                  className="block w-full text-left"
                  aria-label={`Read ${essay.title}`}
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950">
                    {essay.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={essay.thumbnail}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-white/40">
                        <ImageOff className="h-8 w-8" />
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold tracking-[0.18em] text-white backdrop-blur-sm">
                      THRESHOLD {String(index + 1).padStart(3, '0')}
                    </span>
                  </div>

                  <div className="p-4 pb-2">
                    <div className="flex items-start gap-3">
                      <BookOpenText className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" />
                      <div className="min-w-0 flex-1">
                        <h3 className={`font-medium leading-snug ${heading}`}>{essay.title}</h3>
                        {essay.excerpt ? (
                          <p className={`mt-2 line-clamp-3 text-xs leading-relaxed ${muted}`}>{essay.excerpt}</p>
                        ) : null}
                      </div>
                      <ArrowUpRight className={`h-4 w-4 shrink-0 ${muted} transition group-hover:text-indigo-400`} />
                    </div>
                  </div>
                </button>

                <div className="flex items-center justify-between px-4 pb-4 pt-2">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] ${muted}`} title="Machine-readable edition available">
                    <Bot className="h-3.5 w-3.5" />
                    Machine-readable
                  </span>
                  <button
                    type="button"
                    onClick={() => shareEssay(essay)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                      isDark
                        ? 'bg-white/5 text-slate-300 hover:bg-indigo-500/15 hover:text-indigo-300'
                        : 'bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                    }`}
                    aria-label={`Share ${essay.title}`}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
