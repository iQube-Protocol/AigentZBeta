'use client';

import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  Calendar,
  CircleDollarSign,
  Coins,
  FileText,
  Layers,
  Loader2,
  Lock,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

interface Props {
  personaId?: string;
  isAdmin?: boolean;
  isInvestor?: boolean;
  theme?: 'light' | 'dark';
}

interface CapitalEvent {
  id: string;
  eventType: string;
  amountUsd: number | null;
  amountShares: number | null;
  amountKnyt: number | null;
  vehicle: string | null;
  occurredAt: string;
  notes: string | null;
}

interface InvestorDocument {
  id: string;
  docType: string;
  title: string;
  storageMasterId: string | null;
  effectiveDate: string | null;
  createdAt: string;
}

interface InvestorDashboardPayload {
  personaId: string;
  isInvestor: boolean;
  displayName: string | null;
  summary: {
    totalInvestedUsd: number;
    totalSharesGranted: number;
    totalKnytGranted: number;
    totalDistributionsUsd: number;
    eventCount: number;
    documentCount: number;
  };
  events: CapitalEvent[];
  documents: InvestorDocument[];
}

const EVENT_LABELS: Record<string, string> = {
  investment: 'Investment',
  share_grant: 'Share Grant',
  token_grant: 'Token Grant',
  vesting_milestone: 'Vesting Milestone',
  distribution: 'Distribution',
};

const DOC_LABELS: Record<string, string> = {
  subscription_agreement: 'Subscription Agreement',
  side_letter: 'Side Letter',
  k1: 'K-1',
  '1099_b': '1099-B',
  quarterly_letter: 'Quarterly Letter',
  annual_report: 'Annual Report',
  capitalization_table: 'Capitalization Table',
  other: 'Document',
};

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function formatNumber(n: number, fractionDigits = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export function KnytInvestorDashboardTab({ personaId, isInvestor, isAdmin }: Props) {
  const [data, setData] = useState<InvestorDashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personaId) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/codex/investor-dashboard?personaId=${encodeURIComponent(personaId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((payload: InvestorDashboardPayload) => { if (!cancelled) setData(payload); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [personaId]);

  // Gate stub — IAM agent will resolve isInvestor at the parent. Until then,
  // we trust the prop OR the API's isInvestor flag (sourced from
  // nakamoto_knyt_personas.is_investor). Admins see content unconditionally.
  const gatePassed = isAdmin === true || isInvestor === true || data?.isInvestor === true;

  if (!personaId) {
    return (
      <div className="p-6 text-center text-slate-400">
        <Lock className="h-8 w-8 text-slate-600 mx-auto mb-2" />
        <p className="text-sm">Connect your persona to view your investor dashboard.</p>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading investor dashboard…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-400">
        <p className="text-sm">Failed to load investor data: {error}</p>
      </div>
    );
  }

  if (!gatePassed) {
    return (
      <div className="p-6 text-center text-slate-400 max-w-md mx-auto">
        <Lock className="h-8 w-8 text-amber-600 mx-auto mb-3" />
        <p className="text-sm font-semibold text-amber-200 mb-1">Investor verification required</p>
        <p className="text-xs text-slate-500">
          The Investor dashboard is only visible to verified investors. Contact your investor relations representative if you believe you should have access.
        </p>
      </div>
    );
  }

  const summary = data?.summary ?? {
    totalInvestedUsd: 0,
    totalSharesGranted: 0,
    totalKnytGranted: 0,
    totalDistributionsUsd: 0,
    eventCount: 0,
    documentCount: 0,
  };
  const events = data?.events ?? [];
  const documents = data?.documents ?? [];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Sticky header — verified status */}
      <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-white">
              {data?.displayName || 'Verified Investor'}
            </p>
            <p className="text-[10px] text-slate-500">Investor access — exclusive content unlocked</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Card 1 — My Investment */}
        <section className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CircleDollarSign className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-emerald-300">My Investment</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Total Invested</p>
              <p className="text-lg font-bold text-white">{formatUsd(summary.totalInvestedUsd)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Distributions</p>
              <p className="text-lg font-bold text-emerald-300">{formatUsd(summary.totalDistributionsUsd)}</p>
            </div>
          </div>
          {summary.eventCount === 0 && (
            <p className="mt-3 text-xs text-slate-500">No capital events recorded yet.</p>
          )}
        </section>

        {/* Card 2 — My Equity */}
        <section className="rounded-xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 to-blue-500/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-sky-300">My Equity</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Shares Granted</p>
              <p className="text-lg font-bold text-white">{formatNumber(summary.totalSharesGranted)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Vehicle</p>
              <p className="text-sm font-semibold text-sky-200">
                {events.find((e) => e.eventType === 'investment' || e.eventType === 'share_grant')?.vehicle || '—'}
              </p>
            </div>
          </div>
        </section>

        {/* Card 3 — My Tokens & Allocations */}
        <section className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Coins className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-300">My Tokens & Allocations</h3>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">$KNYT Granted</p>
            <p className="text-2xl font-bold text-amber-300">{formatNumber(summary.totalKnytGranted, 2)} <span className="text-amber-400 text-sm">KNYT</span></p>
          </div>
          {events.filter((e) => e.eventType === 'token_grant' || e.eventType === 'vesting_milestone').slice(0, 3).length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Recent Grants</p>
              {events.filter((e) => e.eventType === 'token_grant' || e.eventType === 'vesting_milestone').slice(0, 3).map((e) => (
                <div key={e.id} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{EVENT_LABELS[e.eventType] || e.eventType}</span>
                  <span className="text-white">+{formatNumber(Number(e.amountKnyt) || 0, 2)} KNYT · {formatDate(e.occurredAt)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Card 4 — My Documents */}
        <section className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-violet-300">My Documents</h3>
            {summary.documentCount > 0 && (
              <span className="ml-auto text-[10px] text-slate-400">{summary.documentCount} document{summary.documentCount !== 1 ? 's' : ''}</span>
            )}
          </div>

          {documents.length === 0 ? (
            <div className="rounded-lg bg-slate-900/50 p-3 text-center">
              <p className="text-xs text-slate-400">
                Documents available on request — contact your investor relations representative.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {documents.map((d) => (
                <div key={d.id} className="flex items-start gap-2 rounded-lg bg-slate-900/50 p-2.5">
                  <FileText className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{d.title}</p>
                    <p className="text-[10px] text-slate-500">
                      {DOC_LABELS[d.docType] || d.docType}
                      {d.effectiveDate && <> · {formatDate(d.effectiveDate)}</>}
                    </p>
                  </div>
                  {/* Phase 1: docs are listed but not yet viewable in-app — viewer
                      hooks up in Sprint 4 once admin upload populates the records.
                      The viewer will open via the gated PDFPageViewer using
                      storageMasterId per CLAUDE.md § Gated Content. */}
                  <span className="text-[10px] text-slate-500 shrink-0 mt-1">View on request</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Capital Events Ledger */}
        {events.length > 0 && (
          <section className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-300">Capital Events</h3>
              <span className="ml-auto text-[10px] text-slate-500">{events.length} event{events.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-1.5">
              {events.slice(0, 10).map((e) => (
                <div key={e.id} className="flex items-center justify-between text-xs rounded-lg bg-slate-800/40 px-2.5 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Briefcase className="h-3 w-3 text-slate-500 shrink-0" />
                    <span className="text-slate-300 truncate">{EVENT_LABELS[e.eventType] || e.eventType}</span>
                    {e.vehicle && <span className="text-[10px] text-slate-500 truncate">· {e.vehicle}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {e.amountUsd != null && <span className="text-slate-200 font-medium">{formatUsd(Number(e.amountUsd))}</span>}
                    {e.amountShares != null && <span className="text-sky-300">{formatNumber(Number(e.amountShares))} sh</span>}
                    {e.amountKnyt != null && <span className="text-amber-300">{formatNumber(Number(e.amountKnyt), 2)} KNYT</span>}
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Calendar className="h-2.5 w-2.5" />
                      {formatDate(e.occurredAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
