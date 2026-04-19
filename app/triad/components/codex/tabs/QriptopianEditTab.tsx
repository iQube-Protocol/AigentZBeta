'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  FileEdit, Eye, Send, CheckCircle2, Loader2, ArrowLeft,
  RefreshCw, Coins, ExternalLink, Globe,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────

const SECTIONS = [
  { slug: 'features',   label: 'Features'   },
  { slug: 'pennydrops', label: 'PennyDrops' },
  { slug: 'scrolls',    label: 'Scrolls'    },
  { slug: 'kn0wdz',     label: '21 Kn0wdZ'  },
  { slug: 'rewards',    label: 'Rewards'    },
  { slug: 'qriptopia',  label: 'Qriptopia'  },
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface Article {
  id: string;
  title: string;
  status: 'draft' | 'published';
  slug?: string;
  structure?: { target_section?: string; body?: string; campaign_tag?: string };
  description?: string;
  coverImageUri?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Props {
  theme?: 'light' | 'dark';
  personaId?: string;
}

type View = 'new' | 'drafts' | 'published';
type FormStage = 'edit' | 'preview' | 'done';

// ── Markdown preview ───────────────────────────────────────────────────────────

function MarkdownPreview({ body }: { body: string }) {
  if (!body.trim()) return <p className="text-sm italic text-slate-500">Nothing to preview yet.</p>;
  return (
    <div className="space-y-1.5">
      {body.split('\n').map((line, i) => {
        if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-slate-100 mt-3">{line.slice(3)}</h2>;
        if (line.startsWith('# '))  return <h1 key={i} className="text-lg font-bold text-slate-100 mt-3">{line.slice(2)}</h1>;
        if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-slate-300 mt-2">{line.slice(4)}</h3>;
        if (line.startsWith('- ') || line.startsWith('* '))
          return <div key={i} className="flex gap-2"><span className="text-slate-500 flex-shrink-0">·</span><p className="text-sm text-slate-300">{line.slice(2)}</p></div>;
        if (line.trim() === '') return <div key={i} className="h-2" />;
        return <p key={i} className="text-sm leading-relaxed text-slate-300">{line}</p>;
      })}
    </div>
  );
}

// ── Create / Edit form ─────────────────────────────────────────────────────────

function ArticleForm({
  initial,
  onBack,
}: {
  initial?: Partial<Article>;
  onBack: () => void;
}) {
  const isEdit = Boolean(initial?.id);

  const [title,         setTitle]         = useState(initial?.title ?? '');
  const [bodyMd,        setBodyMd]        = useState(initial?.structure?.body ?? '');
  const [excerpt,       setExcerpt]       = useState(initial?.description ?? '');
  const [coverUrl,      setCoverUrl]      = useState(initial?.coverImageUri ?? '');
  const [section,       setSection]       = useState(initial?.structure?.target_section ?? 'features');
  const [campaignTag,   setCampaignTag]   = useState(initial?.structure?.campaign_tag ?? '');
  const [stage,         setStage]         = useState<FormStage>('edit');
  const [draft,         setDraft]         = useState<Article | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [publishing,    setPublishing]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<'content' | 'meta'>('content');

  const handleSaveDraft = async () => {
    if (!title.trim() || !bodyMd.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let data: any;
      if (isEdit && initial?.id) {
        const res = await fetch(`/api/marketa/publish/article/${initial.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            body_markdown: bodyMd.trim(),
            excerpt: excerpt.trim() || undefined,
            cover_image_url: coverUrl.trim() || undefined,
            target_section: section,
            campaign_tag: campaignTag.trim() || undefined,
          }),
        });
        data = await res.json();
      } else {
        const res = await fetch('/api/marketa/publish/article', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            body_markdown: bodyMd.trim(),
            excerpt: excerpt.trim() || undefined,
            cover_image_url: coverUrl.trim() || undefined,
            target_codex: 'qriptopian',
            target_section: section,
            campaign_tag: campaignTag.trim() || undefined,
          }),
        });
        data = await res.json();
      }
      if (data.ok) {
        setDraft(data.article);
        setStage('preview');
      } else {
        setError(data.error ?? 'Failed to save');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    const id = draft?.id ?? initial?.id;
    if (!id) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketa/publish/article/${id}/publish`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setDraft(data.article ?? { ...(draft ?? initial), status: 'published' } as Article);
        setStage('done');
      } else {
        setError(data.error ?? 'Publish failed');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setPublishing(false);
    }
  };

  const activeSection = SECTIONS.find(s => s.slug === section) ?? SECTIONS[0];

  // ── Published / done state ────────────────────────────────────────────
  if (stage === 'done') {
    const articleId = draft?.id ?? initial?.id;
    return (
      <div className="space-y-4 p-4">
        <div className="rounded-xl bg-emerald-950/20 ring-1 ring-emerald-500/20 p-8 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
          <h3 className="text-base font-bold text-emerald-300 mb-2">
            Published to Qriptopian → {activeSection.label}
          </h3>
          <p className="text-sm text-emerald-400/70 mb-1">{title}</p>
          {draft?.slug && (
            <p className="text-[10px] font-mono text-emerald-500/60">{draft.slug}</p>
          )}
          <div className="mt-6 flex flex-col items-center gap-3">
            {articleId && (
              <a
                href={`/iqube/mint?contentId=${articleId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 bg-indigo-500/8 rounded-md px-3 py-1.5"
              >
                <Coins className="w-3.5 h-3.5" />
                Mint as iQube (auto-drive)
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            )}
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to articles
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Preview state ─────────────────────────────────────────────────────
  if (stage === 'preview') {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-semibold text-slate-100">Draft Preview</span>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Draft
            </span>
          </div>
          <button
            onClick={() => setStage('edit')}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to edit
          </button>
        </div>

        <div className="rounded-lg bg-indigo-500/5 border border-indigo-500/20 px-4 py-2 text-xs text-indigo-300">
          <Globe className="inline h-3.5 w-3.5 mr-1.5 opacity-70" />
          Qriptopian → {activeSection.label}
          {campaignTag && <span className="ml-2 opacity-60">· {campaignTag}</span>}
        </div>

        <div className="rounded-xl bg-slate-950/60 ring-1 ring-white/10 overflow-hidden">
          <div className="flex border-b border-white/[0.07]">
            {(['content', 'meta'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActivePreview(tab)}
                className={`px-4 py-2.5 text-xs font-medium capitalize border-b-2 transition-all ${
                  activePreview === tab
                    ? 'text-slate-100 border-rose-500/60'
                    : 'text-slate-500 hover:text-slate-300 border-transparent'
                }`}
              >
                {tab === 'content' ? 'Article Content' : 'Metadata'}
              </button>
            ))}
          </div>
          <div className="p-4 sm:p-5">
            {activePreview === 'content' ? (
              <div className="space-y-4">
                {coverUrl && (
                  <img src={coverUrl} alt="Cover" className="w-full h-40 object-cover rounded-lg" />
                )}
                <h1 className="text-xl font-bold leading-tight text-slate-100">{title || 'Untitled'}</h1>
                {excerpt && (
                  <p className="text-sm italic text-slate-400 border-l-2 border-rose-500/40 pl-3">{excerpt}</p>
                )}
                <div className="pt-2 border-t border-white/[0.07]">
                  <MarkdownPreview body={bodyMd} />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { label: 'Title',    value: title },
                  { label: 'Section',  value: activeSection.label },
                  { label: 'Excerpt',  value: excerpt || '—' },
                  { label: 'Campaign', value: campaignTag || '—' },
                  { label: 'Status',   value: 'Draft' },
                  { label: 'ID',       value: draft?.id ?? initial?.id ?? 'pending' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-3">
                    <span className="text-[10px] uppercase tracking-wide font-semibold w-20 flex-shrink-0 text-slate-500">{label}</span>
                    <span className="text-xs text-slate-300 break-all">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <div className="text-xs text-rose-300 px-1">{error}</div>}

        <button
          onClick={handlePublish}
          disabled={publishing}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60"
        >
          {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {publishing ? 'Publishing…' : 'Publish to Qriptopian'}
        </button>
      </div>
    );
  }

  // ── Edit form ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileEdit className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-slate-100">
            {isEdit ? 'Edit Draft' : 'New Article'}
          </span>
        </div>
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
          <ArrowLeft className="w-3 h-3" />
          Back
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-400 font-medium mb-1 block">Title *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Article title"
            className="w-full bg-slate-900/60 border border-white/10 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 font-medium mb-1 block">Target Section</label>
          <select
            value={section}
            onChange={e => setSection(e.target.value)}
            className="w-full bg-slate-900/60 border border-white/10 text-slate-200 focus:outline-none focus:border-indigo-500/40 rounded-lg px-3 py-2 text-sm"
          >
            {SECTIONS.map(s => <option key={s.slug} value={s.slug}>{s.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-400 font-medium mb-1 block">Body (Markdown) *</label>
          <textarea
            value={bodyMd}
            onChange={e => setBodyMd(e.target.value)}
            rows={10}
            placeholder="Write your article in Markdown…"
            className="w-full bg-slate-900/60 border border-white/10 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 rounded-lg px-3 py-2.5 text-sm resize-none font-mono"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 font-medium mb-1 block">Excerpt</label>
          <input
            value={excerpt}
            onChange={e => setExcerpt(e.target.value)}
            placeholder="Short summary (optional)"
            className="w-full bg-slate-900/60 border border-white/10 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 font-medium mb-1 block">Cover Image URL</label>
          <input
            value={coverUrl}
            onChange={e => setCoverUrl(e.target.value)}
            placeholder="https://…"
            className="w-full bg-slate-900/60 border border-white/10 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 font-medium mb-1 block">Campaign Tag</label>
          <input
            value={campaignTag}
            onChange={e => setCampaignTag(e.target.value)}
            placeholder="e.g. knyt-launch (optional)"
            className="w-full bg-slate-900/60 border border-white/10 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <div className="text-xs text-rose-300 px-1">{error}</div>}

      <button
        onClick={handleSaveDraft}
        disabled={saving || !title.trim() || !bodyMd.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 py-2.5 text-sm font-semibold text-indigo-300 hover:bg-indigo-500/20 disabled:opacity-60"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
        {saving ? 'Saving…' : (isEdit ? 'Save Changes & Preview' : 'Save Draft & Preview')}
      </button>
    </div>
  );
}

// ── Articles list ──────────────────────────────────────────────────────────────

function ArticlesList({
  status,
  onEdit,
}: {
  status: 'draft' | 'published';
  onEdit?: (article: Article) => void;
}) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketa/publish/article?target_codex=qriptopian&status=${status}`);
      const data = await res.json();
      if (data.ok) {
        setArticles(data.articles ?? []);
      } else {
        setError(data.error ?? 'Failed to load');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const handlePublish = async (id: string) => {
    setPublishing(id);
    try {
      const res = await fetch(`/api/marketa/publish/article/${id}/publish`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setArticles(prev => prev.filter(a => a.id !== id));
      }
    } finally {
      setPublishing(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-slate-500">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
    </div>
  );

  if (error) return (
    <div className="py-8 text-center text-sm text-rose-300">{error}</div>
  );

  if (articles.length === 0) return (
    <div className="py-12 text-center text-sm text-slate-500">
      No {status} articles yet.
    </div>
  );

  return (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500">{articles.length} {status}</span>
        <button onClick={load} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>
      {articles.map(article => (
        <div
          key={article.id}
          className="rounded-lg border border-white/[0.07] bg-slate-900/40 px-4 py-3 space-y-2"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{article.title}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {article.structure?.target_section ?? '—'}
                {article.structure?.campaign_tag && ` · ${article.structure.campaign_tag}`}
              </p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${
              article.status === 'published'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
            }`}>
              {article.status}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {status === 'draft' && onEdit && (
              <button
                onClick={() => onEdit(article)}
                className="flex items-center gap-1 text-[11px] text-indigo-300 border border-indigo-500/25 bg-indigo-500/8 rounded-md px-2.5 py-1 hover:bg-indigo-500/15"
              >
                <FileEdit className="w-3 h-3" /> Edit
              </button>
            )}
            {status === 'draft' && (
              <button
                onClick={() => handlePublish(article.id)}
                disabled={publishing === article.id}
                className="flex items-center gap-1 text-[11px] text-emerald-300 border border-emerald-500/25 bg-emerald-500/8 rounded-md px-2.5 py-1 hover:bg-emerald-500/15 disabled:opacity-50"
              >
                {publishing === article.id
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Send className="w-3 h-3" />
                }
                Publish
              </button>
            )}
            {status === 'published' && (
              <a
                href={`/iqube/mint?contentId=${article.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-indigo-300 border border-indigo-500/25 bg-indigo-500/8 rounded-md px-2.5 py-1 hover:bg-indigo-500/15"
              >
                <Coins className="w-3 h-3" /> Mint as iQube
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main tab ───────────────────────────────────────────────────────────────────

export function QriptopianEditTab({ theme = 'dark' }: Props) {
  const [view,        setView]        = useState<View>('new');
  const [editArticle, setEditArticle] = useState<Article | undefined>(undefined);

  const handleEditArticle = (article: Article) => {
    setEditArticle(article);
    setView('new');
  };

  const handleBack = () => {
    setEditArticle(undefined);
    setView('drafts');
  };

  const tabs: { id: View; label: string }[] = [
    { id: 'new',       label: 'New Article' },
    { id: 'drafts',    label: 'Drafts'      },
    { id: 'published', label: 'Published'   },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* View selector */}
      <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4">
        <div className="flex gap-1 py-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setView(tab.id); if (tab.id !== 'new') setEditArticle(undefined); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                view === tab.id
                  ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30 text-indigo-300'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-white/4'
              }`}
            >
              {tab.id === 'new' && editArticle ? 'Editing Draft' : tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {view === 'new' && (
          <ArticleForm
            initial={editArticle}
            onBack={editArticle ? handleBack : () => setView('new')}
          />
        )}
        {view === 'drafts' && (
          <ArticlesList status="draft" onEdit={handleEditArticle} />
        )}
        {view === 'published' && (
          <ArticlesList status="published" />
        )}
      </div>
    </div>
  );
}
