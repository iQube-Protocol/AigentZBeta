"use client";

import React from "react";
import { FileText, CheckCircle, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

interface SovereigntyImpact {
  me: "benefits" | "neutral" | "constrains";
  c: "benefits" | "neutral" | "constrains";
  z: "benefits" | "neutral" | "constrains";
}

interface Decision {
  id: string;
  title: string;
  domain: string;
  status: string;
  date: string;
  initiative: string;
  summary: string;
  rationale: string;
  sovereigntyImpact: SovereigntyImpact;
  constitutionalBasis: string;
  registryReady: boolean;
}

const DECISIONS: Decision[] = [
  {
    id: "GD-001",
    title: "Agency is a constitutional principle, not a runtime principal",
    domain: "constitutional",
    status: "ratified",
    date: "2026-06-11",
    initiative: "Operation Chrysalis",
    summary: "Agency represents the preservation and balancing of individual, collective, and platform agency. It shall not be implemented as a root runtime agent.",
    rationale: "Avoids introducing unnecessary authority layers while preserving balanced representation across the three agency domains.",
    sovereigntyImpact: { me: "benefits", c: "benefits", z: "constrains" },
    constitutionalBasis: "sovereignty_first, representation",
    registryReady: true,
  },
  {
    id: "GD-002",
    title: "Four constitutional roles: myGuard, aigentMe, aigentC, aigentZ",
    domain: "constitutional",
    status: "ratified",
    date: "2026-06-11",
    initiative: "Operation Chrysalis",
    summary: "The constitutional hierarchy consists of myGuard (sovereignty layer), aigentMe (individual agency), aigentC (collective agency), and aigentZ (platform agency).",
    rationale: "Each domain of interest has explicit representation. No single agent may represent all interests.",
    sovereigntyImpact: { me: "benefits", c: "benefits", z: "benefits" },
    constitutionalBasis: "representation, dual_representation",
    registryReady: true,
  },
  {
    id: "GD-003",
    title: "Aigent ≠ generic AI agent — aigents are passported participants",
    domain: "passport",
    status: "ratified",
    date: "2026-06-11",
    initiative: "Operation Chrysalis",
    summary: "An aigent is a polity-compliant AI agent holding a valid Participant Passport. Generic AI agents have no polity standing.",
    rationale: "Distinguishes governed, accountable agents from arbitrary AI systems via passport requirement.",
    sovereigntyImpact: { me: "benefits", c: "benefits", z: "constrains" },
    constitutionalBasis: "bounded_delegation, constitutional_guardrails",
    registryReady: true,
  },
  {
    id: "GD-004",
    title: "@aigent handles as human-readable identity for passported participants",
    domain: "identity",
    status: "ratified",
    date: "2026-06-11",
    initiative: "Operation Chrysalis",
    summary: "Passported aigents use @<name>.aigent handles. Identity stack: Passport → RootDID → PersonaID → @aigent Handle.",
    rationale: "Human-readable, discoverable identity layer with cryptographic and governance credentials beneath.",
    sovereigntyImpact: { me: "benefits", c: "neutral", z: "benefits" },
    constitutionalBasis: "bounded_delegation, individual_sovereignty",
    registryReady: true,
  },
  {
    id: "GD-005",
    title: "Participant Passports are W3C Verifiable Credentials",
    domain: "passport",
    status: "ratified",
    date: "2026-06-11",
    initiative: "Operation Chrysalis",
    summary: "Polity Participant Passports use W3C VC format. Phase A: HMAC stub signing. Phase C: asymmetric, publicly verifiable proofs.",
    rationale: "W3C VC provides interoperability, standard verification, and clear upgrade path.",
    sovereigntyImpact: { me: "benefits", c: "neutral", z: "constrains" },
    constitutionalBasis: "bounded_delegation, sovereignty_first",
    registryReady: true,
  },
  {
    id: "GD-006",
    title: "AgentiQ Constitution governs platform; distinct from Polity Constitution",
    domain: "constitutional",
    status: "ratified",
    date: "2026-06-11",
    initiative: "Operation Chrysalis",
    summary: "The AgentiQ Constitution of Aigents governs the platform ecosystem. The broader Polity Constitution (future) governs the full polity.",
    rationale: "Clean separation of platform governance from societal governance, allowing independent evolution.",
    sovereigntyImpact: { me: "neutral", c: "benefits", z: "benefits" },
    constitutionalBasis: "constitutional_guardrails, dual_representation",
    registryReady: true,
  },
  {
    id: "GD-007",
    title: "Operation Chrysalis: evolution not replacement",
    domain: "fulfillment",
    status: "ratified",
    date: "2026-06-11",
    initiative: "Operation Chrysalis",
    summary: "The existing ecosystem already contains most required architecture. Focus is clarification, consolidation, elevation, governance, and autonomy.",
    rationale: "Repository audits show the architecture is significantly more mature than assumed. The gap is organizational, not foundational.",
    sovereigntyImpact: { me: "benefits", c: "benefits", z: "benefits" },
    constitutionalBasis: "fulfillment, sovereignty_first",
    registryReady: true,
  },
];

const IMPACT_CONFIG = {
  benefits: { icon: ArrowUpRight, color: "text-emerald-400" },
  neutral: { icon: Minus, color: "text-slate-400" },
  constrains: { icon: ArrowDownRight, color: "text-rose-400" },
} as const;

function ImpactBadge({ agency, level }: { agency: string; level: keyof typeof IMPACT_CONFIG }) {
  const { icon: Icon, color } = IMPACT_CONFIG[level];
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="text-[10px] text-slate-500">{agency}</span>
      <Icon className={`w-3 h-3 ${color}`} />
    </span>
  );
}

const DOMAIN_COLORS: Record<string, string> = {
  constitutional: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  passport: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  identity: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  fulfillment: "bg-green-500/20 text-green-300 border-green-500/30",
  governance: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

export function GovernanceDecisionLogTab() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-amber-400" />
          <h2 className="text-xl font-bold text-white">Governance Decision Log</h2>
        </div>
        <p className="text-sm text-slate-400">Ratified decisions and constitutional amendments from Operation Chrysalis</p>
      </div>

      <div className="space-y-3">
        {DECISIONS.map((d) => (
          <div key={d.id} className="p-4 rounded-lg bg-slate-800/30 border border-slate-700/30">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-slate-500">{d.id}</span>
                <h4 className="text-sm font-semibold text-white">{d.title}</h4>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs text-green-400">Ratified</span>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-2">{d.summary}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-1.5 py-0.5 rounded border ${DOMAIN_COLORS[d.domain] ?? DOMAIN_COLORS.governance}`}>
                {d.domain}
              </span>
              <span className="text-xs text-slate-500">{d.date}</span>
              <span className="text-xs text-slate-500">{d.initiative}</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Impact</span>
              <ImpactBadge agency="Me" level={d.sovereigntyImpact.me} />
              <ImpactBadge agency="C" level={d.sovereigntyImpact.c} />
              <ImpactBadge agency="Z" level={d.sovereigntyImpact.z} />
              <span className="text-[10px] text-slate-500 ml-2">Basis: {d.constitutionalBasis}</span>
              {d.registryReady && (
                <span className="text-[10px] px-1 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">Registry-ready</span>
              )}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              <span className="font-semibold">Rationale:</span> {d.rationale}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
