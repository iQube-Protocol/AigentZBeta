'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Send, RefreshCcw, Loader2, Eye, CheckCircle2, AlertCircle,
  ChevronDown, ChevronRight, Mail, Users, Megaphone, Twitter,
  Linkedin, Instagram, Copy, Check, Zap, Target, BarChart3, Sparkles, Film,
} from 'lucide-react';
import { bridgeGet } from './bridgeFetch';
import { CampaignCatalogItem, CampaignDetail } from '@/types/marketaCampaigns';

// ── Types ──────────────────────────────────────────────────────────────────────

interface EmailMeta {
  n: number;
  subject: string;
  preview: string;
  target_filter: string;
  status_slug: string;
  cta: string;
  sent_count: number;
  eligible_count: number;
}

interface KSData {
  emails: EmailMeta[];
  next_to_fire: number;
}

interface KnytSequence {
  cohort: string;
  label: string;
  sequence_id: string;
  subject: string;
  preview: string;
  accent: string;
  total: number;
  sent: number;
  unsent: number;
  opened: number;
  backed: number;
  status: 'pending' | 'partial' | 'complete';
}

interface KnytData {
  sequences: KnytSequence[];
}

interface SocialPack {
  slug: string;
  title: string;
  template_markdown: string;
  subject_lines: string[];
  cta_options: string[];
}

interface CampaignStat {
  id: string;
  name: string;
  cohort_size?: number;
  total?: number;
  active?: number;
  suppressed?: number;
  emails_sent?: number;
  open_rate?: number;
  current_email?: number;
  next_email?: number;
  next_action?: string;
  send_command?: string | null;
  wave_1?: { total: number; contacted: number; responded: number };
  wave_2?: { total: number; contacted: number };
}

interface Props {
  theme?: 'light' | 'dark';
}

// ── Theme helper ───────────────────────────────────────────────────────────────

function th(d: boolean) {
  return {
    card:          d ? 'bg-slate-950/60 ring-1 ring-white/10 shadow-xl' : 'bg-white border border-slate-200 shadow-sm',
    innerCard:     d ? 'bg-slate-900/60 border border-white/[0.07]' : 'bg-slate-50 border border-slate-200',
    hoverCard:     d ? 'hover:bg-slate-900/40' : 'hover:bg-slate-50',
    textPrimary:   d ? 'text-slate-100'  : 'text-slate-900',
    textSecondary: d ? 'text-slate-300'  : 'text-slate-700',
    textMuted:     d ? 'text-slate-400'  : 'text-slate-600',
    textSubtle:    d ? 'text-slate-500'  : 'text-slate-400',
    divider:       d ? 'border-white/[0.07]' : 'border-slate-200',
    emailRow:      d ? 'bg-slate-900/40 border border-white/[0.05] hover:bg-slate-900/60' : 'bg-white border border-slate-100 hover:bg-slate-50',
    codeBlock:     d ? 'bg-black/40 border border-white/[0.06] text-emerald-400' : 'bg-slate-100 border border-slate-200 text-emerald-700',
    btnGhost:      d ? 'border border-white/10 bg-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]' : 'border border-slate-200 bg-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50',
    btnRose:       d ? 'border border-rose-500/30 bg-rose-500/[0.08] text-rose-300 hover:bg-rose-500/[0.15] hover:border-rose-500/40' : 'border border-rose-500/40 bg-rose-50 text-rose-700 hover:bg-rose-100',
    btnViolet:     d ? 'border border-violet-500/30 bg-violet-500/[0.08] text-violet-300 hover:bg-violet-500/[0.15] hover:border-violet-500/40' : 'border border-violet-500/40 bg-violet-50 text-violet-700 hover:bg-violet-100',
    btnSky:        d ? 'border border-sky-500/30 bg-sky-500/[0.08] text-sky-300 hover:bg-sky-500/[0.15] hover:border-sky-500/40' : 'border border-sky-500/40 bg-sky-50 text-sky-700 hover:bg-sky-100',
    btnAmber:      d ? 'border border-amber-500/30 bg-amber-500/[0.08] text-amber-300 hover:bg-amber-500/[0.15] hover:border-amber-500/40' : 'border border-amber-500/40 bg-amber-50 text-amber-700 hover:bg-amber-100',
    btnEmerald:    d ? 'border border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-300 hover:bg-emerald-500/[0.15] hover:border-emerald-500/35' : 'border border-emerald-500/40 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  };
}

const COHORT_ACCENT: Record<string, string> = {
  amber:  'text-amber-400',
  violet: 'text-violet-400',
  rose:   'text-rose-400',
  sky:    'text-sky-400',
};

const COHORT_BTN: Record<string, keyof ReturnType<typeof th>> = {
  amber:  'btnAmber',
  violet: 'btnViolet',
  rose:   'btnRose',
  sky:    'btnSky',
};

// ── Accordion wrapper ─────────────────────────────────────────────────────────

function Section({
  title, icon: Icon, accent, badge, open, onToggle, children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  badge?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 py-2 text-left"
      >
        <Icon className={`w-4 h-4 ${accent} flex-shrink-0`} />
        <span className={`text-sm font-semibold ${accent} flex-1`}>{title}</span>
        {badge}
        {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

// ── Copy-to-clipboard button ──────────────────────────────────────────────────

function CopyButton({ text, isDark }: { text: string; isDark: boolean }) {
  const s = th(isDark);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button
      onClick={copy}
      className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-all ${copied ? s.btnEmerald : s.btnGhost}`}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ── KS Email row ───────────────────────────────────────────────────────────────

function EmailRow({
  email, isNext, isDark, onDryRun, onFire, firing,
}: {
  email: EmailMeta;
  isNext: boolean;
  isDark: boolean;
  onDryRun: () => void;
  onFire: () => void;
  firing: boolean;
}) {
  const s = th(isDark);
  const [expanded, setExpanded] = useState(false);
  const isSent = email.sent_count > 0;

  return (
    <div className={`rounded-lg ${s.emailRow} transition-colors overflow-hidden`}>
      <div
        className="flex items-start gap-3 p-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Email number bubble */}
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5 ${
          isSent
            ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
            : isNext
              ? isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-50 text-rose-700'
              : isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
        }`}>
          {isSent ? <CheckCircle2 className="w-3.5 h-3.5" /> : email.n}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-xs font-medium leading-tight ${s.textSecondary}`}>{email.subject}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {isSent && (
                <Badge className={isDark ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-[9px]' : 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]'}>
                  {email.sent_count} sent
                </Badge>
              )}
              {isNext && !isSent && (
                <Badge className={isDark ? 'bg-rose-500/10 text-rose-300 border-rose-500/20 text-[9px]' : 'bg-rose-50 text-rose-700 border-rose-200 text-[9px]'}>
                  Next
                </Badge>
              )}
              {expanded ? <ChevronDown className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
            </div>
          </div>
          <p className={`text-[10px] mt-0.5 ${s.textSubtle}`}>
            Target: {email.target_filter}
            {email.eligible_count > 0 && ` · ${email.eligible_count} eligible`}
          </p>
        </div>
      </div>

      {expanded && (
        <div className={`px-3 pb-3 pt-1 border-t ${s.divider} space-y-2`}>
          <p className={`text-[11px] leading-relaxed ${s.textMuted}`}>{email.preview}</p>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] ${s.textSubtle}`}>CTA:</span>
            <span className={`text-[10px] font-medium ${isDark ? 'text-sky-400' : 'text-sky-700'}`}>{email.cta}</span>
          </div>
          <div className={`text-[10px] font-mono rounded px-2 py-1.5 ${s.codeBlock}`}>
            node scripts/send-ks-prospects-sequence.js --email {email.n} --dry-run
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className={`h-6 text-[10px] bg-transparent ${s.btnGhost}`}
              onClick={(e) => { e.stopPropagation(); onDryRun(); }}
              disabled={firing}
            >
              <Eye className="w-3 h-3 mr-1" />Dry-run
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={`h-6 text-[10px] bg-transparent ${isNext ? s.btnRose : s.btnGhost}`}
              onClick={(e) => { e.stopPropagation(); onFire(); }}
              disabled={firing || (!isNext && !isSent)}
            >
              {firing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
              Fire Email {email.n}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MarketaCampaignOpsTab({ theme = 'dark' }: Props) {
  const d = theme === 'dark';
  const s = th(d);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [stats,   setStats]   = useState<CampaignStat[]>([]);
  const [content, setContent] = useState<{ ks_prospects: KSData; knyt_investors: KnytData; social_posts: SocialPack[] } | null>(null);
  const [loading, setLoading] = useState(true);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    sequences: false, ks: false, knyt: false, partners: false, social: false,
  });
  const [sequences, setSequences]         = useState<CampaignCatalogItem[]>([]);
  const [expandedSeq, setExpandedSeq]     = useState<string | null>(null);
  const [seqDetail, setSeqDetail]         = useState<Record<string, CampaignDetail>>({});
  const [campaignActions, setCampaignActions] = useState<Record<string, 'loading' | 'done' | 'error'>>({});
  const [firingEmail, setFiringEmail]     = useState<number | null>(null);
  const [firingCohort, setFiringCohort]   = useState<string | null>(null);
  const [fired, setFired]                 = useState<Record<string, boolean>>({});
  const [cmdResult, setCmdResult]         = useState<Record<string, string>>({});

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, contentRes] = await Promise.all([
        fetch('/api/marketa/campaigns'),
        fetch('/api/marketa/campaigns/email-content'),
      ]);
      const statsData   = statsRes.ok   ? await statsRes.json()   : null;
      const contentData = contentRes.ok ? await contentRes.json() : null;
      if (statsData?.ok)   setStats(statsData.campaigns ?? []);
      if (contentData?.ok) setContent(contentData);
      // load ALL campaigns from bridge for admin management (non-blocking)
      bridgeGet<{ available_campaigns?: Array<{ id: string; name: string; description?: string; campaign_type: string; sequence_length?: number; metadata?: unknown; channels?: string[] }>; joined_campaigns?: unknown[] }>('campaign_catalog', {})
        .then(({ available_campaigns = [] }) => {
          const all = available_campaigns.map((c) => ({
            id: c.id, name: c.name, description: c.description ?? '',
            campaign_type: c.campaign_type as CampaignCatalogItem['campaign_type'],
            duration_days: c.sequence_length, channels: c.channels ?? [], is_joined: false,
          }));
          setSequences(all);
        })
        .catch(() => {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleKsAction = async (emailN: number, dryRun: boolean) => {
    setFiringEmail(emailN);
    try {
      const res = await fetch('/api/marketa/campaigns/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort: 'ks_prospects', dry_run: dryRun, email_number: emailN }),
      });
      const data = await res.json();
      const key = `ks_${emailN}_${dryRun ? 'dry' : 'live'}`;
      if (data.ok) {
        setCmdResult((prev) => ({ ...prev, [key]: dryRun ? `Dry-run: ${data.preview?.length ?? 0} recipients` : `Sent to ${data.sent ?? 0} contacts` }));
        if (!dryRun) setFired((prev) => ({ ...prev, [`ks_${emailN}`]: true }));
      } else {
        setCmdResult((prev) => ({ ...prev, [key]: data.error ?? 'Failed' }));
      }
    } catch {
      setCmdResult((prev) => ({ ...prev, [`ks_${emailN}_err`]: 'Network error' }));
    } finally {
      setFiringEmail(null);
    }
  };

  const handleKnytDispatch = async (seq: KnytSequence, dryRun: boolean) => {
    setFiringCohort(seq.cohort);
    try {
      const res = await fetch('/api/marketa/sequence/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sequenceId: seq.sequence_id,
          recipientIds: [],
          channel: 'email_mailjet',
          context: { dry_run: dryRun, cohort: seq.cohort },
        }),
      });
      const data = await res.json();
      const key = `knyt_${seq.cohort}`;
      setCmdResult((prev) => ({
        ...prev,
        [key]: data.success
          ? dryRun ? `Dry-run OK — ${seq.unsent} to dispatch` : `Dispatched ${data.dispatched ?? seq.unsent}`
          : data.error ?? 'Dispatch failed',
      }));
      if (!dryRun && data.success) {
        setFired((prev) => ({ ...prev, [key]: true }));
      }
    } catch {
      setCmdResult((prev) => ({ ...prev, [`knyt_${seq.cohort}_err`]: 'Network error' }));
    } finally {
      setFiringCohort(null);
    }
  };

  // ── Campaign admin actions ────────────────────────────────────────────────

  const handleCampaignStatus = async (campaignId: string, status: string) => {
    setCampaignActions((prev) => ({ ...prev, [campaignId]: 'loading' }));
    try {
      const res = await fetch(`/api/marketa/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setCampaignActions((prev) => ({ ...prev, [campaignId]: 'done' }));
        setSequences((prev) => prev.map((c) => c.id === campaignId ? { ...c } : c));
        setTimeout(() => setCampaignActions((prev) => { const n = { ...prev }; delete n[campaignId]; return n; }), 2000);
      } else {
        setCampaignActions((prev) => ({ ...prev, [campaignId]: 'error' }));
      }
    } catch {
      setCampaignActions((prev) => ({ ...prev, [campaignId]: 'error' }));
    }
  };

  const handleCampaignDelete = async (campaignId: string) => {
    if (!confirm('Delete this campaign and all its sequence items? This cannot be undone.')) return;
    setCampaignActions((prev) => ({ ...prev, [`del_${campaignId}`]: 'loading' }));
    try {
      const res = await fetch(`/api/marketa/campaigns/${campaignId}`, { method: 'DELETE' });
      if (res.ok) {
        setSequences((prev) => prev.filter((c) => c.id !== campaignId));
      } else {
        setCampaignActions((prev) => ({ ...prev, [`del_${campaignId}`]: 'error' }));
      }
    } catch {
      setCampaignActions((prev) => ({ ...prev, [`del_${campaignId}`]: 'error' }));
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const ksStat    = stats.find((c) => c.id === 'ks_prospects');
  const knytStat  = stats.find((c) => c.id === 'knyt_codex');
  const partStat  = stats.find((c) => c.id === 'knyt_partners');

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3 p-3 sm:p-4 lg:p-5">

      {/* Header */}
      <div className={`rounded-xl ${s.card} p-3 sm:p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-rose-400" />
            <span className={`text-sm font-semibold ${s.textPrimary}`}>Campaign Commander</span>
            <span className={`text-[10px] ${s.textSubtle}`}>· 3 live campaigns</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className={`h-7 text-xs bg-transparent ${s.btnGhost}`}
            onClick={load}
            disabled={loading}
          >
            <RefreshCcw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-rose-400" />
        </div>
      ) : (
        <div className="space-y-3">

          {/* ── Sequences ──────────────────────────────────────────────────── */}
          {sequences.length > 0 && (
            <div className={`rounded-xl ${s.card} p-4`}>
              <Section
                title="Live Sequences"
                icon={Film}
                accent="text-violet-400"
                badge={<span className={`text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400`}>{sequences.length}</span>}
                open={openSections.sequences}
                onToggle={() => toggle('sequences')}
              >
                <div className="space-y-3 mt-2">
                  {sequences.length === 0 && (
                    <p className={`text-xs text-center py-4 ${s.textSubtle}`}>No campaigns found in the bridge.</p>
                  )}
                  {sequences.map((seq) => {
                    const actionState = campaignActions[seq.id];
                    const delState = campaignActions[`del_${seq.id}`];
                    return (
                    <div key={seq.id} className={`rounded-lg border p-3 space-y-2 ${s.innerCard}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {seq.name.toLowerCase().includes('awaken') && <Sparkles className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />}
                          <span className={`text-sm font-medium truncate ${s.textPrimary}`}>{seq.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${seq.campaign_type === 'sequence' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' : 'bg-amber-500/15 text-amber-400 border-amber-500/30'} flex-shrink-0`}>
                            {seq.campaign_type}
                          </span>
                          {seq.duration_days && (
                            <span className={`text-[10px] ${s.textSubtle}`}>{seq.duration_days}d</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => {
                              if (expandedSeq === seq.id) { setExpandedSeq(null); return; }
                              setExpandedSeq(seq.id);
                              if (!seqDetail[seq.id]) {
                                bridgeGet<{ success: boolean; campaign: CampaignDetail }>('campaign_detail', { campaignId: seq.id })
                                  .then(({ campaign }) => setSeqDetail((prev) => ({ ...prev, [seq.id]: campaign })))
                                  .catch(() => {});
                              }
                            }}
                            className={`text-[10px] px-2 py-1 rounded border transition-colors ${s.btnGhost}`}
                          >
                            {expandedSeq === seq.id ? 'Collapse' : 'Details'}
                          </button>
                        </div>
                      </div>

                      {/* Channel chips */}
                      {(seq.channels ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {seq.channels.map((ch) => (
                            <span key={ch} className={`text-[10px] px-1.5 py-0.5 rounded border ${d ? 'border-white/10 text-white/40' : 'border-black/10 text-black/40'}`}>{ch}</span>
                          ))}
                        </div>
                      )}

                      {/* Admin actions */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/[0.05]">
                        <span className={`text-[10px] ${s.textSubtle} mr-1`}>Admin:</span>
                        <button
                          onClick={() => handleCampaignStatus(seq.id, 'active')}
                          disabled={!!actionState}
                          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${s.btnEmerald} disabled:opacity-50`}
                        >
                          {actionState === 'loading' ? <Loader2 className="w-3 h-3 animate-spin inline" /> : '✓ Activate'}
                        </button>
                        <button
                          onClick={() => handleCampaignStatus(seq.id, 'draft')}
                          disabled={!!actionState}
                          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${s.btnAmber} disabled:opacity-50`}
                        >
                          ↺ Draft
                        </button>
                        <button
                          onClick={() => handleCampaignStatus(seq.id, 'archived')}
                          disabled={!!actionState}
                          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${s.btnGhost} disabled:opacity-50`}
                        >
                          Archive
                        </button>
                        <button
                          onClick={() => handleCampaignDelete(seq.id)}
                          disabled={!!delState}
                          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${s.btnRose} disabled:opacity-50 ml-auto`}
                        >
                          {delState === 'loading' ? <Loader2 className="w-3 h-3 animate-spin inline" /> : '✕ Delete'}
                        </button>
                        {actionState === 'done' && <span className="text-[10px] text-emerald-400">✓ Updated</span>}
                        {actionState === 'error' && <span className="text-[10px] text-rose-400">Error</span>}
                      </div>

                      {/* Expanded items */}
                      {expandedSeq === seq.id && (
                        <div className="mt-2 space-y-1.5">
                          {!seqDetail[seq.id] ? (
                            <div className={`text-xs text-center py-4 ${s.textSubtle}`}>Loading…</div>
                          ) : (
                            <>
                              <p className={`text-[10px] uppercase tracking-wide font-semibold ${s.textSubtle} mb-1`}>
                                {seqDetail[seq.id].marketa_sequence_items?.length ?? 0} sequence items
                              </p>
                              {(seqDetail[seq.id].marketa_sequence_items ?? [])
                                .slice()
                                .sort((a, b) => a.day_number - b.day_number)
                                .map((item) => (
                                  <div key={item.id} className={`flex items-center gap-3 rounded px-2 py-1.5 ${s.emailRow}`}>
                                    <span className={`text-[10px] font-mono w-10 flex-shrink-0 ${s.textSubtle}`}>Day {item.day_number}</span>
                                    <span className={`text-xs truncate flex-1 ${s.textSecondary}`}>{item.title}</span>
                                    {item.explainer && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 flex-shrink-0">Explainer</span>}
                                    <span className={`text-[10px] capitalize flex-shrink-0 ${item.status === 'sent' || item.status === 'viewed' ? 'text-emerald-400' : s.textSubtle}`}>{item.status}</span>
                                  </div>
                                ))}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </Section>
            </div>
          )}

          {/* ── KNYT Investors ─────────────────────────────────────────────── */}
          <div className={`rounded-xl ${s.card} p-4`}>
            <Section
              title="KNYT Investors"
              icon={BarChart3}
              accent="text-violet-400"
              badge={knytStat && (
                <Badge className={d ? 'bg-violet-500/10 text-violet-300 border-violet-500/20 text-[9px]' : 'bg-violet-50 text-violet-700 border-violet-200 text-[9px]'}>
                  {knytStat.cohort_size ?? 0} investors · 4 cohorts
                </Badge>
              )}
              open={openSections.knyt}
              onToggle={() => toggle('knyt')}
            >
              <div className="space-y-2">
                {(content?.knyt_investors?.sequences ?? []).map((seq) => {
                  const accent   = COHORT_ACCENT[seq.accent] ?? COHORT_ACCENT.violet;
                  const btnKey   = COHORT_BTN[seq.accent]    ?? 'btnViolet';
                  const isFiring = firingCohort === seq.cohort;
                  const isDone   = fired[`knyt_${seq.cohort}`];
                  const result   = cmdResult[`knyt_${seq.cohort}`];

                  return (
                    <div key={seq.cohort} className={`rounded-xl ${s.innerCard} p-3`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className={`text-xs font-semibold ${accent}`}>{seq.label}</p>
                          <p className={`text-[11px] leading-snug mt-0.5 ${s.textMuted}`}>{seq.subject}</p>
                        </div>
                        <Badge className={`text-[9px] shrink-0 ${
                          seq.status === 'complete'
                            ? (d ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                            : seq.status === 'partial'
                              ? (d ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200')
                              : (d ? 'bg-slate-700/50 text-slate-400 border-slate-600' : 'bg-slate-100 text-slate-500 border-slate-300')
                        }`}>
                          {seq.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 mb-2">
                        {[
                          { label: 'Total',  value: seq.total },
                          { label: 'Sent',   value: seq.sent },
                          { label: 'Opened', value: seq.opened },
                          { label: 'Backed', value: seq.backed },
                        ].map(({ label, value }) => (
                          <div key={label} className={`rounded ${d ? 'bg-slate-900/60' : 'bg-white border border-slate-100'} p-1.5 text-center`}>
                            <p className={`text-sm font-bold ${accent}`}>{value}</p>
                            <p className={`text-[9px] ${s.textSubtle}`}>{label}</p>
                          </div>
                        ))}
                      </div>

                      <p className={`text-[10px] ${s.textSubtle} mb-2`}>{seq.preview}</p>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className={`h-6 text-[10px] bg-transparent ${s.btnGhost}`}
                          onClick={() => handleKnytDispatch(seq, true)}
                          disabled={isFiring || seq.unsent === 0}
                        >
                          <Eye className="w-3 h-3 mr-1" />Dry-run
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className={`h-6 text-[10px] bg-transparent ${isDone ? s.btnEmerald : s[btnKey]}`}
                          onClick={() => handleKnytDispatch(seq, false)}
                          disabled={isFiring || seq.unsent === 0 || isDone}
                        >
                          {isFiring ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : isDone ? (
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                          ) : (
                            <Send className="w-3 h-3 mr-1" />
                          )}
                          {isDone ? 'Sent' : `Dispatch (${seq.unsent} unsent)`}
                        </Button>
                        {result && (
                          <span className={`text-[10px] ${result.includes('fail') || result.includes('error') ? 'text-red-400' : d ? 'text-emerald-400' : 'text-emerald-700'}`}>
                            {result}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          </div>

          {/* ── KS Prospects ───────────────────────────────────────────────── */}
          <div className={`rounded-xl ${s.card} p-4`}>
            <Section
              title="KS Prospects"
              icon={Target}
              accent="text-rose-400"
              badge={ksStat && (
                <div className="flex items-center gap-1.5 mr-1">
                  <Badge className={d ? 'bg-rose-500/10 text-rose-300 border-rose-500/20 text-[9px]' : 'bg-rose-50 text-rose-700 border-rose-200 text-[9px]'}>
                    {ksStat.active ?? 0} active
                  </Badge>
                  {(ksStat.emails_sent ?? 0) > 0 && (
                    <Badge className={d ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-[9px]' : 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px]'}>
                      {ksStat.emails_sent} sent · {ksStat.open_rate ?? 0}% open
                    </Badge>
                  )}
                </div>
              )}
              open={openSections.ks}
              onToggle={() => toggle('ks')}
            >
              {ksStat && (
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { label: 'Total',  value: ksStat.cohort_size ?? 0, accent: s.textPrimary },
                    { label: 'Active', value: ksStat.active ?? 0,      accent: d ? 'text-sky-400' : 'text-sky-700' },
                    { label: 'Sent',   value: ksStat.emails_sent ?? 0, accent: d ? 'text-emerald-400' : 'text-emerald-700' },
                    { label: 'Open %', value: `${ksStat.open_rate ?? 0}%`, accent: d ? 'text-amber-400' : 'text-amber-700' },
                  ].map(({ label, value, accent }) => (
                    <div key={label} className={`rounded-lg ${s.innerCard} p-2 text-center`}>
                      <p className={`text-sm font-bold ${accent}`}>{value}</p>
                      <p className={`text-[10px] ${s.textSubtle}`}>{label}</p>
                    </div>
                  ))}
                </div>
              )}
              {content?.ks_prospects && (
                <div className={`mb-3 rounded-lg px-3 py-2 ${d ? 'bg-rose-950/20 border border-rose-500/20' : 'bg-rose-50 border border-rose-200'}`}>
                  <p className={`text-[10px] font-semibold ${d ? 'text-rose-300' : 'text-rose-700'}`}>
                    Next: Fire Email {content.ks_prospects.next_to_fire}
                  </p>
                  <p className={`text-[10px] mt-0.5 ${s.textSubtle}`}>
                    {content.ks_prospects.emails[content.ks_prospects.next_to_fire - 1]?.target_filter}
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                {(content?.ks_prospects?.emails ?? []).map((email) => (
                  <EmailRow
                    key={email.n}
                    email={email}
                    isNext={content?.ks_prospects.next_to_fire === email.n}
                    isDark={d}
                    onDryRun={() => handleKsAction(email.n, true)}
                    onFire={() => handleKsAction(email.n, false)}
                    firing={firingEmail === email.n}
                  />
                ))}
              </div>
              {Object.entries(cmdResult)
                .filter(([k]) => k.startsWith('ks_'))
                .map(([k, msg]) => (
                  <p key={k} className={`mt-2 text-[10px] ${msg.includes('error') || msg.includes('fail') ? 'text-red-400' : d ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    {msg}
                  </p>
                ))}
            </Section>
          </div>

          {/* ── Partners ───────────────────────────────────────────────────── */}
          <div className={`rounded-xl ${s.card} p-4`}>
            <Section
              title="Partners"
              icon={Users}
              accent="text-rose-400"
              badge={partStat && (
                <div className="flex items-center gap-1.5 mr-1">
                  <Badge className={d ? 'bg-rose-500/10 text-rose-300 border-rose-500/20 text-[9px]' : 'bg-rose-50 text-rose-700 border-rose-200 text-[9px]'}>
                    Wave 1: {partStat.wave_1?.total ?? 0}
                  </Badge>
                  <Badge className={d ? 'bg-slate-700/50 text-slate-400 border-slate-600 text-[9px]' : 'bg-slate-100 text-slate-500 border-slate-300 text-[9px]'}>
                    Wave 2: {partStat.wave_2?.total ?? 0}
                  </Badge>
                </div>
              )}
              open={openSections.partners}
              onToggle={() => toggle('partners')}
            >
              {partStat && (
                <div className="space-y-2">
                  {[
                    { label: 'Wave 1', data: partStat.wave_1, accent: d ? 'text-rose-400' : 'text-rose-700' },
                    { label: 'Wave 2', data: partStat.wave_2, accent: d ? 'text-slate-300' : 'text-slate-700' },
                  ].map(({ label, data, accent: ac }) => data && (
                    <div key={label} className={`rounded-xl ${s.innerCard} p-3`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className={`text-xs font-semibold ${ac}`}>{label}</p>
                        <Badge className={d ? 'bg-slate-700/50 text-slate-400 border-slate-600 text-[9px]' : 'bg-slate-100 text-slate-500 border-slate-300 text-[9px]'}>
                          {data.total} partners
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { key: 'Total',     value: data.total },
                          { key: 'Contacted', value: data.contacted },
                          { key: 'Responded', value: 'responded' in data ? (data as any).responded : '—' },
                        ].map(({ key, value }) => (
                          <div key={key} className={`rounded ${d ? 'bg-slate-900/60' : 'bg-white border border-slate-100'} p-1.5 text-center`}>
                            <p className={`text-sm font-bold ${ac}`}>{value}</p>
                            <p className={`text-[9px] ${s.textSubtle}`}>{key}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className={`text-[11px] ${s.textSubtle} mt-1`}>
                    Full partner management in the Partners sub-tab →
                  </p>
                </div>
              )}
            </Section>
          </div>

          {/* ── Social Posts ───────────────────────────────────────────────── */}
          <div className={`rounded-xl ${s.card} p-4`}>
            <Section
              title="Social Posts"
              icon={Megaphone}
              accent={d ? 'text-sky-400' : 'text-sky-700'}
              badge={content?.social_posts?.length ? (
                <Badge className={d ? 'bg-sky-500/10 text-sky-300 border-sky-500/20 text-[9px]' : 'bg-sky-50 text-sky-700 border-sky-200 text-[9px]'}>
                  {content.social_posts.length} pack{content.social_posts.length !== 1 ? 's' : ''}
                </Badge>
              ) : undefined}
              open={openSections.social}
              onToggle={() => toggle('social')}
            >
              {(!content?.social_posts || content.social_posts.length === 0) ? (
                <div className={`rounded-lg ${s.innerCard} p-4 text-center`}>
                  <Megaphone className={`w-6 h-6 mx-auto mb-2 ${s.textSubtle}`} />
                  <p className={`text-xs ${s.textMuted}`}>No social packs in the database yet.</p>
                  <p className={`text-[10px] mt-1 ${s.textSubtle}`}>
                    Add comms packs with <code className="font-mono">comms_type = &apos;social&apos;</code> to the avl_comms_packs table.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {content.social_posts.map((pack) => (
                    <div key={pack.slug} className={`rounded-xl ${s.innerCard} p-3 space-y-2`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-semibold ${s.textPrimary}`}>{pack.title}</p>
                        <div className="flex items-center gap-1">
                          <Twitter className={`w-3 h-3 ${s.textSubtle}`} />
                          <Linkedin className={`w-3 h-3 ${s.textSubtle}`} />
                          <Instagram className={`w-3 h-3 ${s.textSubtle}`} />
                        </div>
                      </div>
                      {pack.subject_lines?.[0] && (
                        <p className={`text-[11px] font-medium ${d ? 'text-sky-300' : 'text-sky-700'}`}>{pack.subject_lines[0]}</p>
                      )}
                      {pack.template_markdown && (
                        <div className="relative">
                          <p className={`text-[11px] leading-relaxed ${s.textMuted} line-clamp-4 whitespace-pre-wrap`}>
                            {pack.template_markdown}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <CopyButton text={pack.template_markdown} isDark={d} />
                            {pack.cta_options?.[0] && (
                              <span className={`text-[10px] ${s.textSubtle}`}>CTA: {pack.cta_options[0]}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

        </div>
      )}
    </div>
  );
}
