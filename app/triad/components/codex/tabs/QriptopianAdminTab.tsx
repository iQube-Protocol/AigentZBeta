'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BookOpen,
  ChevronRight,
  DollarSign,
  Eye,
  FileText,
  Gamepad2,
  Image,
  Layers,
  LayoutGrid,
  Loader2,
  Monitor,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  Video,
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

type AdminView =
  | { kind: 'dashboard' }
  | { kind: 'section'; section: string }
  | { kind: 'editor'; id: string | null; section: string }
  | { kind: 'codex' }
  | { kind: 'import' };

interface Props {
  isAdmin?: boolean;
  theme?: 'light' | 'dark';
  personaId?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTION_META: Record<string, { label: string; description: string; previewTab: string }> = {
  'home-hero':   { label: 'Home Hero Articles',  description: 'Manage the 3 main hero articles',           previewTab: 'features'   },
  'latest-news': { label: 'Latest News',          description: 'Manage the news carousel articles',         previewTab: 'features'   },
  'second-hero': { label: 'Second Hero',          description: 'Manage the bottom featured article',        previewTab: 'features'   },
  'pennydrops':  { label: 'PennyDrops',           description: 'Manage financial insight articles',         previewTab: 'pennydrops' },
  'scrolls':     { label: 'Scrolls',              description: 'Manage metaKnyts & The SynthSims scrolls',  previewTab: 'scrolls'    },
  '21knowdz':    { label: 'Kn0wdZ',               description: 'Manage Dev & Creative resources',           previewTab: 'kn0wdz'     },
  'staybull':    { label: 'StayBull',             description: 'Manage market update articles',             previewTab: 'rewards'    },
};

const SECTION_TAB_MAP: Record<string, string> = {
  'home-hero': 'features', 'latest-news': 'features', 'second-hero': 'features',
  'pennydrops': 'pennydrops', 'scrolls': 'scrolls',
  '21knowdz': 'kn0wdz', 'staybull': 'rewards',
};

const DASHBOARD_SECTIONS = [
  { key: 'bulk-import',  title: 'Bulk Import',              description: 'Import multiple content items',        icon: Upload,      section: null },
  { key: 'home-hero',    title: 'Home Hero',                description: '3 main hero articles',                 icon: LayoutGrid,  section: 'home-hero'   },
  { key: 'latest-news',  title: 'Latest News',              description: 'News carousel',                        icon: Newspaper,   section: 'latest-news' },
  { key: 'second-hero',  title: 'Second Hero',              description: 'Bottom featured article',              icon: Image,       section: 'second-hero' },
  { key: 'pennydrops',   title: 'PennyDrops',               description: 'Financial insights',                   icon: DollarSign,  section: 'pennydrops'  },
  { key: 'scrolls',      title: 'Scrolls',                  description: 'metaKnyts & The SynthSims',            icon: BookOpen,    section: 'scrolls'     },
  { key: '21knowdz',     title: 'Kn0wdZ',                   description: 'Dev & Creative resources',             icon: Monitor,     section: '21knowdz'    },
  { key: 'staybull',     title: 'StayBull',                 description: 'Market updates',                       icon: TrendingUp,  section: 'staybull'    },
  { key: 'codex',        title: 'SmartTriad Codex Manager', description: 'Episodes, covers, Autonomys uploads',  icon: Layers,      section: null },
  { key: 'embed-health', title: 'Embed Health Check',        description: 'Test iframe compatibility',            icon: Activity,    section: null },
];

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
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {chips.map((c) => (
        <span key={c} className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs font-medium text-slate-300">
          {c}
        </span>
      ))}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function AdminDashboard({ onNavigate }: { onNavigate: (key: string, section: string | null) => void }) {
  return (
    <div className="p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">Content Management</h2>
        <p className="text-xs text-slate-400">Manage content across all sections of the application</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {DASHBOARD_SECTIONS.map(({ key, title, description, icon: Icon, section }) => (
          <button
            key={key}
            type="button"
            onClick={() => onNavigate(key, section)}
            className="flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 text-left transition-colors hover:border-teal-500/40 hover:bg-slate-800/70"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800">
              <Icon className="h-5 w-5 text-teal-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">{title}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-tight">{description}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 ml-auto" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Article row ───────────────────────────────────────────────────────────────

function ArticleRow({
  item,
  section,
  onPublish,
  onUnpublish,
  onEdit,
  onDelete,
  busy,
}: {
  item: ContentItem;
  section: string;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  busy: string | null;
}) {
  const position = item.placement?.position ?? 0;
  const isBusy   = busy === item.id;
  const previewTab = SECTION_TAB_MAP[section] ?? 'features';

  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-slate-900/50 p-3">
      {/* Thumbnail */}
      <div className="h-[72px] w-[112px] shrink-0 overflow-hidden rounded-lg bg-slate-800">
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="h-full w-full object-cover"
            style={{ objectPosition: `${item.placement?.imageX ?? 50}% ${item.placement?.imageY ?? 50}%` }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-600 text-xs">No image</div>
        )}
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-xs text-slate-400">
            Pos {position}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            item.status === 'published'
              ? 'bg-emerald-900/40 text-emerald-400'
              : 'bg-slate-700 text-slate-400'
          }`}>
            {item.status}
          </span>
          {item.issue_ref && (
            <span className="rounded-full bg-purple-900/40 px-2 py-0.5 text-xs font-semibold text-purple-400">
              #{item.issue_ref}
            </span>
          )}
        </div>
        <h3 className="text-sm font-bold text-white leading-tight truncate">{item.title}</h3>
        {item.excerpt && (
          <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{item.excerpt}</p>
        )}
        <ModalityChips modalities={item.modalities} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : (
          <>
            <a
              href={`/triad/embed/codex/qripto?tab=${previewTab}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
              title="Preview on site"
            >
              <Eye className="h-3.5 w-3.5" />
            </a>

            {item.status === 'draft' ? (
              <button
                type="button"
                onClick={() => onPublish(item.id)}
                className="rounded-lg bg-teal-600 px-2 py-1 text-xs font-semibold text-white hover:bg-teal-500"
              >
                Publish
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onUnpublish(item.id)}
                className="rounded-lg bg-slate-700 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-600"
              >
                Unpublish
              </button>
            )}

            <button
              type="button"
              onClick={() => onEdit(item.id)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-900/30 hover:text-red-400"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Section manager ───────────────────────────────────────────────────────────

function ContentSectionManager({
  section,
  onBack,
  onEdit,
}: {
  section: string;
  onBack: () => void;
  onEdit: (id: string | null) => void;
}) {
  const meta = SECTION_META[section] ?? { label: section, description: '', previewTab: 'features' };

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
    <div className="p-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-teal-900 px-3 py-2 text-xs font-medium text-teal-300 shadow-lg">
          {toast}
        </div>
      )}

      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-white">{meta.label}</h2>
          <p className="text-xs text-slate-400">{meta.description}</p>
        </div>
        <button
          type="button"
          onClick={() => onEdit(null)}
          className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Article
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-800/40 bg-red-950/20 p-4 text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p className="text-xs">{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-slate-900/50 p-8 text-center">
          <p className="text-sm text-slate-400">No articles in this section yet.</p>
          <button
            type="button"
            onClick={() => onEdit(null)}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Add First Article
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <ArticleRow
              key={item.id}
              item={item}
              section={section}
              onPublish={(id) => void patch(id, { status: 'published' })}
              onUnpublish={(id) => void patch(id, { status: 'draft' })}
              onEdit={onEdit}
              onDelete={handleDelete}
              busy={busy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inline editor ─────────────────────────────────────────────────────────────

const MODALITIES = ['Read', 'Watch', 'Listen', 'Link'] as const;
type ModalityKey = typeof MODALITIES[number];

const IMAGE_POSITIONS = ['top', 'center', 'bottom', 'left', 'right'] as const;

function ContentEditor({
  id,
  section,
  onBack,
  onSaved,
}: {
  id: string | null;
  section: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const isNew = id === null;

  const [loading, setLoading] = useState(!isNew);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [toast,   setToast]   = useState<string | null>(null);

  // fields
  const [title,        setTitle]        = useState('');
  const [excerpt,      setExcerpt]      = useState('');
  const [issueRef,     setIssueRef]     = useState('');
  const [position,     setPosition]     = useState(1);
  const [thumbnail,    setThumbnail]    = useState('');
  const [qPrice,       setQPrice]       = useState(0);
  const [imagePos,     setImagePos]     = useState<string>('center');
  const [imageScale,   setImageScale]   = useState(100);
  const [imageX,       setImageX]       = useState(50);
  const [imageY,       setImageY]       = useState(50);
  const [activeModal,  setActiveModal]  = useState<ModalityKey>('Read');

  // modality fields
  const [readText,     setReadText]     = useState('');
  const [videoUrl,     setVideoUrl]     = useState('');
  const [loopVideo,    setLoopVideo]    = useState(false);
  const [audioUrl,     setAudioUrl]     = useState('');
  const [linkUrl,      setLinkUrl]      = useState('');
  const [allowEmbed,   setAllowEmbed]   = useState(true);

  // enabled modalities
  const [readEnabled,   setReadEnabled]   = useState(false);
  const [watchEnabled,  setWatchEnabled]  = useState(false);
  const [listenEnabled, setListenEnabled] = useState(false);
  const [linkEnabled,   setLinkEnabled]   = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    fetch(`/api/admin/content/${id}`)
      .then((r) => r.json())
      .then((j: { data?: ContentItem; error?: string }) => {
        const d = j.data;
        if (!d) throw new Error(j.error ?? 'Not found');
        setTitle(d.title ?? '');
        setExcerpt(d.excerpt ?? '');
        setIssueRef(d.issue_ref ?? '');
        setPosition(d.placement?.position ?? 1);
        setThumbnail(d.thumbnail ?? '');
        setImageScale(d.placement?.imageScale ?? 100);
        setImageX(d.placement?.imageX ?? 50);
        setImageY(d.placement?.imageY ?? 50);
        if (d.modalities?.read?.available)   { setReadEnabled(true);   setReadText(d.modalities.read.text ?? ''); }
        if (d.modalities?.watch?.available)  { setWatchEnabled(true);  setVideoUrl(d.modalities.watch.video_url ?? ''); setLoopVideo((d.modalities.watch as any).loop ?? false); }
        if (d.modalities?.listen?.available) { setListenEnabled(true); setAudioUrl(d.modalities.listen.audio_url ?? ''); }
        if (d.modalities?.link?.available)   { setLinkEnabled(true);   setLinkUrl(d.modalities.link.url ?? ''); setAllowEmbed((d.modalities.link as any).allow_embed ?? true); }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const buildPayload = (status: 'draft' | 'published') => ({
    title,
    excerpt: excerpt || null,
    issue_ref: issueRef || null,
    thumbnail: thumbnail || null,
    status,
    placement: { section, position, imageScale, imageX, imageY },
    modalities: {
      read:   { available: readEnabled,   text: readText, duration: '' },
      watch:  { available: watchEnabled,  video_url: videoUrl, loop: loopVideo, duration: '' },
      listen: { available: listenEnabled, audio_url: audioUrl, duration: '' },
      link:   { available: linkEnabled,   url: linkUrl, allow_embed: allowEmbed },
    },
    market_data: { pricing_model: { tiers: [{ amount: qPrice }] } },
  });

  const save = async (status: 'draft' | 'published') => {
    if (!title.trim()) { showToast('Title is required'); return; }
    setSaving(true);
    try {
      const url    = isNew ? '/api/admin/content' : `/api/admin/content/${id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(status)),
      });
      if (!res.ok) throw new Error('Save failed');
      showToast(status === 'published' ? 'Published!' : 'Draft saved');
      setTimeout(() => onSaved(), 600);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error saving');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 flex items-center gap-2 rounded-xl border border-red-800/40 bg-red-950/20 text-red-400">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  const previewTab = SECTION_TAB_MAP[section] ?? 'features';

  return (
    <div className="p-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-teal-900 px-3 py-2 text-xs font-medium text-teal-300 shadow-lg">
          {toast}
        </div>
      )}

      {/* Actions bar */}
      <div className="mb-4 flex items-center justify-end gap-2">
        <a
          href={`/triad/embed/codex/qripto?tab=${previewTab}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
        >
          <Eye className="h-3.5 w-3.5" />
          Preview on Site
        </a>
        <button
          type="button"
          onClick={() => void save('draft')}
          disabled={saving}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-500 hover:text-white disabled:opacity-50"
        >
          Save Draft
        </button>
        <button
          type="button"
          onClick={() => void save('published')}
          disabled={saving}
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Publish'}
        </button>
      </div>

      <div className="flex gap-4">
        {/* Left column */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Basic fields */}
          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Excerpt</label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={2}
                placeholder="Brief description"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Issue Reference</label>
                <input
                  type="text"
                  value={issueRef}
                  onChange={(e) => setIssueRef(e.target.value)}
                  placeholder="e.g. 001"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Display Position</label>
                <input
                  type="number"
                  value={position}
                  onChange={(e) => setPosition(Number(e.target.value))}
                  min={1}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Thumbnail URL</label>
              <input
                type="text"
                value={thumbnail}
                onChange={(e) => setThumbnail(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Modalities */}
          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-4">
            <p className="text-xs font-semibold text-slate-300 mb-3">Content Modalities</p>
            {/* Tab switcher */}
            <div className="flex border-b border-slate-700 mb-3">
              {MODALITIES.map((m) => {
                const enabled = m === 'Read' ? readEnabled : m === 'Watch' ? watchEnabled : m === 'Listen' ? listenEnabled : linkEnabled;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setActiveModal(m)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeModal === m
                        ? 'border-b-2 border-teal-400 text-teal-400 -mb-px'
                        : enabled ? 'text-slate-200 hover:text-white' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            {activeModal === 'Read' && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={readEnabled} onChange={(e) => setReadEnabled(e.target.checked)} className="accent-teal-500" />
                  Enable Read modality
                </label>
                {readEnabled && (
                  <textarea
                    value={readText}
                    onChange={(e) => setReadText(e.target.value)}
                    rows={6}
                    placeholder="Article content (Markdown supported)..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none resize-none font-mono"
                  />
                )}
              </div>
            )}

            {activeModal === 'Watch' && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={watchEnabled} onChange={(e) => setWatchEnabled(e.target.checked)} className="accent-teal-500" />
                  Enable Watch modality
                </label>
                {watchEnabled && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Video URL</label>
                      <input type="text" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none" />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input type="checkbox" checked={loopVideo} onChange={(e) => setLoopVideo(e.target.checked)} className="accent-teal-500" />
                      Loop video
                    </label>
                  </>
                )}
              </div>
            )}

            {activeModal === 'Listen' && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={listenEnabled} onChange={(e) => setListenEnabled(e.target.checked)} className="accent-teal-500" />
                  Enable Listen modality
                </label>
                {listenEnabled && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Audio URL</label>
                    <input type="text" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} placeholder="Direct audio file URL or podcast link" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none" />
                  </div>
                )}
              </div>
            )}

            {activeModal === 'Link' && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <input type="checkbox" checked={linkEnabled} onChange={(e) => setLinkEnabled(e.target.checked)} className="accent-teal-500" />
                  Enable Link modality
                </label>
                {linkEnabled && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Website URL</label>
                      <input type="text" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://example.com/article" className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none" />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input type="checkbox" checked={allowEmbed} onChange={(e) => setAllowEmbed(e.target.checked)} className="accent-teal-500" />
                      Allow embedding in iframe
                    </label>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-48 shrink-0 space-y-4">
          {/* Pricing */}
          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3">
            <p className="text-xs font-semibold text-slate-300 mb-2">Q¢ Price</p>
            <input
              type="number"
              value={qPrice}
              onChange={(e) => setQPrice(Number(e.target.value))}
              min={0}
              placeholder="0 = free"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-slate-500">0 = free</p>
          </div>

          {/* Image positioning */}
          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3 space-y-3">
            <p className="text-xs font-semibold text-slate-300">Image Positioning</p>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Image Position</label>
              <select
                value={imagePos}
                onChange={(e) => setImagePos(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white focus:border-teal-500 focus:outline-none"
              >
                {IMAGE_POSITIONS.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Scale: {imageScale}%</label>
              <input type="range" min={50} max={200} value={imageScale} onChange={(e) => setImageScale(Number(e.target.value))} className="w-full accent-teal-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Horizontal: {imageX}%</label>
              <input type="range" min={0} max={100} value={imageX} onChange={(e) => setImageX(Number(e.target.value))} className="w-full accent-teal-500" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Vertical: {imageY}%</label>
              <input type="range" min={0} max={100} value={imageY} onChange={(e) => setImageY(Number(e.target.value))} className="w-full accent-teal-500" />
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-xl border border-white/5 bg-slate-900/50 p-3">
            <p className="text-xs font-semibold text-slate-300 mb-2">Live Preview</p>
            <div className="rounded-lg overflow-hidden bg-slate-800 aspect-video mb-2">
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt={title}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: `${imageX}% ${imageY}%`, transform: `scale(${imageScale / 100})` }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-600 text-xs">No image</div>
              )}
            </div>
            {title && <p className="text-xs font-semibold text-white leading-tight line-clamp-2">{title}</p>}
            {excerpt && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{excerpt}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Codex Manager ─────────────────────────────────────────────────────────────

interface EpisodeStatus {
  episodeNumber: number;
  hasStillMaster: boolean;
  hasMotionMaster: boolean;
  hasPrintRare: boolean;
  coverCount: number;
  characterCount: number;
  totalAssets: number;
}

interface GlobalStats {
  totalStillMasters: number;
  totalMotionMasters: number;
  totalPrintRare: number;
  totalPrintEpic: number;
  totalPrintLegendary: number;
  totalCovers: number;
  totalCharacters: number;
  totalLoreDocs: number;
  totalGameAssets: number;
  totalSocialAssets: number;
  totalAllAssets: number;
}

type CodexSeries = 'knyt' | 'qriptopian';

function StatCard({ label, value, badge }: { label: string; value: number; badge?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-800/50 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <div className="mt-1 flex items-end gap-2">
        <p className="text-3xl font-bold text-white">{value}</p>
        {badge && <span className="mb-0.5 rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">{badge}</span>}
      </div>
    </div>
  );
}

function AssetCard({ icon: Icon, label, count, iconColor }: { icon: React.ComponentType<{ className?: string }>; label: string; count: number; iconColor: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-slate-800/50 p-4">
      <Icon className={`h-6 w-6 ${iconColor}`} />
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-xl font-bold text-white">{count}</p>
    </div>
  );
}

function CodexManager() {
  const [activeTab,  setActiveTab]  = useState<CodexSeries>('knyt');
  const [episodes,   setEpisodes]   = useState<EpisodeStatus[]>([]);
  const [stats,      setStats]      = useState<GlobalStats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const series = activeTab === 'knyt' ? 'metaKnyts' : 'qriptopian';
      const res    = await fetch(`/api/admin/codex/status?series=${series}`);
      const json   = await res.json() as { episodes?: EpisodeStatus[]; globalStats?: GlobalStats; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load');
      setEpisodes(json.episodes ?? []);
      setStats(json.globalStats ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { void load(); }, [load]);

  const g               = stats;
  const withPrint       = episodes.filter((e) => e.hasPrintRare).length;
  const withMotion      = episodes.filter((e) => e.hasMotionMaster).length;
  const withCovers      = episodes.filter((e) => e.coverCount > 0).length;
  const printFiles      = g ? (g.totalPrintRare + g.totalPrintEpic + g.totalPrintLegendary) : 0;
  const episodeMasters  = (g?.totalStillMasters ?? 0) + (g?.totalMotionMasters ?? 0);

  return (
    <div className="p-4">
      {/* Inner header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-teal-400" />
          <div>
            <p className="text-sm font-semibold text-white">Codex Manager</p>
            <p className="text-xs text-slate-400">KNYT and Qriptopian digital scrolls &amp; collectibles</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Series tabs */}
      <div className="mb-4 flex border-b border-white/5">
        {(['knyt', 'qriptopian'] as CodexSeries[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === t ? 'border-b-2 border-teal-400 text-teal-400' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            {t === 'knyt' ? 'KNYT Codex' : 'Qriptopian Codex'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-4 text-xs text-red-400">{error}</div>
      ) : activeTab === 'qriptopian' ? (
        <div className="rounded-xl border border-white/5 bg-slate-800/50 p-8 text-center text-sm text-slate-400">
          Qriptopian Codex — Coming Soon
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-4 gap-3">
            <StatCard label="Total Episodes"      value={episodes.length} />
            <StatCard label="With Print Editions" value={withPrint}       badge={`${printFiles} files`} />
            <StatCard label="With Motion Comics"  value={withMotion}      badge={`${g?.totalMotionMasters ?? 0} files`} />
            <StatCard label="With Covers"         value={withCovers}      badge={`${g?.totalCovers ?? 0} variants`} />
          </div>
          <p className="mb-2 text-xs font-semibold text-slate-300">Asset Categories</p>
          <div className="mb-4 grid grid-cols-6 gap-2">
            <AssetCard icon={Video}    label="Episode Masters" count={episodeMasters}           iconColor="text-teal-400" />
            <AssetCard icon={Image}    label="Covers"          count={g?.totalCovers ?? 0}      iconColor="text-purple-400" />
            <AssetCard icon={Users}    label="Characters"      count={g?.totalCharacters ?? 0}  iconColor="text-blue-400" />
            <AssetCard icon={FileText} label="Lore Docs"       count={g?.totalLoreDocs ?? 0}    iconColor="text-amber-400" />
            <AssetCard icon={Gamepad2} label="Game Assets"     count={g?.totalGameAssets ?? 0}  iconColor="text-green-400" />
            <AssetCard icon={Share2}   label="Social Media"    count={g?.totalSocialAssets ?? 0} iconColor="text-pink-400" />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-900/60 p-4">
            <div>
              <p className="text-sm font-semibold text-white">Total Assets on Autonomys</p>
              <p className="text-xs text-slate-400">All encrypted content stored on Auto-Drive</p>
            </div>
            <p className="text-3xl font-bold text-teal-400">{g?.totalAllAssets ?? 0}</p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Bulk Importer ─────────────────────────────────────────────────────────────

interface ImportRow {
  title: string;
  domain?: string;
  section?: string;
  id?: string;
  action: 'insert' | 'update' | 'skip';
  raw: Record<string, unknown>;
}

function BulkImporter() {
  const [rows,       setRows]       = useState<ImportRow[]>([]);
  const [importing,  setImporting]  = useState(false);
  const [progress,   setProgress]   = useState<string | null>(null);
  const [toast,      setToast]      = useState<string | null>(null);
  const [parsed,     setParsed]     = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const arr = JSON.parse(ev.target?.result as string) as Record<string, unknown>[];
        if (!Array.isArray(arr)) throw new Error('Expected a JSON array');
        const mapped = arr.map((item): ImportRow => ({
          title:   String(item.title ?? '(no title)'),
          domain:  item.domain ? String(item.domain) : undefined,
          section: item.section ? String(item.section) : (item.placement as any)?.section,
          id:      item.id ? String(item.id) : undefined,
          action:  item.id ? 'update' : 'insert',
          raw:     item,
        }));
        setRows(mapped);
        setParsed(true);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Invalid JSON');
      }
    };
    reader.readAsText(file);
  };

  const runImport = async () => {
    setImporting(true);
    let done = 0;
    for (const row of rows) {
      if (row.action === 'skip') { done++; continue; }
      setProgress(`Importing ${done + 1} / ${rows.length}: ${row.title}`);
      try {
        const url    = row.action === 'update' ? `/api/admin/content/${row.id!}` : '/api/admin/content';
        const method = row.action === 'update' ? 'PATCH' : 'POST';
        await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row.raw) });
      } catch { /* continue on error */ }
      done++;
    }
    setProgress(null);
    setImporting(false);
    showToast(`Imported ${done} items`);
  };

  return (
    <div className="p-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-teal-900 px-3 py-2 text-xs font-medium text-teal-300 shadow-lg">
          {toast}
        </div>
      )}

      <div className="mb-4">
        <h2 className="text-base font-bold text-white">Bulk Import</h2>
        <p className="text-xs text-slate-400">Upload a JSON array of content items to import</p>
      </div>

      {!parsed ? (
        <label className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/50 p-10 cursor-pointer hover:border-teal-500/40 hover:bg-slate-800/50 transition-colors">
          <Upload className="h-8 w-8 text-slate-500" />
          <p className="text-sm text-slate-400">Click to select a JSON file</p>
          <input type="file" accept=".json,application/json" onChange={handleFile} className="hidden" />
        </label>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-slate-400">{rows.length} items parsed</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setRows([]); setParsed(false); }}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => void runImport()}
                disabled={importing}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {importing ? progress ?? 'Importing…' : `Import ${rows.filter(r => r.action !== 'skip').length} items`}
              </button>
            </div>
          </div>

          <div className="overflow-auto rounded-xl border border-white/5">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-slate-800/60">
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">Title</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">Domain</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">Section</th>
                  <th className="px-3 py-2 text-left text-slate-400 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-white max-w-[200px] truncate">{row.title}</td>
                    <td className="px-3 py-2 text-slate-400">{row.domain ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-400">{row.section ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        row.action === 'insert' ? 'bg-teal-900/40 text-teal-400'
                        : row.action === 'update' ? 'bg-blue-900/40 text-blue-400'
                        : 'bg-slate-700 text-slate-400'
                      }`}>
                        {row.action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Root tab ──────────────────────────────────────────────────────────────────

export function QriptopianAdminTab({ isAdmin, theme, personaId }: Props) {
  const [view, setView] = useState<AdminView>({ kind: 'dashboard' });

  const handleNavigate = (key: string, section: string | null) => {
    if (section) {
      setView({ kind: 'section', section });
    } else if (key === 'codex') {
      setView({ kind: 'codex' });
    } else if (key === 'bulk-import') {
      setView({ kind: 'import' });
    } else if (key === 'embed-health') {
      window.open('/admin/embed-health', '_blank');
    }
  };

  const handleEdit = (id: string | null) => {
    if (view.kind === 'section') {
      setView({ kind: 'editor', id, section: view.section });
    }
  };

  const handleBack = () => {
    if (view.kind === 'editor') {
      setView({ kind: 'section', section: view.section });
    } else {
      setView({ kind: 'dashboard' });
    }
  };

  const breadcrumb =
    view.kind === 'section' ? (SECTION_META[view.section]?.label ?? view.section)
    : view.kind === 'editor' ? (view.id ? 'Edit Article' : 'New Article')
    : view.kind === 'codex' ? 'SmartTriad Codex Manager'
    : view.kind === 'import' ? 'Bulk Import'
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4 py-2 flex items-center gap-2">
        {view.kind !== 'dashboard' && (
          <button
            type="button"
            onClick={handleBack}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-700 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <span className="text-sm font-semibold text-slate-200">
          {view.kind === 'dashboard' ? 'Admin' : breadcrumb}
        </span>
        {view.kind !== 'dashboard' && (
          <>
            <span className="text-slate-600">/</span>
            <span className="text-xs text-slate-500">
              {view.kind === 'editor' && view.id === null ? 'New' : view.kind === 'editor' ? 'Edit' : ''}
            </span>
          </>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {view.kind === 'dashboard' && (
          <AdminDashboard onNavigate={handleNavigate} />
        )}
        {view.kind === 'section' && (
          <ContentSectionManager
            section={view.section}
            onBack={handleBack}
            onEdit={handleEdit}
          />
        )}
        {view.kind === 'editor' && (
          <ContentEditor
            id={view.id}
            section={view.section}
            onBack={handleBack}
            onSaved={() => setView({ kind: 'section', section: view.section })}
          />
        )}
        {view.kind === 'codex' && <CodexManager />}
        {view.kind === 'import' && <BulkImporter />}
      </div>
    </div>
  );
}
