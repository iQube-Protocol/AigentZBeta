"use client";

import React from "react";
import { Receipt, Shield, CheckCircle, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

const GOVERNANCE_ACTION_LABELS: Record<string, { label: string; color: string }> = {
  governance_decision_ratified: { label: "Decision Ratified", color: "text-green-400" },
  governance_decision_amended: { label: "Decision Amended", color: "text-yellow-400" },
  governance_authority_exercised: { label: "Authority Exercised", color: "text-blue-400" },
  governance_escalation_triggered: { label: "Escalation Triggered", color: "text-red-400" },
};

const IMPACT_ICONS = {
  benefits: { icon: ArrowUpRight, color: "text-emerald-400", label: "Benefits" },
  neutral: { icon: Minus, color: "text-slate-400", label: "Neutral" },
  constrains: { icon: ArrowDownRight, color: "text-rose-400", label: "Constrains" },
} as const;

interface SovereigntyImpactDisplay {
  me: "benefits" | "neutral" | "constrains";
  c: "benefits" | "neutral" | "constrains";
  z: "benefits" | "neutral" | "constrains";
}

function ImpactBadge({ agency, level }: { agency: string; level: keyof typeof IMPACT_ICONS }) {
  const { icon: Icon, color, label } = IMPACT_ICONS[level];
  return (
    <div className="flex items-center gap-1" title={`${agency}: ${label}`}>
      <span className="text-[10px] text-slate-500">{agency}</span>
      <Icon className={`w-3 h-3 ${color}`} />
    </div>
  );
}

function ImpactStrip({ impact }: { impact: SovereigntyImpactDisplay }) {
  return (
    <div className="flex items-center gap-3">
      <ImpactBadge agency="Me" level={impact.me} />
      <ImpactBadge agency="C" level={impact.c} />
      <ImpactBadge agency="Z" level={impact.z} />
    </div>
  );
}

interface GovernanceReceiptEntry {
  id: string;
  decisionId: string;
  actionType: string;
  summary: string;
  constitutionalBasis: string;
  authorityBasis: string;
  affectedRoles: string[];
  sovereigntyImpact: SovereigntyImpactDisplay;
  dvnStatus: "local" | "dvn_pending" | "dvn_recorded" | "dvn_failed";
  date: string;
}

const FOUNDING_RECEIPTS: GovernanceReceiptEntry[] = [
  {
    id: "GR-001",
    decisionId: "GD-001",
    actionType: "governance_decision_ratified",
    summary: "Agency is a constitutional principle, not a runtime principal",
    constitutionalBasis: "sovereignty_first, representation",
    authorityBasis: "Operation Chrysalis founding authority",
    affectedRoles: ["aigentMe", "aigentC", "aigentZ"],
    sovereigntyImpact: { me: "benefits", c: "benefits", z: "constrains" },
    dvnStatus: "local",
    date: "2026-06-11",
  },
  {
    id: "GR-002",
    decisionId: "GD-002",
    actionType: "governance_decision_ratified",
    summary: "Four constitutional roles: myGuard, aigentMe, aigentC, aigentZ",
    constitutionalBasis: "representation, dual_representation",
    authorityBasis: "Operation Chrysalis founding authority",
    affectedRoles: ["metame_guardian", "aigentMe", "aigentC", "aigentZ"],
    sovereigntyImpact: { me: "benefits", c: "benefits", z: "benefits" },
    dvnStatus: "local",
    date: "2026-06-11",
  },
  {
    id: "GR-003",
    decisionId: "GD-003",
    actionType: "governance_decision_ratified",
    summary: "Aigents are passported participants, not generic AI agents",
    constitutionalBasis: "bounded_delegation, constitutional_guardrails",
    authorityBasis: "Operation Chrysalis founding authority",
    affectedRoles: ["aigentMe", "aigentC", "aigentZ"],
    sovereigntyImpact: { me: "benefits", c: "benefits", z: "constrains" },
    dvnStatus: "local",
    date: "2026-06-11",
  },
  {
    id: "GR-004",
    decisionId: "GD-004",
    actionType: "governance_decision_ratified",
    summary: "@aigent handles as human-readable identity for passported participants",
    constitutionalBasis: "bounded_delegation, individual_sovereignty",
    authorityBasis: "Operation Chrysalis founding authority",
    affectedRoles: ["aigentMe", "aigentZ"],
    sovereigntyImpact: { me: "benefits", c: "neutral", z: "benefits" },
    dvnStatus: "local",
    date: "2026-06-11",
  },
  {
    id: "GR-005",
    decisionId: "GD-005",
    actionType: "governance_decision_ratified",
    summary: "Participant Passports are W3C Verifiable Credentials",
    constitutionalBasis: "bounded_delegation, sovereignty_first",
    authorityBasis: "Operation Chrysalis founding authority",
    affectedRoles: ["aigentMe", "aigentZ"],
    sovereigntyImpact: { me: "benefits", c: "neutral", z: "constrains" },
    dvnStatus: "local",
    date: "2026-06-11",
  },
  {
    id: "GR-006",
    decisionId: "GD-006",
    actionType: "governance_decision_ratified",
    summary: "AgentiQ Constitution governs platform; distinct from Polity Constitution",
    constitutionalBasis: "constitutional_guardrails, dual_representation",
    authorityBasis: "Operation Chrysalis founding authority",
    affectedRoles: ["metame_guardian", "aigentMe", "aigentC", "aigentZ"],
    sovereigntyImpact: { me: "neutral", c: "benefits", z: "benefits" },
    dvnStatus: "local",
    date: "2026-06-11",
  },
  {
    id: "GR-007",
    decisionId: "GD-007",
    actionType: "governance_decision_ratified",
    summary: "Operation Chrysalis: evolution not replacement",
    constitutionalBasis: "fulfillment, sovereignty_first",
    authorityBasis: "Operation Chrysalis founding authority",
    affectedRoles: ["metame_guardian", "aigentMe", "aigentC", "aigentZ"],
    sovereigntyImpact: { me: "benefits", c: "benefits", z: "benefits" },
    dvnStatus: "local",
    date: "2026-06-11",
  },
];

const DVN_STATUS_STYLES: Record<string, { label: string; color: string }> = {
  local: { label: "Local", color: "bg-slate-500/20 text-slate-300" },
  dvn_pending: { label: "DVN Pending", color: "bg-yellow-500/20 text-yellow-300" },
  dvn_recorded: { label: "DVN Recorded", color: "bg-green-500/20 text-green-300" },
  dvn_failed: { label: "DVN Failed", color: "bg-red-500/20 text-red-300" },
};

export function GovernanceReceiptsTab() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Receipt className="w-6 h-6 text-amber-400" />
          <h2 className="text-xl font-bold text-white">Governance Receipts</h2>
        </div>
        <p className="text-sm text-slate-400">
          DVN-anchored receipts for constitutional decisions, authority exercises, and escalations
        </p>
      </div>

      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
        <Shield className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-200">
          Governance receipts flow through the same DVN pipeline as all activity receipts.
          Once anchored, decisions become tamper-evident and auditable on-chain.
        </p>
      </div>

      <div className="space-y-3">
        {FOUNDING_RECEIPTS.map((r) => {
          const actionMeta = GOVERNANCE_ACTION_LABELS[r.actionType] ?? { label: r.actionType, color: "text-slate-300" };
          const dvnMeta = DVN_STATUS_STYLES[r.dvnStatus] ?? DVN_STATUS_STYLES.local;
          return (
            <div key={r.id} className="p-4 rounded-lg bg-slate-800/30 border border-slate-700/30 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-slate-500">{r.id}</span>
                    <span className="text-xs font-mono text-slate-500">{r.decisionId}</span>
                    <span className={`text-xs font-semibold ${actionMeta.color}`}>{actionMeta.label}</span>
                  </div>
                  <p className="text-sm text-white">{r.summary}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${dvnMeta.color}`}>{dvnMeta.label}</span>
                  {r.dvnStatus === "dvn_recorded" && <CheckCircle className="w-3.5 h-3.5 text-green-400" />}
                  {r.dvnStatus === "dvn_failed" && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <ImpactStrip impact={r.sovereigntyImpact} />
                <span className="text-[10px] text-slate-500">{r.date}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Constitutional Basis: </span>
                  <span className="text-slate-300">{r.constitutionalBasis}</span>
                </div>
                <div>
                  <span className="text-slate-500">Authority: </span>
                  <span className="text-slate-300">{r.authorityBasis}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {r.affectedRoles.map((role) => (
                  <span key={role} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300">
                    {role}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
