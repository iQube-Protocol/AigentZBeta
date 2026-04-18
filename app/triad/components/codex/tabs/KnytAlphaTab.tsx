"use client";

/**
 * KnytAlphaTab — Kn0w1-first Venture Lab α entry point
 *
 * Live-data upgrade: fetches AgentQube cards, SkillQube entries, and
 * participation status from the registry + participation APIs. Org/cohort
 * participation leads; individual stats shown when personaId is passed.
 *
 * Skill CTAs open Know1 with the skill context pre-populated via ?q= param
 * (established pattern from PersonaQuickAddModal and aigent routing).
 *
 * Design rules:
 * - No metaMe controls here — those live in metaMe Runtime
 * - Org/cohort participation leads; individual accommodated but secondary
 * - Does NOT touch KnytRuntimeSurface
 * - All skill pricing comes from live DB (pricingQc in metadata)
 */

import { useCallback, useEffect, useState } from "react";
import { CodexCopilotLayer, type CopilotMessage } from "@/app/components/codex/CodexCopilotLayer";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  FlaskConical,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TRUST_BAND_LABELS, type TrustBand } from "@/types/registryIngestion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Asset {
  assetId: string;
  assetClass: string;
  name: string;
  description?: string;
  trustBand: string;
  metadata?: Record<string, unknown>;
  capabilities?: Array<{ name: string; scope: string }>;
  currentVersion?: string;
}

interface OrgStats {
  totalRewardGrants: number;
  totalQcEvents: number;
  totalReceipts: number;
  provisionalGrants: number;
  finalizedGrants: number;
}

interface CohortEntry {
  role: string;
  personaCount: number;
  totalGrantsForRole: number;
}

interface ReceiptRow {
  receiptId: string;
  eventType: string;
  provisional: boolean;
  finalizedAt: string | null;
  createdAt: string;
}

interface QcEventRow {
  eventId: string;
  actionType: string;
  direction: string;
  amountQc: number;
  provisional: boolean;
  createdAt: string;
  skillId: string | null;
}

interface LedgerSummary {
  provisionalReceipts: number;
  finalizedReceipts: number;
  totalEvents: number;
  totalQc: number;
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const TRUST_STYLES: Record<string, string> = {
  L1_EXPERIMENTAL:         "border-slate-500 text-slate-300",
  L2_VERIFIED_COMMUNITY:   "border-blue-400/70 text-blue-200",
  L3_PRODUCTION_CANDIDATE: "border-emerald-400/70 text-emerald-200",
  L4_PRODUCTION_APPROVED:  "border-cyan-400/70 text-cyan-200",
  L5_CORE_SOVEREIGN:       "border-amber-400/80 text-amber-200",
};

function trustStyle(band: string) {
  return TRUST_STYLES[band] ?? "border-slate-700 text-slate-400";
}

function trustLabel(band: string) {
  return TRUST_BAND_LABELS[band as TrustBand] ?? band;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ExplainerSection({
  title,
  icon: Icon,
  accentClass,
  borderClass,
  bgClass,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
  borderClass: string;
  bgClass: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Card className={`rounded-xl border ${borderClass} ${bgClass}`}>
      <CardHeader
        className="pb-2 cursor-pointer select-none"
        onClick={() => setOpen((prev) => !prev)}
      >
        <CardTitle className={`text-sm font-semibold flex items-center justify-between gap-2 ${accentClass}`}>
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {title}
          </span>
          {open
            ? <ChevronDown className="h-4 w-4 opacity-60" />
            : <ChevronRight className="h-4 w-4 opacity-60" />}
        </CardTitle>
      </CardHeader>
      {open && <CardContent className="space-y-2 text-sm">{children}</CardContent>}
    </Card>
  );
}

function FactRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 border-b border-slate-800/60 last:border-0">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="text-slate-200 text-right">{value}</span>
    </div>
  );
}

// ─── Skill card with CTA ──────────────────────────────────────────────────────

function SkillCard({
  skill,
  onAsk,
}: {
  skill: Asset;
  onAsk: (skill: Asset) => void;
}) {
  const priceQc = (skill.metadata?.pricingQc as number | undefined) ?? 0;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-sky-300 leading-tight">{skill.name}</p>
          {skill.description && (
            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{skill.description}</p>
          )}
        </div>
        <Badge variant="outline" className={`text-[9px] shrink-0 ${trustStyle(skill.trustBand)}`}>
          <ShieldCheck className="h-2.5 w-2.5 mr-1" />
          {trustLabel(skill.trustBand)}
        </Badge>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-600 font-mono">{priceQc} Q¢</span>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 gap-1 text-[10px] border-amber-700/50 text-amber-300 hover:bg-amber-500/10"
          onClick={() => onAsk(skill)}
        >
          Ask Know1 <ArrowRight className="h-2.5 w-2.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Participation panel ──────────────────────────────────────────────────────

function ParticipationPanel({
  org,
  cohorts,
  loading,
}: {
  org: OrgStats | null;
  cohorts: CohortEntry[];
  loading: boolean;
}) {
  if (loading) {
    return <div className="text-xs text-slate-500 py-3 text-center">Loading participation data…</div>;
  }
  if (!org) {
    return <div className="text-xs text-slate-500 py-3 text-center">Participation data unavailable.</div>;
  }
  return (
    <div className="space-y-3">
      {/* Org stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Reward Grants", value: org.totalRewardGrants },
          { label: "Receipts",      value: org.totalReceipts },
          { label: "Finalized",     value: org.finalizedGrants },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 text-center">
            <div className="text-lg font-bold text-slate-100 leading-none">{value}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {org.provisionalGrants > 0 && (
        <div className="rounded-lg border border-amber-800/30 bg-amber-950/10 px-3 py-2 text-xs text-amber-300">
          {org.provisionalGrants} grant{org.provisionalGrants !== 1 ? "s" : ""} provisional —
          finalised on DVN confirmation.
        </div>
      )}

      {/* Cohort breakdown */}
      {cohorts.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            By Role
          </div>
          <div className="space-y-1">
            {cohorts.map((c) => (
              <div
                key={c.role}
                className="flex items-center justify-between text-xs py-1 border-b border-slate-800/50 last:border-0"
              >
                <span className="text-slate-300 capitalize">{c.role.replace(/_/g, " ")}</span>
                <span className="text-slate-500">{c.personaCount} participants</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DVN Ledger panel ─────────────────────────────────────────────────────────

function DvnLedgerPanel({
  receipts,
  events,
  summary,
  loading,
}: {
  receipts: ReceiptRow[];
  events: QcEventRow[];
  summary: LedgerSummary | null;
  loading: boolean;
}) {
  if (loading) {
    return <div className="text-xs text-slate-500 py-3 text-center">Loading ledger…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Provisional Receipts", value: summary?.provisionalReceipts ?? 0, accent: "text-amber-300" },
          { label: "Finalized Receipts",   value: summary?.finalizedReceipts ?? 0, accent: "text-emerald-300" },
          { label: "Qc Events",            value: summary?.totalEvents ?? 0, accent: "text-sky-300" },
          { label: "Total Q¢ Metered",     value: summary?.totalQc ?? 0, accent: "text-slate-300" },
        ].map(({ label, value, accent }) => (
          <div key={label} className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 text-center">
            <div className={`text-lg font-bold leading-none ${accent}`}>{value}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Recent receipts */}
      {receipts.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Recent Receipts
          </div>
          <div className="space-y-1">
            {receipts.slice(0, 6).map((r) => (
              <div
                key={r.receiptId}
                className="flex items-center justify-between text-[10px] py-1 border-b border-slate-800/50 last:border-0 gap-2"
              >
                <span className="flex items-center gap-1 text-slate-400 min-w-0">
                  {r.provisional
                    ? <Clock className="h-2.5 w-2.5 text-amber-400 flex-shrink-0" />
                    : <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400 flex-shrink-0" />}
                  <span className="truncate">{r.eventType}</span>
                </span>
                <span className={`shrink-0 font-medium ${r.provisional ? "text-amber-400" : "text-emerald-400"}`}>
                  {r.provisional ? "provisional" : "finalized"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Qc events */}
      {events.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Recent Qc Events
          </div>
          <div className="space-y-1">
            {events.slice(0, 6).map((e) => (
              <div
                key={e.eventId}
                className="flex items-center justify-between text-[10px] py-1 border-b border-slate-800/50 last:border-0 gap-2"
              >
                <span className="text-slate-400 truncate min-w-0">
                  {e.actionType}{e.skillId ? ` · ${e.skillId}` : ""}
                </span>
                <span className={`shrink-0 font-medium font-mono ${
                  e.direction === "credit" ? "text-emerald-400"
                  : e.direction === "debit" ? "text-red-400"
                  : "text-slate-500"
                }`}>
                  {e.direction === "credit" ? "+" : e.direction === "debit" ? "-" : "~"}
                  {e.amountQc} Q¢
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {receipts.length === 0 && events.length === 0 && (
        <p className="text-xs text-slate-500 text-center py-2">
          No ledger activity yet — receipts will appear as participation actions are taken.
        </p>
      )}

      <p className="text-[10px] text-slate-600">
        All amounts are 0 Q¢ in alpha. DVN anchoring finalizes provisional receipts on-chain.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface KnytAlphaTabProps {
  personaId?: string;
}

export function KnytAlphaTab({ personaId }: KnytAlphaTabProps = {}) {
  const [copilotOpen,     setCopilotOpen]     = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);
  const [copilotInitialMsg, setCopilotInitialMsg] = useState<string | undefined>();

  const [agents,       setAgents]       = useState<Asset[]>([]);
  const [skills,       setSkills]       = useState<Asset[]>([]);
  const [org,          setOrg]          = useState<OrgStats | null>(null);
  const [cohorts,      setCohorts]      = useState<CohortEntry[]>([]);
  const [ledgerReceipts, setLedgerReceipts] = useState<ReceiptRow[]>([]);
  const [ledgerEvents,   setLedgerEvents]   = useState<QcEventRow[]>([]);
  const [ledgerSummary,  setLedgerSummary]  = useState<LedgerSummary | null>(null);
  const [loading,      setLoading]      = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const participationUrl = personaId
        ? `/api/codex/knyt/participation?personaId=${encodeURIComponent(personaId)}`
        : "/api/codex/knyt/participation";
      const ledgerUrl = personaId
        ? `/api/codex/knyt/ledger?personaId=${encodeURIComponent(personaId)}`
        : "/api/codex/knyt/ledger";

      const [agentsRes, skillsRes, partRes, ledgerRes] = await Promise.all([
        fetch("/api/registry/assets?assetClass=AigentQube&publicationStatus=published&tenantId=platform&limit=10"),
        fetch("/api/registry/assets?assetClass=SkillQube&publicationStatus=published&tenantId=platform&limit=20"),
        fetch(participationUrl).catch(() => null),
        fetch(ledgerUrl).catch(() => null),
      ]);

      if (agentsRes.ok) {
        const d = await agentsRes.json();
        setAgents(d.data ?? []);
      }
      if (skillsRes.ok) {
        const d = await skillsRes.json();
        setSkills(d.data ?? []);
      }
      if (partRes?.ok) {
        const d = await partRes.json();
        if (d.data) {
          setOrg(d.data.org ?? null);
          setCohorts(d.data.cohorts ?? []);
        }
      }
      if (ledgerRes?.ok) {
        const d = await ledgerRes.json();
        if (d.data) {
          setLedgerReceipts(d.data.receipts ?? []);
          setLedgerEvents(d.data.events ?? []);
          setLedgerSummary(d.data.summary ?? null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [personaId]);

  useEffect(() => { void load(); }, [load]);

  const askKnow1 = useCallback((skill: Asset) => {
    setCopilotInitialMsg(`Tell me about ${skill.name}: ${skill.description ?? ""}`);
    setCopilotOpen(true);
  }, []);

  // Filter to Know1's skill family (skills with know1 in assetId or tagged)
  const know1Skills = skills.filter(
    (s) => s.assetId.includes("kn0w1") || s.assetId.includes("know1")
  );
  const displaySkills = know1Skills.length > 0 ? know1Skills : skills;

  return (
    <div className="grid gap-4 p-4 md:p-6">

      {/* ── Header ── */}
      <Card className="rounded-xl border border-amber-800/40 bg-amber-950/20">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-amber-500 mb-0.5">Venture Lab α</p>
            <h2 className="text-xl font-semibold text-slate-100">Know1-First KNYT Alpha</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              The reference alpha experience for the KNYT Cartridge — guided by Know1, backed by AgentiQ OS primitives.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/triad/embed/codex/venture-lab?tab=alpha-programme"
              className="flex items-center gap-1 rounded-md border border-amber-700/40 bg-amber-900/20 px-2.5 py-1 text-[11px] text-amber-400 hover:text-amber-300 hover:bg-amber-900/30 transition-colors"
              title="Back to α Programme"
            >
              <ArrowLeft className="h-3 w-3" />
              α Programme
            </a>
            <Badge className="border-amber-800 bg-amber-950 text-amber-300">Alpha</Badge>
            <Badge variant="outline" className="border-slate-700 text-slate-300">Provisional</Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void load()}
              disabled={loading}
              className="h-7 w-7 p-0"
              title="Refresh live data"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Alpha scope ── */}
      <ExplainerSection
        title="What This Alpha Proves"
        icon={FlaskConical}
        accentClass="text-violet-300"
        borderClass="border-violet-900/40"
        bgClass="bg-violet-950/10"
      >
        <p className="text-slate-300">
          A Know1-first living cartridge that demonstrates the platform&apos;s core propositions at small scale before broader rollout.
        </p>
        <div className="space-y-1 pt-1">
          <FactRow label="Cartridge-native experience" value="KNYT as the primary coordinate" />
          <FactRow label="Treasury and rewards visibility" value="Explained, not speculated on" />
          <FactRow label="Qc vs $KNYT" value="Distinction held clearly throughout" />
          <FactRow label="Receipted participation" value="Meaningful actions receipt-emitted via DVN" />
          <FactRow label="Curated internal skills" value={`${displaySkills.length} skills live`} />
          <FactRow label="21 Sats coordination" value="Community world framing in place" />
          <FactRow label="metaMe controls" value="Personal sovereignty available in Runtime" />
        </div>
        <p className="text-xs text-slate-500 pt-2">
          Alpha does not include: broad registry browsing, full skills marketplace UX, deep treasury ops, or heavy token dashboarding.
        </p>
      </ExplainerSection>

      {/* ── Live AgentQube cards ── */}
      <ExplainerSection
        title="Reference Agents"
        icon={Brain}
        accentClass="text-amber-300"
        borderClass="border-amber-900/40"
        bgClass="bg-amber-950/10"
      >
        {loading ? (
          <div className="text-xs text-slate-500 py-2 text-center">Loading agents…</div>
        ) : agents.length > 0 ? (
          <div className="space-y-2 pt-1">
            {agents.map((agent) => {
              const badge    = (agent.metadata?.badge as string) ?? agent.name.charAt(0);
              const caps     = (agent.capabilities ?? []) as Array<{ name: string; scope: string }>;
              const model    = agent.metadata?.modelPreference as string | undefined;
              return (
                <div key={agent.assetId} className="rounded-lg border border-amber-900/30 bg-slate-900/40 p-3 flex gap-3">
                  <div className="h-8 w-8 shrink-0 rounded-full border border-amber-700/50 bg-amber-900/30 flex items-center justify-center text-sm font-bold text-amber-300">
                    {badge}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-100">{agent.name}</span>
                      <Badge variant="outline" className={`text-[9px] ${trustStyle(agent.trustBand)}`}>
                        <ShieldCheck className="h-2 w-2 mr-1" />
                        {trustLabel(agent.trustBand)}
                      </Badge>
                    </div>
                    {agent.description && (
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{agent.description}</p>
                    )}
                    <div className="flex gap-1 flex-wrap mt-1">
                      {caps.slice(0, 3).map((c) => (
                        <span key={c.name} className="rounded-full border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-[9px] text-slate-400">
                          {c.name}
                        </span>
                      ))}
                      {model && (
                        <span className="text-[9px] text-slate-600 self-center font-mono">{model}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1 pt-1">
            <FactRow label="Role" value="Knowledge synthesis, lore translation, opportunity shaping" />
            <FactRow label="Cartridge overlays" value="KNYT, AgentiQ, Qriptopian" />
            <FactRow label="Trust band" value="L4 Production Approved" />
            <FactRow label="Pricing" value="0 Q¢ (alpha — all skills free)" />
          </div>
        )}
      </ExplainerSection>

      {/* ── Live SkillQube catalog with CTAs ── */}
      <ExplainerSection
        title={`Know1 Skill Family (${displaySkills.length} skills)`}
        icon={Cpu}
        accentClass="text-sky-300"
        borderClass="border-sky-900/40"
        bgClass="bg-sky-950/10"
      >
        <p className="text-slate-300 text-xs">
          Curated internal skills Know1 draws from in the KNYT cartridge context. Hit &ldquo;Ask Know1&rdquo; to open Know1 with the skill context pre-loaded.
        </p>
        {loading ? (
          <div className="text-xs text-slate-500 py-2 text-center">Loading skills…</div>
        ) : displaySkills.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-2 pt-1">
            {displaySkills.map((skill) => (
              <SkillCard key={skill.assetId} skill={skill} onAsk={askKnow1} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 pt-1">Skills registry loading…</p>
        )}
      </ExplainerSection>

      {/* ── Participation status (org/cohort-led) ── */}
      <ExplainerSection
        title="Participation Status"
        icon={Users}
        accentClass="text-emerald-300"
        borderClass="border-emerald-900/40"
        bgClass="bg-emerald-950/10"
      >
        <ParticipationPanel org={org} cohorts={cohorts} loading={loading} />
      </ExplainerSection>

      {/* ── DVN Receipt + Qc accounting ledger ── */}
      <ExplainerSection
        title="DVN Receipt & Qc Ledger"
        icon={CheckCircle2}
        accentClass="text-sky-300"
        borderClass="border-sky-900/40"
        bgClass="bg-sky-950/10"
      >
        <p className="text-xs text-slate-300">
          Economic lifecycle view — every participation action emits a DVN receipt that moves from provisional to finalized as the on-chain anchor confirms.
        </p>
        <DvnLedgerPanel
          receipts={ledgerReceipts}
          events={ledgerEvents}
          summary={ledgerSummary}
          loading={loading}
        />
      </ExplainerSection>

      {/* ── AgentiQ OS primitives (live counts) ── */}
      <ExplainerSection
        title="AgentiQ OS Primitives Backing This Alpha"
        icon={Layers}
        accentClass="text-emerald-300"
        borderClass="border-slate-800/60"
        bgClass="bg-slate-950/40"
      >
        <p className="text-slate-300 text-xs">
          These are live operational service contracts — not stubs.
        </p>
        <div className="space-y-1 pt-1">
          <FactRow label="AgentQube registry" value={`${agents.length} reference agents published`} />
          <FactRow label="SkillQube registry" value={`${displaySkills.length} Know1 alpha skills published`} />
          <FactRow label="$KNYT ledger" value="DVN-backed provisional balance via knyt_ledger" />
          <FactRow label="Rewards service" value="DVN receipt emission on participation actions" />
          <FactRow label="Orchestration" value="JourneyState + NBEPlan routing for KNYT context" />
          <FactRow label="Policy evaluation" value="KNYT cartridge policy + explanation-first posture" />
        </div>
      </ExplainerSection>

      {/* ── Know1 CTA ── */}
      <Card className="rounded-xl border border-amber-700/40 bg-amber-950/20">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <p className="text-sm font-semibold text-amber-200 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Engage Know1 to begin
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Know1 is your guide through the KNYT alpha. Ask anything — treasury, rewards, skills, 21 Sats, opportunity.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-800/50 text-amber-300 hover:bg-amber-500/10 text-xs"
              onClick={() => { setCopilotInitialMsg("What is the KNYT Treasury and how do rewards work?"); setCopilotOpen(true); }}
            >
              <Zap className="mr-1 h-3 w-3" />
              Ask about Treasury
            </Button>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-400 text-black font-semibold whitespace-nowrap"
              onClick={() => setCopilotOpen(true)}
            >
              Talk to Know1 <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <CodexCopilotLayer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        onOpen={() => setCopilotOpen(true)}
        variant="floating"
        enableInferenceRendering
        personaId={personaId}
        contextId="knyt-alpha"
        messages={copilotMessages}
        onMessagesChange={setCopilotMessages}
        initialMessage={copilotInitialMsg}
      />
    </div>
  );
}
