"use client";

import React, { useState } from "react";
import { Receipt, Shield, CheckCircle, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus, ChevronDown, Copy, Check, FileText } from "lucide-react";

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

interface RelatedDoc {
  label: string;
  path: string;
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
  relatedDocs?: RelatedDoc[];
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
    relatedDocs: [
      { label: "Sovereign Agent Roles", path: "services/governance/sovereignAgentRoles.ts" },
      { label: "Constitution Test", path: "tests/governance-constitution.test.ts" },
    ],
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
    relatedDocs: [
      { label: "Sovereign Agent Roles", path: "services/governance/sovereignAgentRoles.ts" },
      { label: "Governance Index", path: "services/governance/index.ts" },
    ],
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
    relatedDocs: [
      { label: "Aigent Classification", path: "services/governance/sovereignAgentRoles.ts" },
    ],
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
    relatedDocs: [
      { label: "Constitutional Entities", path: "services/governance/sovereignAgentRoles.ts" },
      { label: "Identity Spine", path: "services/identity/getActivePersona.ts" },
    ],
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
    relatedDocs: [
      { label: "Passport Credential", path: "services/passport/passportCredentialService.ts" },
    ],
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
    relatedDocs: [
      { label: "Decision Log", path: "services/governance/governanceDecisionLog.ts" },
      { label: "Governance Receipt Helper", path: "services/governance/governanceReceiptHelper.ts" },
    ],
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
    relatedDocs: [
      { label: "DVN Pipeline", path: "services/dvn/activityReceiptDvnPipeline.ts" },
      { label: "Activity Receipts", path: "services/receipts/activityReceiptService.ts" },
    ],
  },
];

const DVN_STATUS_STYLES: Record<string, { label: string; color: string }> = {
  local: { label: "Local", color: "bg-slate-500/20 text-slate-300" },
  dvn_pending: { label: "DVN Pending", color: "bg-yellow-500/20 text-yellow-300" },
  dvn_recorded: { label: "DVN Recorded", color: "bg-green-500/20 text-green-300" },
  dvn_failed: { label: "DVN Failed", color: "bg-red-500/20 text-red-300" },
};

function ReceiptCard({ r }: { r: GovernanceReceiptEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const actionMeta = GOVERNANCE_ACTION_LABELS[r.actionType] ?? { label: r.actionType, color: "text-slate-300" };
  const dvnMeta = DVN_STATUS_STYLES[r.dvnStatus] ?? DVN_STATUS_STYLES.local;

  const receiptPayload = {
    receiptId: r.id,
    decisionId: r.decisionId,
    actionType: r.actionType,
    summary: r.summary,
    constitutionalBasis: r.constitutionalBasis,
    authorityBasis: r.authorityBasis,
    affectedRoles: r.affectedRoles,
    sovereigntyImpact: r.sovereigntyImpact,
    dvnStatus: r.dvnStatus,
    date: r.date,
    registryReady: true,
    anchorTarget: "ic_canister",
    pipeline: "activityReceiptDvnPipeline",
  };

  const json = JSON.stringify(receiptPayload, null, 2);

  function handleCopy() {
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg bg-slate-800/30 border border-slate-700/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
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
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap mt-2">
          <ImpactStrip impact={r.sovereigntyImpact} />
          <span className="text-[10px] text-slate-500">{r.date}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700/30 pt-3">
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

          {r.relatedDocs && r.relatedDocs.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Related Docs</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {r.relatedDocs.map((doc) => (
                  <span
                    key={doc.path}
                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20"
                    title={doc.path}
                  >
                    <FileText className="w-2.5 h-2.5" />
                    {doc.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <button
              onClick={(e) => { e.stopPropagation(); setShowJson(!showJson); }}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${showJson ? "rotate-180" : ""}`} />
              Receipt JSON
            </button>
            {showJson && (
              <div className="mt-2 relative">
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                  className="absolute top-2 right-2 p-1 rounded bg-slate-700/80 hover:bg-slate-600/80 transition-colors"
                  title="Copy JSON"
                >
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                </button>
                <pre className="text-[10px] text-slate-300 bg-slate-900/50 border border-slate-700/30 rounded p-3 overflow-x-auto max-h-72 font-mono">
                  {json}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
        {FOUNDING_RECEIPTS.map((r) => (
          <ReceiptCard key={r.id} r={r} />
        ))}
      </div>
    </div>
  );
}
