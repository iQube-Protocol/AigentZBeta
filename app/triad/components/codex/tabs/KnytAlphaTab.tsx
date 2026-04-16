"use client";

/**
 * KnytAlphaTab — Kn0w1-first Venture Lab α entry point
 *
 * Presents the Venture Lab α programme framing inside the KNYT Cartridge.
 * Know1 is the primary guide. This tab explains the alpha experience,
 * surfaces Know1's 8 curated skills, and directs users to engage Know1.
 *
 * Design rules:
 * - Extends KnytTreasuryTab patterns (ExplainerSection, FactRow, card primitives)
 * - Does NOT touch KnytRuntimeSurface — zero Phase 1 collision
 * - All skill data is static for alpha (spec 18: "alpha should not do: full skills marketplace UX")
 * - Provisional state banner carried forward from treasury tab pattern
 */

import { useState } from "react";
import {
  ArrowRight,
  Brain,
  ChevronDown,
  ChevronRight,
  Cpu,
  FlaskConical,
  Layers,
  Sparkles,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

// ─── Know1 Alpha skill family (static for alpha per spec 18) ─────────────────

const KNOW1_ALPHA_SKILLS = [
  {
    id: "information_value_interpret",
    name: "Information Value Interpreter",
    description: "Frames what knowledge or content is worth inside the KNYT system without overstating.",
  },
  {
    id: "risk_frame_humanize",
    name: "Risk Frame Humanizer",
    description: "Translates risk and uncertainty into plain language — provisional states, volatility, uncertain outcomes.",
  },
  {
    id: "pricing_logic_explain",
    name: "Pricing Logic Explainer",
    description: "Makes the Qc economic grammar legible — how skills, sessions, and actions are priced.",
  },
  {
    id: "knyt_treasury_explain",
    name: "KNYT Treasury Explainer",
    description: "Explains the KNYT Treasury clearly — what it holds, what flows in and out, how it sustains the world.",
  },
  {
    id: "knyt_rewards_explain",
    name: "KNYT Rewards Explainer",
    description: "Explains the rewards model — what earns recognition, provisional vs finalised state.",
  },
  {
    id: "qc_vs_knyt_explain",
    name: "Qc vs $KNYT Distinction",
    description: "Qc helps KNYT operate. $KNYT expresses and rewards native value. These must not be conflated.",
  },
  {
    id: "21sats_structure_explain",
    name: "21 Sats Structure Explainer",
    description: "Explains 21 Sats as the KNYT community world — coordination, feeder path toward AVS.",
  },
  {
    id: "opportunity_shape",
    name: "Opportunity Shaper",
    description: "Surfaces a participant's next real move — venture pathways, contribution opportunities, progression steps.",
  },
] as const;

// ─── Sub-components (same pattern as KnytTreasuryTab) ────────────────────────

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
          {open ? (
            <ChevronDown className="h-4 w-4 opacity-60" />
          ) : (
            <ChevronRight className="h-4 w-4 opacity-60" />
          )}
        </CardTitle>
      </CardHeader>
      {open ? <CardContent className="space-y-2 text-sm">{children}</CardContent> : null}
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

// ─── Main component ───────────────────────────────────────────────────────────

export function KnytAlphaTab() {
  const router = useRouter();

  return (
    <div className="grid gap-4 p-4 md:p-6">
      {/* Header */}
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
            <Badge className="border-amber-800 bg-amber-950 text-amber-300">Alpha</Badge>
            <Badge variant="outline" className="border-slate-700 text-slate-300">Provisional</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Alpha scope */}
      <ExplainerSection
        title="What This Alpha Proves"
        icon={FlaskConical}
        accentClass="text-violet-300"
        borderClass="border-violet-900/40"
        bgClass="bg-violet-950/10"
      >
        <p className="text-slate-300">
          The Venture Lab α target is a Know1-first living cartridge that demonstrates the platform&apos;s core propositions at small scale before broader rollout.
        </p>
        <div className="space-y-1 pt-1">
          <FactRow label="Cartridge-native experience" value="KNYT as the primary coordinate" />
          <FactRow label="Treasury and rewards visibility" value="Explained, not speculated on" />
          <FactRow label="Qc vs $KNYT" value="Distinction held clearly throughout" />
          <FactRow label="Receipted participation" value="Meaningful actions receipt-emitted via DVN" />
          <FactRow label="Curated internal skills" value="Know1's 8-skill alpha family" />
          <FactRow label="21 Sats coordination" value="Community world framing in place" />
          <FactRow label="metaMe controls" value="Personal sovereignty defaults available" />
        </div>
        <p className="text-xs text-slate-500 pt-2">
          Alpha does not include: broad registry browsing, full skills marketplace UX, deep treasury ops, or heavy token dashboarding.
        </p>
      </ExplainerSection>

      {/* Know1 role */}
      <ExplainerSection
        title="Know1 — The Alpha Guide"
        icon={Brain}
        accentClass="text-amber-300"
        borderClass="border-amber-900/40"
        bgClass="bg-amber-950/10"
      >
        <p className="text-slate-300">
          Know1 is the reference agent for knowledge synthesis, mythos-to-action translation, treasury interpretation, and live commercial movement. In alpha, Know1 is the primary guide into the KNYT experience.
        </p>
        <div className="space-y-1 pt-1">
          <FactRow label="Role" value="Knowledge synthesis, lore translation, opportunity shaping" />
          <FactRow label="Cartridge overlays" value="KNYT, AgentiQ, Qriptopian" />
          <FactRow label="Trust band" value="L4 Production Approved" />
          <FactRow label="Pricing" value="0 Q¢ (alpha — all skills free)" />
          <FactRow label="Receipt" value="Emitted on treasury and rewards interactions" />
        </div>
        <p className="text-xs text-slate-500 pt-2">
          Concise directive: Know1 interprets, frames, guides, and activates value from meaning.
        </p>
      </ExplainerSection>

      {/* Know1 alpha skill family */}
      <ExplainerSection
        title="Know1 Alpha Skill Family (8 skills)"
        icon={Cpu}
        accentClass="text-sky-300"
        borderClass="border-sky-900/40"
        bgClass="bg-sky-950/10"
      >
        <p className="text-slate-300">
          These are the curated internal skills Know1 draws from in the KNYT cartridge context. All are priced at 0 Q¢ and receipt-emitting where noted.
        </p>
        <div className="grid md:grid-cols-2 gap-2 pt-1">
          {KNOW1_ALPHA_SKILLS.map((skill) => (
            <div
              key={skill.id}
              className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 space-y-1"
            >
              <p className="text-xs font-semibold text-sky-300">{skill.name}</p>
              <p className="text-xs text-slate-400">{skill.description}</p>
            </div>
          ))}
        </div>
      </ExplainerSection>

      {/* AgentiQ OS primitives */}
      <ExplainerSection
        title="AgentiQ OS Primitives Backing This Alpha"
        icon={Layers}
        accentClass="text-emerald-300"
        borderClass="border-emerald-900/40"
        bgClass="bg-emerald-950/10"
      >
        <p className="text-slate-300">
          Venture Lab α runs on the live AgentiQ OS primitive layer. These are not stubs — they are operational service contracts.
        </p>
        <div className="space-y-1 pt-1">
          <FactRow label="AgentQube registry" value="AigentQube card for each reference agent" />
          <FactRow label="SkillQube registry" value="8 Know1 alpha skills published to registry_assets" />
          <FactRow label="$KNYT ledger" value="DVN-backed provisional balance via knyt_ledger" />
          <FactRow label="Rewards service" value="DVN receipt emission on participation actions" />
          <FactRow label="Orchestration" value="JourneyState + NBEPlan routing for KNYT context" />
          <FactRow label="Policy evaluation" value="KNYT cartridge policy + explanation-first posture" />
        </div>
      </ExplainerSection>

      {/* Venture path */}
      <ExplainerSection
        title="Your Path Into the Alpha"
        icon={Zap}
        accentClass="text-rose-300"
        borderClass="border-rose-900/40"
        bgClass="bg-rose-950/10"
      >
        <p className="text-slate-300">
          The alpha experience is self-guided through Know1. There is no onboarding funnel yet — engage Know1, explore the tabs, and let participation receipts build your provisional record.
        </p>
        <div className="space-y-1 pt-1">
          <FactRow label="Start" value="Ask Know1 anything about the KNYT world" />
          <FactRow label="Explore" value="Treasury, Rewards, 21 Sats tabs — all live" />
          <FactRow label="Participate" value="Vote, curate, contribute — all receipt-emitting" />
          <FactRow label="Progress" value="Order of Metaiye progression in the Order tab" />
        </div>
        <p className="text-xs text-slate-500 pt-2">
          All participation in alpha is provisional. Your record is stored. Nothing is lost. Settlement happens in post-alpha phases.
        </p>
      </ExplainerSection>

      {/* Know1 CTA */}
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
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold whitespace-nowrap"
            onClick={() => router.push("/aigents/aigent-kn0w1")}
          >
            Talk to Know1 <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
