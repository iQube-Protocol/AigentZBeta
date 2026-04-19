"use client";

import { useState } from "react";
import { ArrowRight, Brain, ChevronDown, ChevronRight, Coins, Info, RefreshCw, Sparkles, Vault } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useKnytBalance } from "@/app/hooks/useKnytBalance";
import { useBaseQcBalance } from "@/app/hooks/useBaseQcBalance";
import { CodexCopilotLayer, type CopilotMessage } from "@/app/components/codex/CodexCopilotLayer";

interface KnytTreasuryTabProps {
  personaId?: string;
}

function ExplainerSection({
  title,
  icon: Icon,
  accentClass,
  borderClass,
  bgClass,
  summary,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
  borderClass: string;
  bgClass: string;
  summary?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className={`rounded-xl border ${borderClass} ${bgClass} backdrop-blur-sm`}>
      <CardHeader
        className={`${open ? "pb-2" : "pb-3"} cursor-pointer select-none`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <CardTitle className={`text-sm font-semibold flex items-start justify-between gap-2 ${accentClass}`}>
          <span className="flex flex-col gap-0.5 min-w-0">
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0" />
              {title}
            </span>
            {!open && summary && (
              <span className="text-[10px] font-normal text-slate-500 pl-6 leading-snug">{summary}</span>
            )}
          </span>
          {open ? <ChevronDown className="h-4 w-4 opacity-60 shrink-0 mt-0.5" /> : <ChevronRight className="h-4 w-4 opacity-60 shrink-0 mt-0.5" />}
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

export function KnytTreasuryTab({ personaId }: KnytTreasuryTabProps) {
  const { balance: knytBal, loading: knytLoading, refreshBalance } = useKnytBalance(personaId);
  const { balance: qcBal, loading: qcLoading, refresh: refreshQc } = useBaseQcBalance(personaId);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);

  function handleRefresh() {
    refreshBalance();
    refreshQc();
  }

  return (
    <div className="grid gap-4 p-4 md:p-6">
      {/* Header */}
      <Card className="rounded-xl border border-amber-800/30 bg-amber-950/10 backdrop-blur-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-amber-500/80 mb-0.5">KNYT Cartridge</p>
            <h2 className="text-xl font-semibold text-slate-100">Treasury &amp; Rewards</h2>
            <p className="text-xs text-slate-400 mt-0.5">Understand what the system holds, what it rewards, and how value is expressed here.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-amber-500/25 bg-amber-500/10 text-amber-300/70 backdrop-blur-sm text-[10px]">Alpha</Badge>
            <Badge variant="outline" className="border-slate-600/40 bg-slate-800/30 text-slate-400/70 backdrop-blur-sm text-[10px]">Provisional</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Live balance panel — shown only when personaId is present */}
      {personaId ? (
        <Card className="rounded-xl border border-slate-700 bg-slate-900/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-emerald-400" />
                Your Balance Preview
              </span>
              <button
                onClick={handleRefresh}
                className="text-slate-400 hover:text-slateald-200 transition"
                aria-label="Refresh balances"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${knytLoading || qcLoading ? "animate-spin" : ""}`} />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <FactRow
              label="$KNYT (DVN)"
              value={knytLoading ? "—" : (knytBal ? `${knytBal.dvnKnyt.toLocaleString()} KNYT` : "Not available")}
            />
            {knytBal?.evmKnyt !== undefined ? (
              <FactRow label="$KNYT (EVM)" value={`${knytBal.evmKnyt.toLocaleString()} KNYT`} />
            ) : null}
            <FactRow
              label="Qc (DVN)"
              value={qcLoading ? "—" : (qcBal ? `${qcBal.dvnQc.toLocaleString()} Q¢` : "Not available")}
            />
            <p className="text-xs text-slate-500 pt-1">
              DVN values are provisional until on-chain settlement. Spendable Qc credits are earned through KNYT interactions.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* KNYT Treasury Explainer */}
      <ExplainerSection
        title="The KNYT Treasury"
        icon={Vault}
        accentClass="text-amber-300"
        borderClass="border-amber-900/40"
        bgClass="bg-amber-950/10"
        summary="Holds $KNYT reserves + Qc operating capital · inflows from patronage &amp; protocol fees · outflows as rewards · governed by 21 Sats Stewards · provisional alpha state"
      >
        <p className="text-slate-300">
          The KNYT Treasury is the economic reserve that sustains the cartridge. It is not a speculative fund — it is the operational and reward capital of a governed world.
        </p>
        <div className="space-y-1 pt-1">
          <FactRow label="What it holds" value="$KNYT native asset reserves and Qc operating capital" />
          <FactRow label="What flows in" value="Patronage contributions, participation receipts, protocol fees" />
          <FactRow label="What flows out" value="Rewards, operational allocation, creator payments" />
          <FactRow label="Who governs it" value="KNYT Stewards via 21 Sats coordination layer" />
          <FactRow label="Your visibility" value="Provisional — alpha state; full transparency in post-alpha" />
        </div>
        <p className="text-xs text-slate-500 pt-2">
          In alpha, treasury state is represented provisionally. No live on-chain balances are displayed without explicit consent and wallet connection.
        </p>
      </ExplainerSection>

      {/* Rewards Explainer */}
      <ExplainerSection
        title="Rewards &amp; Recognition"
        icon={Sparkles}
        accentClass="text-emerald-300"
        borderClass="border-emerald-900/40"
        bgClass="bg-emerald-950/10"
        summary="Votes, curation, remixes, contributions earn provisional DVN receipts · finalised post-alpha via on-chain settlement · nothing you do in alpha is lost"
      >
        <p className="text-slate-300">
          Meaningful participation in KNYT is recognised and receipted. Rewards are not speculation — they are acknowledgement of real value added to the world.
        </p>
        <div className="space-y-1 pt-1">
          <FactRow label="What earns rewards" value="Votes, curation, remixes, contributions, correspondent signals" />
          <FactRow label="Provisional state" value="Reward is recognised and receipt-emitted, not yet settled" />
          <FactRow label="Finalised state" value="Confirmed on-chain or DVN-settled; spendable / transferable" />
          <FactRow label="Receipt format" value="DVN receipt — timestamped, persona-bound, action-traceable" />
          <FactRow label="Alpha behavior" value="All rewards provisional; finalisation in post-alpha phases" />
        </div>
        <p className="text-xs text-slate-500 pt-2">
          Provisional recognition matters: your participation is recorded now. The settlement mechanism finalises it later. Nothing you do in alpha is lost.
        </p>
      </ExplainerSection>

      {/* Qc vs $KNYT Explainer */}
      <ExplainerSection
        title="Qc vs $KNYT — The Governing Distinction"
        icon={Info}
        accentClass="text-sky-300"
        borderClass="border-sky-900/40"
        bgClass="bg-sky-950/10"
        summary="Qc = base pricing rail, 0 Q¢ in alpha · $KNYT = native value token, earned via participation · not interchangeable"
      >
        <p className="text-slate-300 font-medium">
          These are not the same thing. They must not be treated as interchangeable.
        </p>
        <div className="mt-2 grid md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">Q¢ (Qc)</p>
            <p className="text-xs text-slate-300">The operational unit. Prices and meters all actions inside the stack — skills, sessions, signals, receipts.</p>
            <p className="text-xs text-slate-400">Qc helps KNYT operate.</p>
          </div>
          <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">$KNYT</p>
            <p className="text-xs text-slate-300">The native value unit. Expresses, rewards, and recognises native KNYT participation. Held and earned by participants.</p>
            <p className="text-xs text-slate-400">$KNYT helps KNYT express and reward native value.</p>
          </div>
        </div>
        <div className="space-y-1 pt-2">
          <FactRow label="Qc pricing" value="Zero for alpha skills (0 Qc); post-alpha scales with action type" />
          <FactRow label="$KNYT earning" value="Provisional in alpha; finalised via participation receipts" />
          <FactRow label="Exchangeability" value="Qc and $KNYT are not directly interchangeable" />
        </div>
      </ExplainerSection>

      {/* Ask Kn0w1 CTA */}
      <Card className="rounded-xl border border-amber-700/30 bg-amber-950/10 backdrop-blur-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <p className="text-sm font-semibold text-amber-200 flex items-center gap-2">
              <Brain className="h-4 w-4 text-amber-400" />
              Ask Kn0w1 for a personal read
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Kn0w1 can explain treasury, rewards, and Qc vs $KNYT in the context of your specific stage and participation history.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold whitespace-nowrap"
            onClick={() => setCopilotOpen(true)}
          >
            Ask Kn0w1 <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>

      <CodexCopilotLayer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        onOpen={() => setCopilotOpen(true)}
        variant="floating"
        enableInferenceRendering
        personaId={personaId}
        contextId="knyt-treasury"
        messages={copilotMessages}
        onMessagesChange={setCopilotMessages}
      />
    </div>
  );
}
