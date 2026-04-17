'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Package, Loader2, RefreshCcw, ChevronDown, ChevronRight, Trophy,
  Send, CheckCircle2, Target, FileText, ExternalLink,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface PartnerPack {
  id: string;
  name: string;
  tagline?: string;
  status: string;
  reward_estimate?: { knyt: number; qc: number };
  campaign_fit_score?: number;
  objectives?: string[];
  copy_variants?: Array<{ channel: string; subject?: string; body: string }>;
  created_at: string;
  approved_at?: string;
}

interface Props {
  theme?: 'light' | 'dark';
  partnerId?: string;
}

function th(d: boolean) {
  return {
    card:        d ? 'bg-slate-950/60 ring-1 ring-white/10 shadow-xl' : 'bg-white border border-slate-200 shadow-sm',
    innerCard:   d ? 'bg-slate-900/60 border border-white/[0.07]' : 'bg-slate-50 border border-slate-200',
    textPrimary: d ? 'text-slate-100' : 'text-slate-900',
    textSecondary:d ? 'text-slate-300' : 'text-slate-700',
    textMuted:   d ? 'text-slate-400' : 'text-slate-600',
    textSubtle:  d ? 'text-slate-500' : 'text-slate-400',
    divider:     d ? 'border-white/[0.07]' : 'border-slate-200',
    statusBadge: (status: string) => {
      if (status === 'approved')       return d ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
      if (status === 'pending_review') return d ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-700 border-amber-200';
      if (status === 'declined')       return d ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-50 text-red-600 border-red-200';
      return d ? 'bg-slate-700/50 text-slate-400 border-slate-600' : 'bg-slate-100 text-slate-500 border-slate-300';
    },
  };
}

// ── Pack card ──────────────────────────────────────────────────────────────────

function PackCard({ pack, theme, onPublish }: {
  pack: PartnerPack;
  theme: 'light' | 'dark';
  onPublish: (id: string) => Promise<void>;
}) {
  const d = theme === 'dark';
  const s = th(d);
  const [expanded, setExpanded] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished]   = useState(false);

  const handlePublish = async () => {
    setPublishing(true);
    await onPublish(pack.id);
    setPublished(true);
    setPublishing(false);
  };

  return (
    <div className={`rounded-xl ${s.card} overflow-hidden`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`font-semibold text-sm truncate ${s.textPrimary}`}>{pack.name}</p>
              <Badge className={`text-[9px] ${s.statusBadge(pack.status)}`}>
                {pack.status.replace('_', ' ')}
              </Badge>
            </div>
            {pack.tagline && (
              <p className={`text-xs italic ${s.textMuted} mt-0.5`}>{pack.tagline}</p>
            )}
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {pack.campaign_fit_score != null && (
              <Badge className={d ? 'bg-violet-500/10 text-violet-300 border-violet-500/20' : 'bg-violet-50 text-violet-700 border-violet-200'}>
                {pack.campaign_fit_score}% fit
              </Badge>
            )}
            {pack.reward_estimate && (
              <span className={`text-[10px] flex items-center gap-0.5 ${d ? 'text-amber-300' : 'text-amber-700'}`}>
                <Trophy className="w-3 h-3" />
                {pack.reward_estimate.knyt.toLocaleString()} KNYT
              </span>
            )}
          </div>
        </div>

        {pack.objectives?.length && (
          <div className="mt-3">
            <p className={`text-[10px] uppercase tracking-wide font-semibold ${s.textSubtle} mb-1.5`}>
              <Target className="w-3 h-3 inline mr-0.5" />Objectives
            </p>
            <ul className="space-y-0.5">
              {pack.objectives.slice(0, 2).map((o, i) => (
                <li key={i} className={`text-xs flex gap-1.5 ${s.textSecondary}`}>
                  <span className={d ? 'text-violet-400' : 'text-violet-600'}>{i + 1}.</span>{o}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Expandable copy */}
      {pack.copy_variants?.length && (
        <div className={`border-t ${s.divider}`}>
          <button
            onClick={() => setExpanded(!expanded)}
            className={`w-full flex items-center justify-between px-4 py-2.5 text-xs ${s.textMuted} hover:${s.textSecondary} transition-colors`}
          >
            <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" />Copy variants ({pack.copy_variants.length})</span>
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {expanded && (
            <div className="px-4 pb-4 space-y-2">
              {pack.copy_variants.map((cv, i) => (
                <div key={i} className={`rounded-lg ${s.innerCard} p-2.5`}>
                  <p className={`text-[10px] uppercase font-semibold ${d ? 'text-violet-400' : 'text-violet-600'} mb-0.5`}>{cv.channel}</p>
                  {cv.subject && <p className={`text-xs font-medium ${s.textSecondary} mb-1`}>{cv.subject}</p>}
                  <p className={`text-[11px] ${s.textMuted} whitespace-pre-wrap line-clamp-4`}>{cv.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions — only for approved packs */}
      {pack.status === 'approved' && (
        <div className={`border-t ${s.divider} p-4`}>
          <div className="flex items-center gap-2 flex-wrap">
            {published ? (
              <span className={`text-xs flex items-center gap-1.5 ${d ? 'text-emerald-400' : 'text-emerald-600'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" />Sent to your channels
              </span>
            ) : (
              <Button
                size="sm"
                className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white"
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                Publish to My Channels
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className={`h-7 text-xs bg-transparent ${d ? 'border-white/10 text-slate-400 hover:text-slate-200' : 'border-slate-300 text-slate-600'}`}
              asChild
            >
              <a href={`/api/marketa/packs/${pack.id}/download`} download>
                <ExternalLink className="w-3 h-3 mr-1" />
                Download
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MarketaMyPacksTab({ theme = 'dark', partnerId }: Props) {
  const d = theme === 'dark';
  const s = th(d);

  const [packs, setPacks]   = useState<PartnerPack[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handlePublish = async (packId: string) => {
    // Fire partner's Make webhook with pack content
    await fetch(`/api/marketa/packs/${packId}/publish-partner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partner_id: partnerId }),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="w-6 h-6 animate-spin text-rose-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-5">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-rose-400" />
          <span className={`text-sm font-semibold ${s.textPrimary}`}>My Campaign Packs</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className={`h-7 text-xs bg-transparent ${d ? 'border-white/10 text-slate-400' : 'border-slate-300 text-slate-600'}`}
          onClick={load}
        >
          <RefreshCcw className="w-3 h-3 mr-1" />
          Refresh
        </Button>
      </div>

      {packs.length === 0 ? (
        <div className={`rounded-xl ${s.card} p-10 text-center`}>
          <Package className={`w-8 h-8 mx-auto mb-3 ${s.textSubtle}`} />
          <p className={`text-sm ${s.textMuted}`}>No packs yet. Use &ldquo;Propose Campaign&rdquo; to create your first one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {packs.map((pack) => (
            <PackCard key={pack.id} pack={pack} theme={theme} onPublish={handlePublish} />
          ))}
        </div>
      )}
    </div>
  );
}
