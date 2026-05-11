"use client";

/**
 * ActivityReceiptCard — Aigent Me Phase 7.
 * Per PRD v0.2 §9.2 Activity Receipt Card render contract.
 *
 * Renders one activity receipt with all its trace: agents/tools/iQubes
 * invoked, context shared, artifacts created, approvals granted.
 */

import React from "react";
import {
  Receipt,
  Users,
  Wrench,
  Layers,
  ShieldCheck,
  Clipboard,
  FileText,
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

export function ActivityReceiptCard({ data, theme = "dark" }: Props) {
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

  return (
    <div className={`rounded-lg border p-4 ${surfaceClass} space-y-2`}>
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
        <span className={`shrink-0 px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full border ${status.ring}`}>
          {status.label}
        </span>
      </div>

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

      <div className={`text-[11px] ${mutedClass} flex items-center gap-2 pt-1 border-t border-slate-800/40`}>
        <span>{new Date(data.createdAt).toLocaleString()}</span>
        {data.dvnReceiptId && (
          <span className="ml-auto">DVN: <span className="font-mono">{data.dvnReceiptId.slice(0, 10)}…</span></span>
        )}
      </div>
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
