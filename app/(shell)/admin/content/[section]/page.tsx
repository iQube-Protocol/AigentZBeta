'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Modalities {
  read?:   { available?: boolean; text?: string; duration?: string };
  watch?:  { available?: boolean; video_url?: string; duration?: string };
  listen?: { available?: boolean; audio_url?: string; duration?: string };
  link?:   { available?: boolean; url?: string };
}

interface ContentItem {
  id: string;
  title: string;
  excerpt: string | null;
  thumbnail: string | null;
  status: 'draft' | 'published';
  issue_ref: string | null;
  placement: { section: string; position?: number; tab?: string; imageScale?: number; imageX?: number; imageY?: number } | null;
  modalities: Modalities | null;
  created_at: string;
  updated_at: string | null;
}

// ── Section labels ────────────────────────────────────────────────────────────

const SECTION_META: Record<string, { label: string; description: string; previewTab: string }> = {
  'home-hero':   { label: 'Home Hero Articles',  description: 'Manage the 3 main hero articles',              previewTab: 'features'   },
  'latest-news': { label: 'Latest News',          description: 'Manage the news carousel articles',            previewTab: 'features'   },
  'second-hero': { label: 'Second Hero',          description: 'Manage the bottom featured article',           previewTab: 'features'   },
  'pennydrops':  { label: 'PennyDrops',           description: 'Manage financial insight articles',            previewTab: 'pennydrops' },
  'scrolls':     { label: 'Scrolls',              description: 'Manage metaKnyts & The SynthSims scrolls',    previewTab: 'scrolls'    },
  '21knowdz':    { label: 'Kn0wdZ',               description: 'Manage Dev & Creative resources',              previewTab: 'kn0wdz'     },
  'staybull':    { label: 'StayBull',             description: 'Manage market update articles',                previewTab: 'rewards'    },
};

// ── Modality chips ────────────────────────────────────────────────────────────

function ModalityChips({ modalities }: { modalities: Modalities | null }) {
  if (!modalities) return null;
  const chips: string[] = [];
  if (modalities.read?.available)   chips.push('Read');
  if (modalities.watch?.available)  chips.push('Watch');
  if (modalities.listen?.available) chips.push('Listen');
  if (modalities.link?.available)   chips.push('Link');
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {chips.map((c) => (
        <span key={c} className="rounded-full bg-[#1e2a3a] px-2.5 py-0.5 text-xs font-medium text-gray-300">
          {c}
        </span>
      ))}
    </div>
  );
}

// ── Article row ───────────────────────────────────────────────────────────────

function ArticleRow({
  item,
  section,
  onPublish,
  onUnpublish,
  onDelete,
  busy,
}: {
  item: ContentItem;
  section: string;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onDelete: (id: string) => void;
  busy: string | null;
}) {
  const position = item.placement?.position ?? 0;
  const isBusy   = busy === item.id;

  return (
    <div className="flex items-start gap-4 rounded-xl border border-white/5 bg-[#141927] p-4">
      {/* Thumbnail */}
      <div className="h-[100px] w-[160px] shrink-0 overflow-hidden rounded-lg bg-[#0d1520]">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="h-full w-full object-cover"
            style={{
              objectPosition: `${item.placement?.imageX ?? 50}% ${item.placement?.imageY ?? 50}%`,
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-700 text-xs">No image</div>
        )}
      </div>

      {/* Meta + content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span className="rounded bg-[#1e2a3a] px-2 py-0.5 text-xs text-gray-400">
            Position {position}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            item.status === 'published'
              ? 'bg-emerald-900/40 text-emerald-400'
              : 'bg-gray-800 text-gray-400'
          }`}>
            {item.status}
          </span>
          {item.issue_ref && (
            <span className="rounded-full bg-purple-900/40 px-2 py-0.5 text-xs font-semibold text-purple-400">
              #{item.issue_ref}
            </span>
          )}
        </div>

        <h3 className="text-lg font-bold text-white leading-tight truncate">{item.title}</h3>
        {item.excerpt && (
          <p className="mt-1 text-sm text-gray-400 line-clamp-2">{item.excerpt}</p>
        )}
        <ModalityChips modalities={item.modalities} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {isBusy ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        ) : (
          <>
            <Link
              href={`/triad/embed/codex/qripto?tab=${SECTION_META[section]?.previewTab ?? 'features'}`}
              target="_blank"
              className="rounded-lg p-2 text-gray-400 hover:bg-[#1e2a3a] hover:text-white"
              title="Preview on site"
            >
              <Eye className="h-4 w-4" />
            </Link>

            {item.status === 'draft' ? (
              <button
                type="button"
                onClick={() => onPublish(item.id)}
                className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-500"
              >
                Publish
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onUnpublish(item.id)}
                className="rounded-lg bg-gray-700 px-3 py-1.5 text-sm font-semibold text-gray-300 hover:bg-gray-600"
              >
                Unpublish
              </button>
            )}

            <Link
              href={`/admin/content/edit/${item.id}`}
              className="rounded-lg p-2 text-gray-400 hover:bg-[#1e2a3a] hover:text-white"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Link>

            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="rounded-lg p-2 text-gray-400 hover:bg-red-900/30 hover:text-red-400"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SectionPage() {
  const params  = useParams<{ section: string }>();
  const router  = useRouter();
  const section = params.section;
  const meta    = SECTION_META[section] ?? { label: section, description: '' };

  const [items,   setItems]   = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [busy,    setBusy]    = useState<string | null>(null);
  const [toast,   setToast]   = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/admin/content?section=${section}&status=all`);
      const json = await res.json() as { data?: ContentItem[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load');
      setItems((json.data ?? []).sort((a, b) => (a.placement?.position ?? 99) - (b.placement?.position ?? 99)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => { void load(); }, [load]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/content/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Update failed');
      await load();
      showToast('Saved');
    } catch {
      showToast('Error saving');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this article?')) return;
    setBusy(id);
    try {
      await fetch(`/api/admin/content/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((i) => i.id !== id));
      showToast('Deleted');
    } catch {
      showToast('Error deleting');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] px-8 py-8">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-teal-900 px-4 py-2 text-sm font-medium text-teal-300 shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Link href="/admin" className="mt-1 rounded-lg p-1.5 text-gray-400 hover:bg-[#1e2a3a] hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{meta.label}</h1>
            <p className="mt-0.5 text-sm text-gray-400">{meta.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/admin/content/edit/new?section=${section}`)}
          className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
        >
          <Plus className="h-4 w-4" />
          Add Article
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-800/40 bg-red-950/20 p-5 text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-[#141927] p-10 text-center">
          <p className="text-gray-400">No articles in this section yet.</p>
          <button
            type="button"
            onClick={() => router.push(`/admin/content/edit/new?section=${section}`)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
          >
            <Plus className="h-4 w-4" />
            Add First Article
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ArticleRow
              key={item.id}
              item={item}
              section={section}
              onPublish={(id) => void patch(id, { status: 'published' })}
              onUnpublish={(id) => void patch(id, { status: 'draft' })}
              onDelete={handleDelete}
              busy={busy}
            />
          ))}
        </div>
      )}
    </div>
  );
}
