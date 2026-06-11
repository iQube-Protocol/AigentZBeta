"use client";

import { useState, useEffect } from "react";
import {
  ChevronDown, ChevronRight, Save, Loader2, CheckCircle2,
  AlertCircle, Film, Globe, Sparkles, Trophy, X,
} from "lucide-react";
import { cn } from "@/utils/cn";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SequenceItem {
  id: string;
  campaign_id: string;
  day_number: number;
  title: string;
  description?: string;
  thumbnail_url?: string;
  cta_url?: string;
  asset_ref?: string;
  explainer: boolean;
  status: string;
  channels?: string[];
  publish_day?: number;
  reward_knyt?: number;
  reward_trigger?: string;
  nbe_disposition?: string;
  experience_goal_id?: string | null;
  studio_artifact_id?: string | null;
  metaproof_milestone?: string;
}

interface ExperienceGoal {
  id: string;
  title: string;
  goal_type: string;
}

interface Props {
  item: SequenceItem;
  dark: boolean;
  cartridgeContext: string;
  onClose: () => void;
  onSaved: (updated: SequenceItem) => void;
}

const ITEM_STATUSES = ['locked', 'draft', 'available', 'sent', 'viewed', 'clicked', 'completed'] as const;
const NBE_DISPOSITIONS = ['ask', 'act', 'wait', 'escalate', 'deny'] as const;
const REWARD_TRIGGERS = ['share_completed', 'cta_click', 'asset_click', 'sequence_view', 'manual'] as const;
const ALL_CHANNELS = ['x', 'linkedin', 'instagram', 'tiktok', 'newsletter', 'youtube', 'podcast'] as const;

// ── Section accordion ─────────────────────────────────────────────────────────

function Section({
  id, title, icon: Icon, accent, open, onToggle, children, dark,
}: {
  id: string; title: string; icon: React.ElementType; accent: string;
  open: boolean; onToggle: () => void; children: React.ReactNode; dark: boolean;
}) {
  return (
    <div className={cn("rounded-xl border overflow-hidden", dark ? "border-white/[0.07]" : "border-black/[0.07]")}>
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
          dark ? "hover:bg-white/[0.03]" : "hover:bg-black/[0.02]",
        )}
      >
        <Icon className={cn("w-4 h-4 flex-shrink-0", accent)} />
        <span className={cn("text-sm font-semibold flex-1", dark ? "text-white/80" : "text-black/70")}>{title}</span>
        {open
          ? <ChevronDown className={cn("w-4 h-4", dark ? "text-white/30" : "text-black/30")} />
          : <ChevronRight className={cn("w-4 h-4", dark ? "text-white/30" : "text-black/30")} />}
      </button>
      {open && (
        <div className={cn("px-4 pb-4 pt-1 border-t space-y-3", dark ? "border-white/[0.07]" : "border-black/[0.07]")}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-wide font-semibold text-white/30">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, dark, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void; dark: boolean; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-lg border px-3 py-2 text-xs outline-none transition-colors",
        dark
          ? "bg-white/[0.04] border-white/10 text-white/80 placeholder:text-white/20 focus:border-white/20"
          : "bg-white border-black/10 text-black/80 placeholder:text-black/20 focus:border-black/20",
      )}
    />
  );
}

function Select({ value, onChange, dark, options }: {
  value: string; onChange: (v: string) => void; dark: boolean;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-lg border px-3 py-2 text-xs outline-none transition-colors",
        dark
          ? "bg-white/[0.04] border-white/10 text-white/80 focus:border-white/20"
          : "bg-white border-black/10 text-black/80 focus:border-black/20",
      )}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SequenceItemManagePanel({ item, dark, cartridgeContext, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<SequenceItem>({ ...item });
  const [open, setOpen] = useState<Record<string, boolean>>({
    content: false, publishing: false, experience: false, studio: false,
  });
  const [goals, setGoals]   = useState<ExperienceGoal[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  function set<K extends keyof SequenceItem>(k: K, v: SequenceItem[K]) {
    setDraft((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  }

  const toggleSection = (k: string) => setOpen((p) => ({ ...p, [k]: !p[k] }));

  // Load experience goals for this cartridge context
  useEffect(() => {
    fetch(`/api/marketa/experience-goals?cartridge=${encodeURIComponent(cartridgeContext)}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setGoals(d.goals ?? []); })
      .catch(() => {});
  }, [cartridgeContext]);

  async function handleSave() {
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`/api/marketa/sequence-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:                draft.title,
          description:          draft.description,
          thumbnail_url:        draft.thumbnail_url,
          cta_url:              draft.cta_url,
          asset_ref:            draft.asset_ref,
          explainer:            draft.explainer,
          status:               draft.status,
          channels:             draft.channels,
          publish_day:          draft.publish_day,
          reward_knyt:          draft.reward_knyt,
          reward_trigger:       draft.reward_trigger,
          nbe_disposition:      draft.nbe_disposition,
          experience_goal_id:   draft.experience_goal_id || null,
          studio_artifact_id:   draft.studio_artifact_id || null,
          metaproof_milestone:  draft.metaproof_milestone,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaved(true);
        onSaved(data.item);
      } else {
        setErr(data.error ?? 'Save failed');
      }
    } catch {
      setErr('Network error');
    } finally {
      setSaving(false);
    }
  }

  const channelSet = new Set(draft.channels ?? []);
  const toggleChannel = (ch: string) => {
    const next = channelSet.has(ch)
      ? (draft.channels ?? []).filter((c) => c !== ch)
      : [...(draft.channels ?? []), ch];
    set('channels', next);
  };

  return (
    <div className={cn(
      "rounded-xl border mt-2 overflow-hidden",
      dark ? "border-pink-400/20 bg-pink-400/[0.03]" : "border-pink-200 bg-pink-50/40",
    )}>
      {/* Panel header */}
      <div className={cn("flex items-center justify-between px-4 py-2.5 border-b", dark ? "border-pink-400/15" : "border-pink-100")}>
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-pink-300" />
          <span className={cn("text-xs font-semibold", dark ? "text-white/80" : "text-black/70")}>
            Day {item.day_number} — {item.title}
          </span>
        </div>
        <button onClick={onClose} className={cn("p-1 rounded hover:opacity-70", dark ? "text-white/40" : "text-black/40")}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-2">

        {/* ── 1. Content ──────────────────────────────────────────────────── */}
        <Section id="content" title="Content" icon={Film} accent="text-pink-300" open={open.content} onToggle={() => toggleSection('content')} dark={dark}>
          <Field label="Title">
            <Input value={draft.title} onChange={(v) => set('title', v)} dark={dark} />
          </Field>
          <Field label="Description">
            <textarea
              value={draft.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              className={cn("w-full rounded-lg border px-3 py-2 text-xs outline-none resize-none transition-colors", dark ? "bg-white/[0.04] border-white/10 text-white/80 focus:border-white/20" : "bg-white border-black/10 text-black/80 focus:border-black/20")}
            />
          </Field>
          <Field label="Thumbnail URL">
            <Input value={draft.thumbnail_url ?? ''} onChange={(v) => set('thumbnail_url', v)} dark={dark} placeholder="https://…" />
          </Field>
          <Field label="Video / CTA URL">
            <Input value={draft.cta_url ?? ''} onChange={(v) => set('cta_url', v)} dark={dark} placeholder="https://…" />
          </Field>
          <Field label="Asset Ref (Supabase Storage token or URL)">
            <Input value={draft.asset_ref ?? ''} onChange={(v) => set('asset_ref', v)} dark={dark} placeholder="smart_content_qubes:uuid or https://…" />
          </Field>
          <div className="flex items-center gap-4">
            <Field label="Status">
              <Select value={draft.status} onChange={(v) => set('status', v)} dark={dark}
                options={ITEM_STATUSES.map((s) => ({ value: s, label: s }))} />
            </Field>
            <label className="flex items-center gap-2 cursor-pointer mt-3">
              <input type="checkbox" checked={draft.explainer} onChange={(e) => set('explainer', e.target.checked)} className="accent-pink-400" />
              <span className={cn("text-xs", dark ? "text-white/60" : "text-black/60")}>Explainer video</span>
            </label>
          </div>
        </Section>

        {/* ── 2. Publishing ───────────────────────────────────────────────── */}
        <Section id="publishing" title="Publishing" icon={Globe} accent="text-sky-400" open={open.publishing} onToggle={() => toggleSection('publishing')} dark={dark}>
          <Field label="Target Channels">
            <div className="flex flex-wrap gap-2">
              {ALL_CHANNELS.map((ch) => (
                <label key={ch} className={cn(
                  "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors",
                  channelSet.has(ch)
                    ? "border-sky-500/40 bg-sky-500/15 text-sky-300"
                    : (dark ? "border-white/[0.07] text-white/40 hover:border-white/15" : "border-black/[0.07] text-black/40 hover:border-black/15"),
                )}>
                  <input type="checkbox" className="hidden" checked={channelSet.has(ch)} onChange={() => toggleChannel(ch)} />
                  {ch}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Scheduled Day Offset">
            <Input type="number" value={String(draft.publish_day ?? draft.day_number)} onChange={(v) => set('publish_day', parseInt(v) || 0)} dark={dark} placeholder="0" />
          </Field>
        </Section>

        {/* ── 3. Experience & Rewards ─────────────────────────────────────── */}
        <Section id="experience" title="Experience & Rewards" icon={Trophy} accent="text-amber-400" open={open.experience} onToggle={() => toggleSection('experience')} dark={dark}>
          <div className={cn("text-[10px] px-2 py-1 rounded border", dark ? "border-amber-500/20 text-amber-400/70 bg-amber-500/5" : "border-amber-200 text-amber-700 bg-amber-50")}>
            Cartridge context: <span className="font-bold uppercase">{cartridgeContext}</span>
            {goals.length === 0 && " — no experience goals seeded for this cartridge yet"}
          </div>

          <Field label="Experience Goal">
            <Select
              value={draft.experience_goal_id ?? ''}
              onChange={(v) => set('experience_goal_id', v || null)}
              dark={dark}
              options={[
                { value: '', label: goals.length ? '— none —' : '— no goals for this cartridge —' },
                ...goals.map((g) => ({ value: g.id, label: `[${g.goal_type}] ${g.title}` })),
              ]}
            />
          </Field>

          <Field label="NBE Disposition">
            <Select value={draft.nbe_disposition ?? ''} onChange={(v) => set('nbe_disposition', v)} dark={dark}
              options={[{ value: '', label: '— none —' }, ...NBE_DISPOSITIONS.map((d) => ({ value: d, label: d }))]} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Reward Amount (KNYT)">
              <Input type="number" value={String(draft.reward_knyt ?? 0)} onChange={(v) => set('reward_knyt', parseInt(v) || 0)} dark={dark} placeholder="0" />
            </Field>
            <Field label="Reward Trigger">
              <Select value={draft.reward_trigger ?? ''} onChange={(v) => set('reward_trigger', v)} dark={dark}
                options={[{ value: '', label: '— none —' }, ...REWARD_TRIGGERS.map((t) => ({ value: t, label: t }))]} />
            </Field>
          </div>

          <Field label="metaProof Milestone">
            <Input value={draft.metaproof_milestone ?? ''} onChange={(v) => set('metaproof_milestone', v)} dark={dark}
              placeholder='e.g. "Share this content on X by Day 5"' />
          </Field>

          {(draft.reward_knyt ?? 0) > 0 && draft.reward_trigger && (
            <div className={cn("text-[11px] px-3 py-2 rounded-lg border", dark ? "border-amber-500/20 bg-amber-500/5 text-amber-300" : "border-amber-200 bg-amber-50 text-amber-700")}>
              <Trophy className="w-3 h-3 inline mr-1" />
              Partners earn <strong>{draft.reward_knyt} KNYT</strong> when: <em>{draft.reward_trigger.replace('_', ' ')}</em>
            </div>
          )}
        </Section>

        {/* ── 4. Studio ───────────────────────────────────────────────────── */}
        <Section id="studio" title="Studio / experienceQube Link" icon={Sparkles} accent="text-violet-400" open={open.studio} onToggle={() => toggleSection('studio')} dark={dark}>
          <Field label="Studio Artifact ID">
            <Input value={draft.studio_artifact_id ?? ''} onChange={(v) => set('studio_artifact_id', v || null)} dark={dark}
              placeholder="uuid from studio_artifacts table" />
          </Field>
          {draft.cta_url && (
            <a
              href={draft.cta_url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn("inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors", dark ? "border-violet-500/30 text-violet-300 hover:bg-violet-500/10" : "border-violet-200 text-violet-700 hover:bg-violet-50")}
            >
              <Film className="w-3 h-3" />
              Preview Content
            </a>
          )}
        </Section>

        {/* ── Save ────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg border transition-colors disabled:opacity-50",
              dark ? "border-pink-400/40 bg-pink-400/15 text-pink-300 hover:bg-pink-400/25" : "border-pink-300 bg-pink-50 text-pink-600 hover:bg-pink-100",
            )}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Changes
          </button>
          {saved && (
            <span className={cn("flex items-center gap-1 text-xs", dark ? "text-emerald-400" : "text-emerald-600")}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          {err && (
            <span className={cn("flex items-center gap-1 text-xs", dark ? "text-pink-300" : "text-pink-500")}>
              <AlertCircle className="w-3.5 h-3.5" /> {err}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
