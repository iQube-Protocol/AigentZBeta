"use client";

/**
 * ActivityReceiptCard — Aigent Me Phase 7.
 * Per PRD v0.2 §9.2 Activity Receipt Card render contract.
 *
 * Renders one activity receipt with all its trace: agents/tools/iQubes
 * invoked, context shared, artifacts created, approvals granted.
 */

import React, { useCallback, useEffect, useState } from "react";
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
  ExternalLink,
  Link2,
} from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import { IntentChainPanel, type IntentChainDto } from "@/components/metame/workbench/IntentChainPanel";

export interface ActivityReceiptSpecialistResponse {
  title: string;
  summary: string;
  recommendations: string[];
  suggestedArtifacts: string[];
  confidence: "low" | "medium" | "high";
  source: "llm" | "template";
}

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
  /** Specialist response body when actionType === 'specialist_consulted'. */
  specialistResponse?: ActivityReceiptSpecialistResponse | null;
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
  mvl: "MVL",
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

  // Click-to-expand reveals: (1) the specialist response body when
  // present, (2) the chain-of-intent panel when this receipt has an
  // intentId (lazy-fetched), (3) the raw JSON drawer for power users.
  // The serialized JSON is the T1-safe ActivityReceiptData shape — no
  // T0 identifiers (personaId, authProfileId, rootDid) by construction.
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [chainState, setChainState] = useState<{
    loading: boolean;
    error: string | null;
    data: IntentChainDto | null;
  }>({ loading: false, error: null, data: null });

  // Lazy-fetch the intent-chain payload on first expand. Skips the
  // request when this receipt isn't intent-attached (e.g. orphan
  // compose-strip drafts) or when we've already loaded once.
  const fetchChain = useCallback(async () => {
    if (!data.intentId) return;
    setChainState({ loading: true, error: null, data: null });
    try {
      const res = await personaFetch(
        `/api/assistant/intent-chain?intentId=${encodeURIComponent(data.intentId)}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.error || `chain fetch failed (${res.status})`);
      }
      const json = (await res.json()) as IntentChainDto;
      setChainState({ loading: false, error: null, data: json });
    } catch (err) {
      setChainState({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
        data: null,
      });
    }
  }, [data.intentId]);

  useEffect(() => {
    if (!expanded || !data.intentId) return;
    if (chainState.data || chainState.loading) return;
    void fetchChain();
  }, [expanded, data.intentId, chainState.data, chainState.loading, fetchChain]);

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
          <ArtifactsReceiptLine items={data.artifactsCreated} chipClass={chipClass} mutedClass={mutedClass} isDark={isDark} />
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

      {/* Expanded payload: (1) specialist response body, (2) chain of
          intent panel, (3) collapsible raw JSON for power users. All
          T1-safe — no personaId, authProfileId, rootDid by construction. */}
      {expanded && (
        <div
          id={`receipt-${data.id}-json`}
          className="space-y-2 mt-2"
        >
          {/* (1) Specialist response body — when present. */}
          {data.specialistResponse && (
            <div
              className={`rounded-md border p-3 space-y-1.5 ${
                isDark ? "border-slate-700/60 bg-slate-900/60" : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] uppercase tracking-wider ${mutedClass}`}>
                  Specialist response
                </span>
                <span className={`text-[10px] uppercase tracking-wider ${mutedClass}`}>
                  · {data.specialistResponse.source}
                </span>
                <span className={`text-[10px] uppercase tracking-wider ${mutedClass}`}>
                  · {data.specialistResponse.confidence} confidence
                </span>
              </div>
              <p className={`text-xs leading-snug ${isDark ? "text-slate-100" : "text-slate-900"} font-medium`}>
                {data.specialistResponse.title}
              </p>
              <p className={`text-[11px] leading-snug ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                {data.specialistResponse.summary}
              </p>
              {data.specialistResponse.recommendations.length > 0 && (
                <ul className="list-disc pl-4 space-y-0.5">
                  {data.specialistResponse.recommendations.map((rec, i) => (
                    <li key={i} className={`text-[11px] leading-snug ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {rec}
                    </li>
                  ))}
                </ul>
              )}
              {data.specialistResponse.suggestedArtifacts.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className={`text-[10px] uppercase tracking-wider ${mutedClass}`}>Suggested</span>
                  {data.specialistResponse.suggestedArtifacts.map((a, i) => (
                    <span
                      key={i}
                      className={`px-1.5 py-0.5 rounded border text-[10px] ${
                        isDark
                          ? "border-slate-700 bg-slate-800/60 text-slate-300"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* (2) Chain of intent — lazy-fetched from /api/assistant/intent-chain
              when this receipt is intent-attached. Shows the same merged
              orchestration+receipts timeline as the workspace pill expand. */}
          {data.intentId && (
            <div
              className={`rounded-md border overflow-hidden ${
                isDark ? "border-slate-700/60" : "border-slate-200"
              }`}
            >
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 border-b ${
                  isDark ? "border-slate-700/60 bg-slate-900/60" : "border-slate-200 bg-slate-50"
                }`}
              >
                <Link2 className={`w-3 h-3 ${isDark ? "text-violet-300" : "text-violet-700"}`} />
                <span className={`text-[10px] uppercase tracking-wider ${mutedClass}`}>
                  Chain of intent
                </span>
              </div>
              <IntentChainPanel
                chainState={chainState}
                isDark={isDark}
                intentId={data.intentId ?? undefined}
                intentStatus={
                  (chainState.data as IntentChainDto & { intent?: { status?: string } } | null)
                    ?.intent?.status
                }
                onAdvanced={() => void fetchChain()}
              />
            </div>
          )}

          {/* (3) Raw JSON — collapsed by default, toggled via Show JSON. */}
          <div
            className={`rounded-md border ${
              isDark ? "border-slate-800/60 bg-slate-950/50" : "border-slate-200 bg-slate-50"
            }`}
          >
            <div
              className={`flex items-center justify-between px-3 py-1.5 ${
                showJson ? `border-b ${isDark ? "border-slate-800/60" : "border-slate-200"}` : ""
              }`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowJson((v) => !v);
                }}
                className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] ${mutedClass} ${
                  isDark ? "hover:text-slate-200" : "hover:text-slate-900"
                }`}
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${showJson ? "rotate-180" : ""}`} />
                {showJson ? "Hide receipt JSON" : "Show receipt JSON"}
              </button>
              {showJson && (
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
              )}
            </div>
            {showJson && (
              <pre
                className={`overflow-auto max-h-72 text-[11px] leading-snug p-3 font-mono ${
                  isDark ? "text-slate-300" : "text-slate-700"
                }`}
              >
                {json}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Per-type viewable URL builders for artifact badges. Keyed by the
 * prefix used in `activity_receipts.artifacts_created` (e.g. the
 * artifact-create route emits `google-doc:<documentId>`,
 * `gmail-draft:<draftId>`, etc.). Returning null means we can't link
 * to it — the badge renders as a plain chip.
 */
const ARTIFACT_URL_BUILDERS: Record<string, (id: string) => string> = {
  "google-doc":     (id) => `https://docs.google.com/document/d/${id}/edit`,
  "google-sheet":   (id) => `https://docs.google.com/spreadsheets/d/${id}/edit`,
  "google-slides":  (id) => `https://docs.google.com/presentation/d/${id}/edit`,
  "slide-outline":  (id) => `https://docs.google.com/presentation/d/${id}/edit`,
  "gmail-draft":    (id) => `https://mail.google.com/mail/u/0/#drafts/${id}`,
  "calendar-block": (id) => `https://calendar.google.com/calendar/u/0/r/eventedit/${id}`,
};

const ARTIFACT_LABELS: Record<string, string> = {
  "google-doc":     "Open in Drive",
  "google-sheet":   "Open in Drive",
  "google-slides":  "Open in Drive",
  "slide-outline":  "Open in Drive",
  "gmail-draft":    "Open in Gmail",
  "calendar-block": "Open in Calendar",
};

function buildArtifactUrl(entry: string): { type: string; id: string; url: string | null; label: string } {
  // Expected format: `<type>:<id>`. The artifact-create route always
  // emits this shape (route.ts:468 etc). Anything else: plain chip.
  const colonIdx = entry.indexOf(":");
  if (colonIdx === -1) return { type: "", id: "", url: null, label: entry };
  const type = entry.slice(0, colonIdx);
  const id = entry.slice(colonIdx + 1);
  const builder = ARTIFACT_URL_BUILDERS[type];
  // Guard against id being a title fallback (when the connector
  // didn't return a real id) — Drive ids are >=20 chars of [\w-]+.
  if (!builder || !id || id.length < 15 || !/^[\w-]+$/.test(id)) {
    return { type, id, url: null, label: entry };
  }
  return { type, id, url: builder(id), label: ARTIFACT_LABELS[type] ?? "Open" };
}

interface ArtifactsReceiptLineProps {
  items: string[];
  chipClass: string;
  mutedClass: string;
  isDark: boolean;
}

function ArtifactsReceiptLine({ items, chipClass, mutedClass, isDark }: ArtifactsReceiptLineProps) {
  // Same visual rhythm as ReceiptLine, but each artifact entry that
  // encodes a known Drive/Gmail/Calendar id renders as a clickable
  // launch button — closes the loop on the user's bug where the
  // receipt referenced an artifact but had no way to reach it.
  const linkClass = isDark
    ? "border-violet-500/40 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20"
    : "border-violet-400 bg-violet-50 text-violet-700 hover:bg-violet-100";
  return (
    <div className="flex items-center gap-1.5">
      <span className={`flex items-center gap-1 ${mutedClass}`}>
        <FileText className="w-3 h-3" />
        Artifacts:
      </span>
      <div className="flex flex-wrap gap-1">
        {items.map((entry) => {
          const { url, label, id } = buildArtifactUrl(entry);
          if (url) {
            return (
              <a
                key={entry}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors ${linkClass}`}
                title={`Open artifact ${id.slice(0, 12)}…`}
              >
                <ExternalLink className="w-2.5 h-2.5" />
                {label}
              </a>
            );
          }
          return (
            <span key={entry} className={`px-1.5 py-0.5 rounded border ${chipClass}`}>
              {entry}
            </span>
          );
        })}
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
