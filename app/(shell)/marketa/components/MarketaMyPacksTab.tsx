'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Package, ArrowLeft, Loader2, RefreshCcw, Trophy, Target,
  FileText, Send, CheckCircle2, ChevronRight, Sparkles,
  ExternalLink, AlertCircle, Clock, ThumbsUp, XCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { PartnerJourneySteps, JourneyStep } from './PartnerJourneySteps';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CopyVariant {
  channel: string;
  subject?: string;
  body: string;
}

interface RewardEstimate {
  knyt: number;
  qc: number;
}

interface PartnerPack {
  id: string;
  name: string;
  tagline?: string;
  status: string;
  reward_estimate?: RewardEstimate;
  campaign_fit_score?: number;
  objectives?: string[];
  milestones?: string[];
  copy_variants?: CopyVariant[];
  admin_notes?: string;
  created_at: string;
  approved_at?: string;
}

interface Props {
  theme?: 'light' | 'dark';
  partnerId?: string;
  personaId?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; darkColor: string; icon: React.ElementType }> = {
  approved:       { label: 'Approved',       color: 'text-emerald-600 bg-emerald-50 border-emerald-200',        darkColor: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',   icon: ThumbsUp },
  pending_review: { label: 'In Review',      color: 'text-amber-600 bg-amber-50 border-amber-200',              darkColor: 'text-amber-300 bg-amber-500/15 border-amber-500/30',         icon: Clock },
  draft:          { label: 'Draft',          color: 'text-slate-600 bg-slate-100 border-slate-300',             darkColor: 'text-slate-400 bg-slate-700/40 border-slate-600',            icon: FileText },
  declined:       { label: 'Declined',       color: 'text-red-600 bg-red-50 border-red-200',                    darkColor: 'text-red-400 bg-red-500/15 border-red-500/30',               icon: XCircle },
};

function StatusBadge({ status, dark }: { status: string; dark: boolean }) {
  const meta = STATUS_META[status] ?? { label: status, color: 'text-slate-500 bg-slate-100 border-slate-200', darkColor: 'text-slate-400 bg-slate-700/40 border-slate-600', icon: AlertCircle };
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border', dark ? meta.darkColor : meta.color)}>
      <Icon className="w-2.5 h-2.5" />
      {meta.label}
    </span>
  );
}

// ── Pack catalog card ──────────────────────────────────────────────────────────

function PackCatalogCard({
  pack, dark, onSelect,
}: {
  pack: PartnerPack;
  dark: boolean;
  onSelect: () => void;
}) {
  const isApproved = pack.status === 'approved';

  return (
    <div
      className={cn(
        'rounded-xl border transition-all cursor-pointer group',
        isApproved
          ? (dark ? 'border-pink-400/30 bg-pink-400/5 hover:bg-pink-400/10' : 'border-pink-300 bg-pink-50/50 hover:bg-pink-50')
          : (dark ? 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]' : 'border-black/[0.06] bg-white hover:bg-black/[0.02]'),
      )}
      onClick={onSelect}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className={cn('font-semibold text-sm truncate', dark ? 'text-white/90' : 'text-black/80')}>
              {pack.name}
            </p>
            {pack.tagline && (
              <p className={cn('text-xs italic mt-0.5', dark ? 'text-white/40' : 'text-black/40')}>
                {pack.tagline}
              </p>
            )}
          </div>
          <StatusBadge status={pack.status} dark={dark} />
        </div>

        {/* Chips row */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {pack.campaign_fit_score != null && (
            <span className={cn('inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border', dark ? 'bg-violet-500/10 text-violet-300 border-violet-500/20' : 'bg-violet-50 text-violet-700 border-violet-200')}>
              <Sparkles className="w-2.5 h-2.5" />
              {pack.campaign_fit_score}% fit
            </span>
          )}
          {pack.reward_estimate && pack.reward_estimate.knyt > 0 && (
            <span className={cn('inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md border', dark ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200')}>
              <Trophy className="w-2.5 h-2.5" />
              {pack.reward_estimate.knyt.toLocaleString()} KNYT
            </span>
          )}
          {pack.copy_variants && pack.copy_variants.length > 0 && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md border', dark ? 'text-white/30 border-white/[0.06] bg-white/[0.03]' : 'text-black/30 border-black/[0.06] bg-black/[0.02]')}>
              {pack.copy_variants.length} copy variant{pack.copy_variants.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* First objective preview */}
        {pack.objectives && pack.objectives.length > 0 && (
          <p className={cn('text-xs line-clamp-2 mb-3', dark ? 'text-white/50' : 'text-black/50')}>
            {pack.objectives[0]}
          </p>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-2">
          <button
            className={cn(
              'flex-1 text-xs py-1.5 rounded-lg border text-center transition-colors',
              dark ? 'border-white/10 text-white/50 hover:text-white/80 hover:border-white/20' : 'border-black/10 text-black/40 hover:text-black/70',
            )}
          >
            View Content Pack
          </button>
          {isApproved && (
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(); }}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg border border-pink-400/50 bg-pink-400/20 hover:bg-pink-400/30 text-pink-300 transition-colors backdrop-blur-sm"
            >
              <Send className="w-3 h-3" />
              Publish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Copy variant card ──────────────────────────────────────────────────────────

function CopyVariantCard({ variant, dark }: { variant: CopyVariant; dark: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const CHANNEL_COLOR: Record<string, string> = {
    x: 'text-sky-400', twitter: 'text-sky-400',
    linkedin: 'text-blue-400',
    instagram: 'text-pink-400',
    newsletter: 'text-violet-400',
    youtube: 'text-pink-300',
    tiktok: 'text-cyan-400',
    podcast: 'text-orange-400',
  };
  const channelColor = CHANNEL_COLOR[variant.channel.toLowerCase()] ?? 'text-white/60';

  return (
    <div className={cn('rounded-xl border overflow-hidden', dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-black/[0.06] bg-white')}>
      <button
        className="w-full flex items-center justify-between p-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className={cn('text-xs font-bold uppercase tracking-widest', dark ? channelColor : channelColor.replace('400', '600'))}>
            {variant.channel}
          </span>
          {variant.subject && (
            <span className={cn('text-xs truncate max-w-[200px]', dark ? 'text-white/60' : 'text-black/60')}>
              {variant.subject}
            </span>
          )}
        </div>
        <ChevronRight className={cn('w-4 h-4 transition-transform flex-shrink-0', dark ? 'text-white/30' : 'text-black/30', expanded && 'rotate-90')} />
      </button>
      {expanded && (
        <div className={cn('px-4 pb-4 border-t', dark ? 'border-white/[0.06]' : 'border-black/[0.06]')}>
          {variant.subject && (
            <p className={cn('text-xs font-semibold pt-3 mb-1', dark ? 'text-white/70' : 'text-black/70')}>{variant.subject}</p>
          )}
          <p className={cn('text-xs leading-relaxed whitespace-pre-wrap', dark ? 'text-white/50' : 'text-black/50')}>{variant.body}</p>
        </div>
      )}
    </div>
  );
}

// ── Pack detail view ──────────────────────────────────────────────────────────

type DetailTab = 'overview' | 'copy' | 'details';

function PackDetailView({
  pack, dark, onBack, partnerId,
}: {
  pack: PartnerPack;
  dark: boolean;
  onBack: () => void;
  partnerId?: string;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const DETAIL_TABS: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'copy', label: `Copy Variants${pack.copy_variants?.length ? ` (${pack.copy_variants.length})` : ''}` },
    { id: 'details', label: 'Details' },
  ];

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await fetch(`/api/marketa/packs/${pack.id}/publish-partner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partner_id: partnerId }),
      });
      setPublished(true);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className={cn('p-1.5 rounded-lg border transition-colors', dark ? 'border-white/10 text-white/50 hover:text-white/90 hover:border-white/20' : 'border-black/10 text-black/40 hover:text-black/70')}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={cn('font-bold text-base truncate', dark ? 'text-white/90' : 'text-black/80')}>
              {pack.name}
            </h2>
            <StatusBadge status={pack.status} dark={dark} />
          </div>
          {pack.tagline && (
            <p className={cn('text-xs italic', dark ? 'text-white/40' : 'text-black/40')}>{pack.tagline}</p>
          )}
        </div>
      </div>

      {/* Admin notes (if declined or has notes) */}
      {pack.admin_notes && (
        <div className={cn('rounded-xl border p-3', dark ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-200 bg-amber-50')}>
          <p className={cn('text-xs font-semibold mb-1', dark ? 'text-amber-300' : 'text-amber-700')}>Feedback from Marketa</p>
          <p className={cn('text-xs', dark ? 'text-amber-300/80' : 'text-amber-700/80')}>{pack.admin_notes}</p>
        </div>
      )}

      {/* Tabs */}
      <div className={cn('flex gap-1 p-1 rounded-xl', dark ? 'bg-white/[0.04]' : 'bg-black/[0.04]')}>
        {DETAIL_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'flex-1 text-xs py-1.5 rounded-lg font-medium transition-all',
              activeTab === t.id
                ? (dark ? 'bg-white/10 text-white/90' : 'bg-white text-black/80 shadow-sm')
                : (dark ? 'text-white/40 hover:text-white/60' : 'text-black/40 hover:text-black/60'),
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Reward + fit */}
          {(pack.reward_estimate || pack.campaign_fit_score != null) && (
            <div className="grid grid-cols-2 gap-3">
              {pack.reward_estimate && (
                <div className={cn('rounded-xl border p-3', dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-black/[0.06] bg-white')}>
                  <p className={cn('text-[10px] uppercase tracking-wide mb-1', dark ? 'text-white/30' : 'text-black/30')}>Reward Estimate</p>
                  <p className={cn('text-lg font-bold', dark ? 'text-amber-300' : 'text-amber-600')}>
                    {pack.reward_estimate.knyt.toLocaleString()}
                    <span className={cn('text-xs ml-1 font-normal', dark ? 'text-white/50' : 'text-black/50')}>KNYT</span>
                  </p>
                  {pack.reward_estimate.qc > 0 && (
                    <p className={cn('text-xs', dark ? 'text-violet-300' : 'text-violet-600')}>+ {pack.reward_estimate.qc.toLocaleString()} Qc</p>
                  )}
                </div>
              )}
              {pack.campaign_fit_score != null && (
                <div className={cn('rounded-xl border p-3', dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-black/[0.06] bg-white')}>
                  <p className={cn('text-[10px] uppercase tracking-wide mb-1', dark ? 'text-white/30' : 'text-black/30')}>Campaign Fit</p>
                  <p className={cn('text-lg font-bold', dark ? 'text-violet-300' : 'text-violet-600')}>
                    {pack.campaign_fit_score}
                    <span className={cn('text-xs ml-0.5 font-normal', dark ? 'text-white/50' : 'text-black/50')}>%</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Objectives */}
          {pack.objectives && pack.objectives.length > 0 && (
            <div className={cn('rounded-xl border p-4', dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-black/[0.06] bg-white')}>
              <div className={cn('flex items-center gap-2 mb-3', dark ? 'text-white/50' : 'text-black/50')}>
                <Target className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase tracking-widest font-semibold">Objectives</span>
              </div>
              <ul className="space-y-2">
                {pack.objectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5', dark ? 'bg-pink-400/20 text-pink-300' : 'bg-pink-100 text-pink-500')}>
                      {i + 1}
                    </span>
                    <span className={cn('text-xs leading-relaxed', dark ? 'text-white/70' : 'text-black/70')}>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Milestones */}
          {pack.milestones && pack.milestones.length > 0 && (
            <div className={cn('rounded-xl border p-4', dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-black/[0.06] bg-white')}>
              <div className={cn('flex items-center gap-2 mb-3', dark ? 'text-white/50' : 'text-black/50')}>
                <Trophy className="w-3.5 h-3.5" />
                <span className="text-[10px] uppercase tracking-widest font-semibold">Milestones</span>
              </div>
              <ul className="space-y-2">
                {pack.milestones.map((m, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className={cn('w-3.5 h-3.5 flex-shrink-0 mt-0.5', dark ? 'text-emerald-400' : 'text-emerald-600')} />
                    <span className={cn('text-xs leading-relaxed', dark ? 'text-white/70' : 'text-black/70')}>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Publish action */}
          {pack.status === 'approved' && (
            <div className={cn('rounded-xl border p-4', dark ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50')}>
              <p className={cn('text-xs font-semibold mb-3', dark ? 'text-emerald-300' : 'text-emerald-700')}>
                This content pack is approved — ready to publish to your channels.
              </p>
              <div className="flex gap-2">
                {published ? (
                  <span className={cn('flex items-center gap-1.5 text-xs', dark ? 'text-emerald-400' : 'text-emerald-600')}>
                    <CheckCircle2 className="w-4 h-4" />
                    Sent to your channels
                  </span>
                ) : (
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg border border-pink-400/50 bg-pink-400/20 hover:bg-pink-400/30 text-pink-300 transition-colors disabled:opacity-60 backdrop-blur-sm"
                  >
                    {publishing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    Publish to My Channels
                  </button>
                )}
                <a
                  href={`/api/marketa/packs/${pack.id}/download`}
                  download
                  className={cn('flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg border transition-colors', dark ? 'border-white/10 text-white/50 hover:text-white/80' : 'border-black/10 text-black/40 hover:text-black/70')}
                >
                  <ExternalLink className="w-3 h-3" />
                  Download
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Copy variants tab */}
      {activeTab === 'copy' && (
        <div className="space-y-2">
          {(!pack.copy_variants || pack.copy_variants.length === 0) ? (
            <div className={cn('rounded-xl border p-8 text-center', dark ? 'border-white/[0.06]' : 'border-black/[0.06]')}>
              <FileText className={cn('w-6 h-6 mx-auto mb-2', dark ? 'text-white/20' : 'text-black/20')} />
              <p className={cn('text-xs', dark ? 'text-white/40' : 'text-black/40')}>No copy variants yet.</p>
            </div>
          ) : (
            pack.copy_variants.map((cv, i) => (
              <CopyVariantCard key={i} variant={cv} dark={dark} />
            ))
          )}
        </div>
      )}

      {/* Details tab */}
      {activeTab === 'details' && (
        <div className={cn('rounded-xl border divide-y', dark ? 'border-white/[0.06] divide-white/[0.06]' : 'border-black/[0.06] divide-black/[0.06]')}>
          {[
            { label: 'Content Pack ID', value: pack.id },
            { label: 'Status', value: pack.status.replace('_', ' ') },
            { label: 'Created', value: new Date(pack.created_at).toLocaleDateString() },
            ...(pack.approved_at ? [{ label: 'Approved', value: new Date(pack.approved_at).toLocaleDateString() }] : []),
            ...(pack.copy_variants ? [{ label: 'Copy Variants', value: `${pack.copy_variants.length}` }] : []),
            ...(pack.objectives ? [{ label: 'Objectives', value: `${pack.objectives.length}` }] : []),
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3">
              <span className={cn('text-xs', dark ? 'text-white/40' : 'text-black/40')}>{label}</span>
              <span className={cn('text-xs font-medium', dark ? 'text-white/70' : 'text-black/70')}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MarketaMyPacksTab({ theme = 'dark', partnerId, personaId }: Props) {
  const dark = theme === 'dark';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [packs, setPacks] = useState<PartnerPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [catalogTab, setCatalogTab] = useState<'all' | 'approved' | 'review'>('all');

  const load = useCallback(async () => {
    if (!partnerId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/marketa/packs/partner/${partnerId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok) setPacks(data.packs ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => { load(); }, [load]);

  const navigateToTab = (slug: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', slug);
    router.push(`${pathname}?${params.toString()}`);
  };

  const selectedPack = selectedId ? packs.find((p) => p.id === selectedId) ?? null : null;

  const approvedPacks = packs.filter((p) => p.status === 'approved');
  const reviewPacks   = packs.filter((p) => p.status === 'pending_review' || p.status === 'draft');
  const displayedPacks =
    catalogTab === 'approved' ? approvedPacks :
    catalogTab === 'review'   ? reviewPacks   :
    packs;

  const journeyStep: JourneyStep =
    approvedPacks.length > 0  ? 4 :
    reviewPacks.length > 0    ? 3 :
    packs.length > 0          ? 3 :
    2;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="w-6 h-6 animate-spin text-pink-300" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-5">

      {selectedPack ? (
        <PackDetailView
          pack={selectedPack}
          dark={dark}
          onBack={() => setSelectedId(null)}
          partnerId={partnerId}
        />
      ) : (
        <>
          {/* Catalog header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className={cn('text-lg font-bold', dark ? 'text-white/90' : 'text-black/80')}>My Content Packs</h1>
              <p className={cn('text-xs mt-0.5', dark ? 'text-white/40' : 'text-black/40')}>
                Content packs built by Marketa AI to align your brand with the campaign.
              </p>
            </div>
            <button
              onClick={() => navigateToTab('propose-campaign')}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-pink-400/50 bg-pink-400/20 hover:bg-pink-400/30 text-pink-300 transition-colors whitespace-nowrap flex-shrink-0 backdrop-blur-sm"
            >
              <Sparkles className="w-3 h-3" />
              Propose Content Pack
            </button>
          </div>

          {/* Journey stepper */}
          <PartnerJourneySteps currentStep={journeyStep} dark={dark} />

          {/* Info card */}
          <div className={cn('rounded-xl border p-3 flex items-center justify-between', dark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-black/[0.06] bg-black/[0.02]')}>
            <p className={cn('text-xs', dark ? 'text-white/40' : 'text-black/40')}>
              Content packs are built by Marketa AI to align your brand voice with the campaign. Once approved, publish directly to your channels.
            </p>
            <button
              onClick={() => navigateToTab('my-campaign')}
              className={cn('text-xs flex items-center gap-1 ml-3 whitespace-nowrap', dark ? 'text-pink-300 hover:text-pink-300' : 'text-pink-500 hover:text-pink-600')}
            >
              Campaigns <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Catalog tabs */}
          <div className={cn('flex gap-1 p-1 rounded-xl', dark ? 'bg-white/[0.04]' : 'bg-black/[0.04]')}>
            {([
              { id: 'all',      label: `All (${packs.length})` },
              { id: 'approved', label: `Approved (${approvedPacks.length})` },
              { id: 'review',   label: `In Review (${reviewPacks.length})` },
            ] as const).map((t) => (
              <button
                key={t.id}
                onClick={() => setCatalogTab(t.id)}
                className={cn(
                  'flex-1 text-xs py-1.5 rounded-lg font-medium transition-all',
                  catalogTab === t.id
                    ? (dark ? 'bg-white/10 text-white/90' : 'bg-white text-black/80 shadow-sm')
                    : (dark ? 'text-white/40 hover:text-white/60' : 'text-black/40 hover:text-black/60'),
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <div className="flex justify-end">
            <button
              onClick={load}
              className={cn('flex items-center gap-1 text-xs', dark ? 'text-white/30 hover:text-white/60' : 'text-black/30 hover:text-black/60')}
            >
              <RefreshCcw className="w-3 h-3" />
              Refresh
            </button>
          </div>

          {/* Grid */}
          {displayedPacks.length === 0 ? (
            <div className={cn('rounded-xl border p-10 text-center', dark ? 'border-white/[0.06]' : 'border-black/[0.06]')}>
              <Package className={cn('w-8 h-8 mx-auto mb-3', dark ? 'text-white/20' : 'text-black/20')} />
              <p className={cn('text-sm mb-1', dark ? 'text-white/50' : 'text-black/50')}>No content packs yet.</p>
              <p className={cn('text-xs', dark ? 'text-white/30' : 'text-black/30')}>
                Use &ldquo;Propose Content Pack&rdquo; to create your first content pack.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayedPacks.map((pack) => (
                <PackCatalogCard
                  key={pack.id}
                  pack={pack}
                  dark={dark}
                  onSelect={() => setSelectedId(pack.id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
