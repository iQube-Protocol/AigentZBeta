'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Edit,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = 'draft' | 'published';

interface ContentItem {
  id: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  cover_image_uri: string | null;
  status: Status;
  section: string | null;
  body_preview: string | null;
  created_at: string;
  updated_at: string | null;
}

interface SectionSummary {
  draft: number;
  published: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTIONS = ['features', 'pennydrops', 'scrolls', 'kn0wdz', 'rewards', 'qriptopia'];

const SECTION_LABELS: Record<string, string> = {
  features:   'Features',
  pennydrops: 'PennyDrops',
  scrolls:    'Scrolls',
  kn0wdz:    '21 Kn0wdZ',
  rewards:    'Rewards',
  qriptopia:  'Qriptopia',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── ContentRow ────────────────────────────────────────────────────────────────

function ContentRow({
  item,
  onPublish,
  onUnpublish,
  onDelete,
  busy,
}: {
  item: ContentItem;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onDelete: (id: string) => void;
  busy: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isBusy = busy === item.id;

  return (
    <div className={`rounded-lg border transition-colors ${
      item.status === 'published'
        ? 'border-emerald-800/40 bg-emerald-950/20'
        : 'border-gray-700 bg-gray-800/40'
    }`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-gray-500 hover:text-gray-300"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="flex-1 min-w-0">
          <p className="truncate font-medium text-white text-sm">{item.title}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {SECTION_LABELS[item.section ?? ''] ?? item.section ?? '—'} · {timeAgo(item.updated_at ?? item.created_at)}
          </p>
        </div>

        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
          item.status === 'published'
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-gray-700 text-gray-400'
        }`}>
          {item.status}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <>
              {item.status === 'draft' ? (
                <button
                  type="button"
                  onClick={() => onPublish(item.id)}
                  title="Publish"
                  className="rounded p-1.5 text-gray-400 hover:bg-emerald-900/40 hover:text-emerald-400"
                >
                  <Globe className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onUnpublish(item.id)}
                  title="Unpublish (back to draft)"
                  className="rounded p-1.5 text-gray-400 hover:bg-yellow-900/40 hover:text-yellow-400"
                >
                  <FileText className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                title="Delete"
                className="rounded p-1.5 text-gray-400 hover:bg-red-900/40 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-700/50 px-4 py-3 space-y-2">
          {item.excerpt && (
            <p className="text-sm text-gray-400">{item.excerpt}</p>
          )}
          {item.body_preview && (
            <pre className="rounded bg-gray-900 p-2 text-xs text-gray-500 whitespace-pre-wrap line-clamp-4">
              {item.body_preview}…
            </pre>
          )}
          {item.slug && (
            <p className="text-xs text-gray-600 font-mono">slug: {item.slug}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── SectionPanel ──────────────────────────────────────────────────────────────

function SectionPanel({
  section,
  items,
  summary,
  onPublish,
  onUnpublish,
  onDelete,
  busy,
}: {
  section: string;
  items: ContentItem[];
  summary: SectionSummary;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onDelete: (id: string) => void;
  busy: string | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const label = SECTION_LABELS[section] ?? section;

  return (
    <div className="rounded-xl border border-white/5 bg-slate-950/80">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          {collapsed ? <ChevronRight className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
          <span className="font-semibold text-white">{label}</span>
          <span className="text-[10px] uppercase tracking-widest text-slate-500">{items.length} items</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-400">{summary.published} published</span>
          <span className="text-gray-500">{summary.draft} draft{summary.draft !== 1 ? 's' : ''}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3 space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-gray-600 py-2 text-center">No content in this section yet.</p>
          ) : (
            items.map((item) => (
              <ContentRow
                key={item.id}
                item={item}
                onPublish={onPublish}
                onUnpublish={onUnpublish}
                onDelete={onDelete}
                busy={busy}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function QriptopianAdminPage() {
  const [items,    setItems]    = useState<ContentItem[]>([]);
  const [summary,  setSummary]  = useState<Record<string, SectionSummary>>({});
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [busy,     setBusy]     = useState<string | null>(null);
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null);
  const [filter,   setFilter]   = useState<'all' | 'draft' | 'published'>('all');

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/admin/qriptopian/content?status=${filter}&limit=200`);
      const json = await res.json() as { ok: boolean; data?: { items: ContentItem[]; summary: Record<string, SectionSummary> }; error?: string };
      if (!json.ok) throw new Error(json.error ?? 'Load failed');
      setItems(json.data?.items ?? []);
      setSummary(json.data?.summary ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const patch = async (id: string, updates: Record<string, unknown>) => {
    setBusy(id);
    try {
      const res  = await fetch(`/api/admin/qriptopian/content/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const json = await res.json() as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? 'Update failed');
      showToast('Updated', true);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Update failed', false);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this article? This cannot be undone.')) return;
    setBusy(id);
    try {
      const res  = await fetch(`/api/admin/qriptopian/content/${id}`, { method: 'DELETE' });
      const json = await res.json() as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? 'Delete failed');
      showToast('Deleted', true);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Delete failed', false);
    } finally {
      setBusy(null);
    }
  };

  const totalPublished = Object.values(summary).reduce((n, s) => n + s.published, 0);
  const totalDraft     = Object.values(summary).reduce((n, s) => n + s.draft, 0);

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg ${
          toast.ok ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'
        }`}>
          {toast.ok ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Qriptopian Content</h1>
          <p className="mt-1 text-sm text-slate-400">Manage articles and content across all Qriptopian sections</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/triad/embed/codex/qripto-codex?tab=edit"
            className="flex items-center gap-2 rounded-lg border border-purple-700/50 bg-purple-900/20 px-4 py-2 text-sm font-medium text-purple-300 transition-colors hover:bg-purple-900/40"
          >
            <Edit className="h-4 w-4" />
            Open Editor
            <ExternalLink className="h-3 w-3" />
          </Link>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-600 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Total Articles', value: items.length,    color: 'text-white' },
          { label: 'Published',      value: totalPublished,  color: 'text-emerald-400' },
          { label: 'Drafts',         value: totalDraft,      color: 'text-yellow-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/5 bg-slate-950/80 p-4">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
            <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="mb-5 flex gap-2">
        {(['all', 'published', 'draft'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
              filter === f
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-800/40 bg-red-950/20 p-5 text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {SECTIONS.map((section) => {
            const sectionItems = items.filter((i) => i.section === section);
            const sec = summary[section] ?? { draft: 0, published: 0 };
            return (
              <SectionPanel
                key={section}
                section={section}
                items={sectionItems}
                summary={sec}
                onPublish={(id) => void patch(id, { status: 'published' })}
                onUnpublish={(id) => void patch(id, { status: 'draft' })}
                onDelete={handleDelete}
                busy={busy}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
