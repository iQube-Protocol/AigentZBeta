'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Eye, Loader2, Save, Upload } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Modality = 'read' | 'watch' | 'listen' | 'link';
type ImagePositionPreset = 'Center' | 'Top' | 'Bottom' | 'Left' | 'Right' | 'Top Left' | 'Top Right';

interface ModalitiesData {
  read?:   { available?: boolean; text?: string; duration?: string };
  watch?:  { available?: boolean; video_url?: string; duration?: string; loop?: boolean; loop_video?: boolean };
  listen?: { available?: boolean; audio_url?: string; duration?: string };
  link?:   { available?: boolean; url?: string; allow_embed?: boolean };
}

interface ContentRow {
  id: string;
  title: string;
  excerpt: string | null;
  thumbnail: string | null;
  status: 'draft' | 'published';
  issue_ref: string | null;
  placement: {
    section: string;
    position?: number;
    imageScale?: number;
    imageX?: number;
    imageY?: number;
  } | null;
  modalities: ModalitiesData | null;
  market_data: { pricing_model?: { tiers?: Array<{ amount: number }> } } | null;
}

// ── Image position presets ────────────────────────────────────────────────────

const POSITION_PRESETS: Record<ImagePositionPreset, { x: number; y: number }> = {
  'Center':    { x: 50, y: 50 },
  'Top':       { x: 50, y: 0  },
  'Bottom':    { x: 50, y: 100 },
  'Left':      { x: 0,  y: 50 },
  'Right':     { x: 100, y: 50 },
  'Top Left':  { x: 0,  y: 0  },
  'Top Right': { x: 100, y: 0 },
};

function detectPreset(x: number, y: number): ImagePositionPreset {
  for (const [name, vals] of Object.entries(POSITION_PRESETS)) {
    if (vals.x === x && vals.y === y) return name as ImagePositionPreset;
  }
  return 'Center';
}

// ── Live Preview Card ─────────────────────────────────────────────────────────

function LivePreview({
  title, excerpt, thumbnail, imageScale, imageX, imageY,
  modalities,
}: {
  title: string; excerpt: string; thumbnail: string;
  imageScale: number; imageX: number; imageY: number;
  modalities: ModalitiesData;
}) {
  const chips: string[] = [];
  if (modalities.read?.available)   chips.push('Read');
  if (modalities.watch?.available)  chips.push('Watch');
  if (modalities.listen?.available) chips.push('Listen');
  if (modalities.link?.available)   chips.push('Link');

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0d1520]">
      {thumbnail ? (
        <div className="relative h-36 overflow-hidden">
          <img
            src={thumbnail}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              objectPosition: `${imageX}% ${imageY}%`,
              transform: `scale(${imageScale / 100 + 0.5})`,
              transformOrigin: `${imageX}% ${imageY}%`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-sm font-bold leading-tight text-white line-clamp-2">{title || 'Article title'}</p>
            {excerpt && <p className="mt-1 text-xs text-gray-300 line-clamp-2">{excerpt}</p>}
          </div>
        </div>
      ) : (
        <div className="p-3">
          <p className="text-sm font-bold text-white">{title || 'Article title'}</p>
          {excerpt && <p className="mt-1 text-xs text-gray-400">{excerpt}</p>}
        </div>
      )}
      {chips.length > 0 && (
        <div className="flex gap-1.5 px-3 pb-3 pt-2">
          {chips.map((c) => (
            <span key={c} className="rounded-full bg-teal-900/50 px-2.5 py-0.5 text-xs font-medium text-teal-300">
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Slider ────────────────────────────────────────────────────────────────────

function Slider({ label, value, onChange, hint }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-sm text-gray-300">{label}</label>
        <span className="text-sm font-medium text-white">{value}%</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-teal-400"
      />
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-300">
        {label}{required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT = 'w-full rounded-lg border border-gray-700 bg-[#0d1520] px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-teal-500 focus:outline-none';

// ── Main ──────────────────────────────────────────────────────────────────────

export default function EditArticlePage() {
  const params       = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const isNew        = params.id === 'new';
  const defaultSection = searchParams.get('section') ?? 'home-hero';

  // form state
  const [title,         setTitle]         = useState('');
  const [excerpt,       setExcerpt]       = useState('');
  const [issueRef,      setIssueRef]      = useState('');
  const [position,      setPosition]      = useState(1);
  const [thumbnail,     setThumbnail]     = useState('');
  const [section,       setSection]       = useState(defaultSection);
  const [modalities,    setModalities]    = useState<ModalitiesData>({ read: { available: true, text: '' } });
  const [activeTab,     setActiveTab]     = useState<Modality>('read');
  const [qPrice,        setQPrice]        = useState(0);
  const [imageScale,    setImageScale]    = useState(100);
  const [imageX,        setImageX]        = useState(50);
  const [imageY,        setImageY]        = useState(50);
  const [imgPosition,   setImgPosition]   = useState<ImagePositionPreset>('Center');
  const [status,        setStatus]        = useState<'draft' | 'published'>('draft');

  const [loading,   setLoading]   = useState(!isNew);
  const [saving,    setSaving]    = useState(false);
  const [publishing,setPublishing] = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Load existing article
  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const res  = await fetch(`/api/admin/content/${params.id}`);
      const json = await res.json() as { data?: ContentRow; error?: string };
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Not found');
      const d = json.data;
      setTitle(d.title ?? '');
      setExcerpt(d.excerpt ?? '');
      setIssueRef(d.issue_ref ?? '');
      setPosition(d.placement?.position ?? 1);
      setThumbnail(d.thumbnail ?? '');
      setSection(d.placement?.section ?? defaultSection);
      setModalities(d.modalities ?? { read: { available: true, text: '' } });
      setStatus(d.status ?? 'draft');
      setImageScale(d.placement?.imageScale ?? 100);
      const x = d.placement?.imageX ?? 50;
      const y = d.placement?.imageY ?? 50;
      setImageX(x);
      setImageY(y);
      setImgPosition(detectPreset(x, y));
      setQPrice(d.market_data?.pricing_model?.tiers?.[0]?.amount ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [isNew, params.id, defaultSection]);

  useEffect(() => { void load(); }, [load]);

  // Sync position preset → sliders
  const handlePositionPreset = (preset: ImagePositionPreset) => {
    setImgPosition(preset);
    setImageX(POSITION_PRESETS[preset].x);
    setImageY(POSITION_PRESETS[preset].y);
  };

  const toggleModality = (m: Modality) => {
    setModalities((prev) => ({
      ...prev,
      [m]: { ...(prev[m] ?? {}), available: !prev[m]?.available },
    }));
  };

  const patchModality = (m: Modality, field: string, value: unknown) => {
    setModalities((prev) => ({
      ...prev,
      [m]: { ...(prev[m] ?? { available: true }), [field]: value },
    }));
  };

  const buildPayload = (newStatus?: 'draft' | 'published') => ({
    title:       title.trim(),
    excerpt:     excerpt.trim() || null,
    thumbnail:   thumbnail.trim() || null,
    issue_ref:   issueRef.trim() || null,
    status:      newStatus ?? status,
    modalities,
    placement: { section, position, imageScale, imageX, imageY },
    market_data: qPrice > 0
      ? { pricing_model: { tiers: [{ amount: qPrice }] } }
      : null,
  });

  const save = async (newStatus?: 'draft' | 'published') => {
    if (!title.trim()) { setError('Title is required'); return; }
    const isSavingPublish = newStatus === 'published';
    if (isSavingPublish) setPublishing(true); else setSaving(true);
    setError(null);
    try {
      const payload = buildPayload(newStatus);
      let res: Response;
      if (isNew) {
        res = await fetch('/api/admin/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, domain: 'qriptopian', type: 'article', format: 'article' }),
        });
      } else {
        res = await fetch(`/api/admin/content/${params.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      const json = await res.json() as { data?: { id: string }; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (isNew && json.data?.id) {
        router.replace(`/admin/content/edit/${json.data.id}`);
      } else {
        setStatus(newStatus ?? status);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0d14]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0d14] px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/content/${section}`}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-[#1e2a3a] hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{isNew ? 'New Article' : 'Edit Article'}</h1>
            <p className="text-sm text-gray-400">Section: {section}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/content/${section}`}
            target="_blank"
            className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:border-gray-500 hover:text-white"
          >
            <Eye className="h-4 w-4" />
            Preview on Site
          </Link>
          <button
            type="button"
            onClick={() => void save('draft')}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4 text-teal-400" /> : <Save className="h-4 w-4" />}
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => void save('published')}
            disabled={publishing}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Publish
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">
        {/* Left column */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Basic fields */}
          <div className="rounded-xl border border-white/5 bg-[#141927] p-5 space-y-4">
            <Field label="Title" required>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title"
                className={INPUT}
              />
            </Field>

            <Field label="Excerpt">
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={3}
                placeholder="Brief description shown in listings"
                className={INPUT}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Issue Reference">
                <input
                  type="text"
                  value={issueRef}
                  onChange={(e) => setIssueRef(e.target.value)}
                  placeholder="e.g. 1"
                  className={INPUT}
                />
              </Field>

              <Field label="Display Position" required>
                <input
                  type="number"
                  value={position}
                  onChange={(e) => setPosition(Math.max(1, Number(e.target.value)))}
                  min={1}
                  className={INPUT}
                />
                <p className="mt-1 text-xs text-gray-500">Lower numbers appear first in the section</p>
              </Field>
            </div>

            <Field label="Thumbnail URL">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={thumbnail}
                  onChange={(e) => setThumbnail(e.target.value)}
                  placeholder="https://..."
                  className={`${INPUT} flex-1`}
                />
                <button type="button" className="rounded-lg border border-gray-700 p-2.5 text-gray-400 hover:text-white">
                  <Upload className="h-4 w-4" />
                </button>
              </div>
            </Field>
          </div>

          {/* Content Modalities */}
          <div className="rounded-xl border border-white/5 bg-[#141927] p-5">
            <h2 className="mb-4 text-base font-semibold text-white">Content Modalities</h2>

            {/* Tab switcher */}
            <div className="mb-5 grid grid-cols-4 gap-1 rounded-lg bg-[#0d1520] p-1">
              {(['read', 'watch', 'listen', 'link'] as Modality[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setActiveTab(m)}
                  className={`rounded-md py-2 text-sm font-medium capitalize transition-colors ${
                    activeTab === m
                      ? 'bg-[#1e2a3a] text-white'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>

            {/* Read tab */}
            {activeTab === 'read' && (
              <div className="space-y-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-300">Article Content</label>
                    <button type="button" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
                      <Eye className="h-3.5 w-3.5" />
                      Preview Article
                    </button>
                  </div>
                  <textarea
                    value={modalities.read?.text ?? ''}
                    onChange={(e) => patchModality('read', 'text', e.target.value)}
                    rows={12}
                    placeholder="Supports Markdown and HTML tables/links. Scripts are automatically sanitized."
                    className={`${INPUT} font-mono text-xs`}
                    onFocus={() => { if (!modalities.read?.available) toggleModality('read'); }}
                  />
                  <p className="mt-1 text-xs text-gray-500">Supports Markdown and HTML tables/links. Scripts are automatically sanitized.</p>
                </div>
                <Field label="Read Duration (auto-calculated)">
                  <input
                    type="text"
                    value={modalities.read?.duration ?? ''}
                    onChange={(e) => patchModality('read', 'duration', e.target.value)}
                    placeholder="e.g., 7 min read"
                    className={INPUT}
                  />
                </Field>
              </div>
            )}

            {/* Watch tab */}
            {activeTab === 'watch' && (
              <div className="space-y-4">
                <Field label="Video URL">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={modalities.watch?.video_url ?? ''}
                      onChange={(e) => { patchModality('watch', 'video_url', e.target.value); if (!modalities.watch?.available) toggleModality('watch'); }}
                      placeholder="https://..."
                      className={`${INPUT} flex-1`}
                    />
                    <button type="button" className="rounded-lg border border-gray-700 p-2.5 text-gray-400 hover:text-white">
                      <Upload className="h-4 w-4" />
                    </button>
                  </div>
                </Field>
                <Field label="Watch Duration (auto-detected)">
                  <input
                    type="text"
                    value={modalities.watch?.duration ?? ''}
                    onChange={(e) => patchModality('watch', 'duration', e.target.value)}
                    placeholder="0:09"
                    className={INPUT}
                  />
                </Field>
                <div className="flex items-center justify-between rounded-lg border border-gray-700 bg-[#0d1520] px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">Loop Video</p>
                    <p className="text-xs text-gray-400">Video will restart automatically when it ends</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => patchModality('watch', 'loop', !modalities.watch?.loop)}
                    className={`relative h-6 w-11 rounded-full transition-colors ${modalities.watch?.loop ? 'bg-teal-500' : 'bg-gray-700'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${modalities.watch?.loop ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            )}

            {/* Listen tab */}
            {activeTab === 'listen' && (
              <div className="space-y-4">
                <Field label="Audio URL">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={modalities.listen?.audio_url ?? ''}
                      onChange={(e) => { patchModality('listen', 'audio_url', e.target.value); if (!modalities.listen?.available) toggleModality('listen'); }}
                      placeholder="Direct audio file URL or podcast link"
                      className={`${INPUT} flex-1`}
                    />
                    <button type="button" className="rounded-lg border border-gray-700 p-2.5 text-gray-400 hover:text-white">
                      <Upload className="h-4 w-4" />
                    </button>
                  </div>
                </Field>
                <Field label="Listen Duration (auto-detected)">
                  <input
                    type="text"
                    value={modalities.listen?.duration ?? ''}
                    onChange={(e) => patchModality('listen', 'duration', e.target.value)}
                    placeholder="e.g., 10:45"
                    className={INPUT}
                  />
                </Field>
              </div>
            )}

            {/* Link tab */}
            {activeTab === 'link' && (
              <div className="space-y-4">
                <Field label="Website URL">
                  <input
                    type="url"
                    value={modalities.link?.url ?? ''}
                    onChange={(e) => { patchModality('link', 'url', e.target.value); if (!modalities.link?.available) toggleModality('link'); }}
                    placeholder="https://example.com/article"
                    className={INPUT}
                  />
                  <p className="mt-1 text-xs text-gray-500">External website to display or link to</p>
                </Field>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={modalities.link?.allow_embed ?? false}
                    onChange={(e) => patchModality('link', 'allow_embed', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-800 accent-teal-400"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">Allow embedding in iframe</p>
                    <p className="text-xs text-gray-400">If unchecked, will open in a new tab instead of embedding</p>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-72 shrink-0 space-y-4">
          {/* Pricing */}
          <div className="rounded-xl border border-white/5 bg-[#141927] p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Pricing</h3>
            <label className="mb-1.5 block text-sm text-gray-300">Q¢ Price</label>
            <input
              type="number"
              value={qPrice}
              onChange={(e) => setQPrice(Math.max(0, Number(e.target.value)))}
              min={0}
              placeholder="0 = free"
              className={INPUT}
            />
            <p className="mt-2 text-xs text-gray-500">Set a Q¢ price to gate this content. Leave at 0 or empty for free access.</p>
          </div>

          {/* Image Positioning */}
          <div className="rounded-xl border border-white/5 bg-[#141927] p-4 space-y-4">
            <h3 className="text-sm font-semibold text-white">Image Positioning</h3>

            <div>
              <label className="mb-1.5 block text-sm text-gray-300">Image Position</label>
              <select
                value={imgPosition}
                onChange={(e) => handlePositionPreset(e.target.value as ImagePositionPreset)}
                className={INPUT}
              >
                {Object.keys(POSITION_PRESETS).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <Slider
              label={`Image Scale (${imageScale}%)`}
              value={imageScale}
              onChange={setImageScale}
            />
            <Slider
              label={`Horizontal (${imageX}%)`}
              value={imageX}
              onChange={(v) => { setImageX(v); setImgPosition(detectPreset(v, imageY)); }}
              hint="0=left, 50=center, 100=right"
            />
            <Slider
              label={`Vertical (${imageY}%)`}
              value={imageY}
              onChange={(v) => { setImageY(v); setImgPosition(detectPreset(imageX, v)); }}
              hint="0=top, 50=center, 100=bottom"
            />
          </div>

          {/* Live Preview */}
          <div className="rounded-xl border border-white/5 bg-[#141927] p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Live Preview</h3>
            <LivePreview
              title={title}
              excerpt={excerpt}
              thumbnail={thumbnail}
              imageScale={imageScale}
              imageX={imageX}
              imageY={imageY}
              modalities={modalities}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
