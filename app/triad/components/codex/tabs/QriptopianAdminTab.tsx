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
  Image,
  Layers,
  LayoutGrid,
  Loader2,
  Monitor,
  Newspaper,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Upload,
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
  | { kind: 'editor'; id: string | null; section: string };

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

// ── Root tab ──────────────────────────────────────────────────────────────────

export function QriptopianAdminTab({ isAdmin, theme, personaId }: Props) {
  const [view, setView] = useState<AdminView>({ kind: 'dashboard' });

  const handleNavigate = (key: string, section: string | null) => {
    if (section) {
      setView({ kind: 'section', section });
    }
    // bulk-import, codex, embed-health: no-op for now (those are standalone pages)
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

  const breadcrumb = view.kind === 'dashboard'
    ? null
    : view.kind === 'section'
    ? SECTION_META[view.section]?.label ?? view.section
    : view.kind === 'editor'
    ? (view.id ? 'Edit Article' : 'New Article')
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
      </div>
    </div>
  );
}
