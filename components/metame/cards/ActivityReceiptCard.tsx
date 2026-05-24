"use client";

/**
 * ActivityReceiptCard — Aigent Me Phase 7.
 * Per PRD v0.2 §9.2 Activity Receipt Card render contract.
 *
 * Renders one activity receipt with all its trace: agents/tools/iQubes
 * invoked, context shared, artifacts created, approvals granted.
 */

import React, { useCallback, useState } from "react";
import {
  Receipt,
  Users,
  Wrench,
  Layers,
  ShieldCheck,
  Clipboard,
  FileText,
  ChevronDown,
  Copy,
  Check,
} from "lucide-react";

export interface ActivityReceiptData {
  id: string;
  sessionId: string | null;
  intentId: string | null;
  activeCartridge: string;
  actionType: string;
  summary: string;
  agentsInvoked: string[];
  toolsUsed: string[];
  iqubesUsed: string[];
  contextShared: string[];
  artifactsCreated: string[];
  approvalsGranted: string[];
  policyEnvelopeId: string | null;
  receiptStatus: "local" | "dvn_pending" | "dvn_recorded" | "dvn_failed";
  dvnReceiptId: string | null;
  createdAt: string;
}

interface Props {
  data: ActivityReceiptData;
  /**
   * T1-safe persona display label resolved server-side by the receipts
   * endpoint. Surfaced as an "Acting persona" footer so the user can see
   * which bounded persona originated the receipt without ever exposing
   * personaId, authProfileId, rootDid, or any T0 identifier. Per the
   * PersonaSpine / DiDQube client protocol contract.
   */
  personaDisplayLabel?: string | null;
  theme?: "light" | "dark";
}

const ACTION_LABELS: Record<string, string> = {
  intent_queued: "Intent queued",
  specialist_consulted: "Specialist consulted",
  artifact_created: "Artifact created",
  artifact_sent: "Artifact sent",
  approval_granted: "Approval granted",
  approval_rejected: "Approval rejected",
  experience_model_updated: "ExperienceModel updated",
  session_started: "Session started",
  session_completed: "Session completed",
};

const STATUS_META: Record<
  ActivityReceiptData["receiptStatus"],
  { label: string; ring: string }
> = {
  local:        { label: "Local",        ring: "border-slate-700 text-slate-300" },
  dvn_pending:  { label: "DVN pending",  ring: "border-amber-500/40 text-amber-300 bg-amber-500/10" },
  dvn_recorded: { label: "DVN recorded", ring: "border-emerald-500/70 text-emerald-100 bg-emerald-500/15" },
  dvn_failed:   { label: "DVN failed",   ring: "border-rose-500/40 text-rose-300 bg-rose-500/10" },
};

const CARTRIDGE_LABELS: Record<string, string> = {
  metame: "metaMe",
  knyt: "KNYT",
  qriptopian: "The Qriptopian",
  marketa: "Marketa",
  avl: "AVL",
};

export function ActivityReceiptCard({ data, personaDisplayLabel, theme = "dark" }: Props) {
  const isDark = theme === "dark";
  const surfaceClass = isDark
    ? "bg-slate-900/40 border-slate-700/60 text-slate-100"
    : "bg-white border-slate-200 text-slate-900";
  const mutedClass = isDark ? "text-slate-400" : "text-slate-600";
  const accentClass = isDark ? "text-violet-300" : "text-violet-700";
  const chipClass = isDark
    ? "bg-slate-800/60 border-slate-700 text-slate-300"
    : "bg-slate-100 border-slate-200 text-slate-700";

  const status = STATUS_META[data.receiptStatus];

  // Click-to-expand toggles a raw-JSON drawer at the bottom of the card.
  // The serialized object is the T1-safe ActivityReceiptData shape — no
  // T0 identifiers (personaId, authProfileId, rootDid) by construction.
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const json = JSON.stringify(data, null, 2);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(json);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        /* ignore — clipboard permission edge case */
      }
    },
    [json],
  );

  return (
    <div className={`rounded-lg border p-4 ${surfaceClass} space-y-2`}>
      {/* Header is the click target — toggles a raw-JSON drawer at the
          bottom of the card. Keyboard accessible via the <button>. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={`receipt-${data.id}-json`}
        className="w-full text-left rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className={`flex items-center gap-2 text-xs uppercase tracking-wider ${mutedClass}`}>
              <Receipt className={`w-3.5 h-3.5 ${accentClass}`} />
              {ACTION_LABELS[data.actionType] ?? data.actionType}
              <span>·</span>
              <span>{CARTRIDGE_LABELS[data.activeCartridge] ?? data.activeCartridge}</span>
            </div>
            <h4 className="font-medium mt-0.5">{data.summary}</h4>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full border ${status.ring}`}>
              {status.label}
            </span>
            <ChevronDown
              className={`h-4 w-4 ${mutedClass} transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </div>
        </div>
      </button>

      <div className="flex flex-wrap gap-2 text-[11px]">
        {data.agentsInvoked.length > 0 && (
          <ReceiptLine icon={<Users className="w-3 h-3" />} label="Agents" items={data.agentsInvoked} chipClass={chipClass} mutedClass={mutedClass} />
        )}
        {data.toolsUsed.length > 0 && (
          <ReceiptLine icon={<Wrench className="w-3 h-3" />} label="Tools" items={data.toolsUsed} chipClass={chipClass} mutedClass={mutedClass} />
        )}
        {data.iqubesUsed.length > 0 && (
          <ReceiptLine icon={<Layers className="w-3 h-3" />} label="iQubes" items={data.iqubesUsed} chipClass={chipClass} mutedClass={mutedClass} />
        )}
        {data.contextShared.length > 0 && (
          <ReceiptLine icon={<Clipboard className="w-3 h-3" />} label="Context" items={data.contextShared} chipClass={chipClass} mutedClass={mutedClass} />
        )}
        {data.artifactsCreated.length > 0 && (
          <ReceiptLine icon={<FileText className="w-3 h-3" />} label="Artifacts" items={data.artifactsCreated} chipClass={chipClass} mutedClass={mutedClass} />
        )}
        {data.approvalsGranted.length > 0 && (
          <ReceiptLine icon={<ShieldCheck className="w-3 h-3" />} label="Approvals" items={data.approvalsGranted.map((id) => `${id.slice(0, 8)}…`)} chipClass={chipClass} mutedClass={mutedClass} />
        )}
      </div>

      <div className={`text-[11px] ${mutedClass} flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/40`}>
        <span>{new Date(data.createdAt).toLocaleString()}</span>
        {personaDisplayLabel && (
          // T1 persona display label only — never the persona id, root
          // DiD, or auth profile. Per PersonaSpine / DiDQube contract.
          <span className="ml-2">
            Acting persona:{" "}
            <span className={accentClass}>{personaDisplayLabel}</span>
          </span>
        )}
        {data.dvnReceiptId && (
          <span className="ml-auto">DVN: <span className="font-mono">{data.dvnReceiptId.slice(0, 10)}…</span></span>
        )}
      </div>

      {/* JSON drawer — collapsed by default; expanded via the header
          click. Renders the T1-safe receipt payload as pretty JSON with
          a copy affordance. No T0 fields by construction. */}
      {expanded && (
        <div
          id={`receipt-${data.id}-json`}
          className={`mt-2 rounded-md border ${
            isDark
              ? "border-slate-800/60 bg-slate-950/50"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <div className={`flex items-center justify-between px-3 py-1.5 border-b ${
            isDark ? "border-slate-800/60" : "border-slate-200"
          }`}>
            <span className={`text-[10px] uppercase tracking-[0.16em] ${mutedClass}`}>
              Receipt JSON
            </span>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? "Copied" : "Copy receipt JSON"}
              title={copied ? "Copied" : "Copy JSON"}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] ${
                isDark
                  ? "text-slate-300 hover:bg-slate-800/60"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre
            className={`overflow-auto max-h-72 text-[11px] leading-snug p-3 font-mono ${
              isDark ? "text-slate-300" : "text-slate-700"
            }`}
          >
            {json}
          </pre>
        </div>
      )}
    </div>
  );
}

interface ReceiptLineProps {
  icon: React.ReactNode;
  label: string;
  items: string[];
  chipClass: string;
  mutedClass: string;
}

function ReceiptLine({ icon, label, items, chipClass, mutedClass }: ReceiptLineProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`flex items-center gap-1 ${mutedClass}`}>
        {icon}
        {label}:
      </span>
      <div className="flex flex-wrap gap-1">
        {items.map((it) => (
          <span key={it} className={`px-1.5 py-0.5 rounded border ${chipClass}`}>
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

export default ActivityReceiptCard;
