/**
 * SpecialistWorkspace — the ONE reusable specialist conversation surface
 * (Aigent Factor / Aegis specialist-surfaces separation, 2026-09-05).
 *
 * Extracted from CandidateIntakePanel.tsx's own conversation section (the
 * only prior conversation UI for Factor/Aegis) and generalized so it also
 * serves Aigent Nakamoto and Aigent Know1's direct-consult modals — one
 * component, configured per specialist via props, never a per-specialist
 * fork (FactorChat/AegisChat do not exist and must not be created).
 *
 * Renders through the SAME SpecialistResponseCard every other specialist
 * response in this codebase already renders with — not a second card
 * system. Grounding (an optional bounded case/assessment context) goes
 * through services/moneypenny/caseContextConsultation.ts's generic
 * `askGroundedSpecialist` — never a parallel LLM-calling path.
 *
 * Threads are persisted (services/moneypenny/specialistThreadStore.ts),
 * append-only, keyed by personaId + specialistId + an optional bounded
 * scope id (a Factor caseId or an Aegis assessmentId, or null for a direct
 * consult) — so a Factor thread never appears under Aegis, and a modal's
 * conversation survives expanding into the full right-pane panel (same key
 * -> same persisted thread).
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Loader2, RotateCcw, ArrowRight } from "lucide-react";
import { SpecialistResponseCard, type SpecialistResponseData } from "@/components/metame/cards/SpecialistResponseCard";
import type { FactorActionDescriptor } from "@/services/factor/factorCapabilityManifest";
import { BankrTokenLaunchCapsule } from "@/components/moneypenny/bankr/BankrTokenLaunchCapsule";
import { personaFetch } from "@/utils/personaSpine";
import { askGroundedSpecialist } from "@/services/moneypenny/caseContextConsultation";
import {
  specialistThreadKey,
  loadThread,
  saveThread,
  clearThread,
  type ConsultTurn,
} from "@/services/moneypenny/specialistThreadStore";

export interface SpecialistWorkspaceAction {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

/**
 * A prompt suggestion (empty-state headline, or a followup chip) that
 * carries an explicit Factor capability id (capability-runtime contract
 * closure, 2026-09-05). When `capabilityId` is set, submitting this
 * suggestion sends it verbatim to /api/assistant/ask-agent — the operator's
 * explicit selection, never rediscovered by regex classification. A plain
 * `string` (no capabilityId) remains valid everywhere this type is accepted
 * — Aegis/Nakamoto/Kn0w1 have no capability concept and keep using strings.
 */
export interface SpecialistPromptSuggestion {
  /** Rendered button text. */
  label: string;
  /** Text actually submitted, if different from `label` (defaults to `label`). */
  prompt?: string;
  /** Explicit Factor capability id — Factor-only, ignored by every other specialist. */
  capabilityId?: string;
}

type PromptSuggestionLike = string | SpecialistPromptSuggestion;

function normalizeSuggestion(s: PromptSuggestionLike): { label: string; prompt: string; capabilityId?: string } {
  if (typeof s === "string") return { label: s, prompt: s };
  return { label: s.label, prompt: s.prompt ?? s.label, capabilityId: s.capabilityId };
}

export interface SpecialistWorkspaceProps {
  /** The MoneyPenny specialist id (used verbatim as /api/assistant/ask-agent's specialistId). */
  specialistId: "factor" | "aegis" | "nakamoto" | "kn0w1";
  specialistLabel: string;
  /** Shown as the empty-state headline prompt; clicking it seeds + submits the composer. */
  emptyStatePrompt: PromptSuggestionLike;
  placeholder: string;
  /** Chips rendered above the composer once a conversation is under way. */
  suggestedFollowups?: PromptSuggestionLike[];
  /** Typed domain actions (navigation/mode changes) — rendered as a row above the conversation. */
  actions?: SpecialistWorkspaceAction[];
  /** Bounds this thread to a case/assessment (never mixed with a direct-consult thread for the same specialist). */
  scopeId?: string | null;
  /** A prebuilt, bounded context block prefixed to every prompt in this thread (see caseContextConsultation.ts). Omit for a plain, ungrounded consult. */
  groundContextBlock?: string | null;
  /** Bounded workflow scope (e.g. this thread's open case) forwarded as
   *  `factorScope` — GROUNDING ONLY, never a classification signal.
   *  Factor-only; ignored by every other specialist. */
  factorScope?: { caseId?: string; agentRef?: string; serviceRef?: string };
  /** Client-classified structural refusal (e.g. "admit this candidate", self-assessment) — checked BEFORE any network call. Returning non-null renders a Refused card with no request made. */
  classifyRefusal?: (prompt: string) => string | null;
  /** Rendered as a button under a refused turn, if provided. */
  refusalActionLabel?: string;
  onRefusalAction?: () => void;
  /** Compact height for a modal; taller for a full right-pane panel. */
  variant?: "modal" | "full";
  /** Shown as a header action in "modal" variant — expands into the full panel. */
  onExpand?: () => void;
}

function newTurnId(): string {
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function askPlain(
  specialistId: string,
  prompt: string,
  factorCapabilityId?: string,
  factorScope?: { caseId?: string; agentRef?: string; serviceRef?: string },
): Promise<{ data: SpecialistResponseData | null; error: string | null }> {
  try {
    const res = await personaFetch("/api/assistant/ask-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        specialistId,
        prompt,
        cartridge: "moneypenny",
        ...(specialistId === "factor" && factorCapabilityId ? { factorCapabilityId } : {}),
        ...(specialistId === "factor" && factorScope ? { factorScope } : {}),
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = json && typeof json === "object" && typeof (json as { error?: unknown }).error === "string" ? (json as { error: string }).error : null;
      return { data: null, error: detail ?? `Consult failed (${res.status}).` };
    }
    return { data: json as SpecialistResponseData, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export function SpecialistWorkspace({
  specialistId,
  specialistLabel,
  emptyStatePrompt,
  placeholder,
  suggestedFollowups = [],
  actions = [],
  scopeId = null,
  groundContextBlock = null,
  factorScope,
  classifyRefusal,
  refusalActionLabel,
  onRefusalAction,
  variant = "full",
  onExpand,
}: SpecialistWorkspaceProps) {
  const storageKey = useMemo(() => specialistThreadKey(specialistId, scopeId), [specialistId, scopeId]);
  const [turns, setTurns] = useState<ConsultTurn[]>(() => loadThread(storageKey));
  const prevKeyRef = useRef(storageKey);
  const [composerText, setComposerText] = useState("");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  // Which turns have their inline Bankr tokenization console open — Factor-
  // only (bankr_tokenization actions), keyed per-turn so opening one turn's
  // console never affects another's (Phase 6 click-through wiring).
  const [bankrOpenTurns, setBankrOpenTurns] = useState<Record<string, boolean>>({});

  // A scope change (e.g. Factor's direct consult -> a just-opened case) is a
  // different thread by definition — reload rather than carry the previous
  // scope's turns forward.
  useEffect(() => {
    if (prevKeyRef.current === storageKey) return;
    prevKeyRef.current = storageKey;
    setTurns(loadThread(storageKey));
  }, [storageKey]);

  useEffect(() => {
    saveThread(storageKey, turns);
  }, [storageKey, turns]);

  const runConsult = useCallback(
    async (turnId: string, prompt: string, capabilityId?: string) => {
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, loading: true, error: null } : t)));
      const result = groundContextBlock
        ? await askGroundedSpecialist(specialistId, prompt, groundContextBlock, { factorCapabilityId: capabilityId, factorScope })
        : await askPlain(specialistId, prompt, capabilityId, factorScope);
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, loading: false, response: result.data, error: result.error } : t)));
    },
    [specialistId, groundContextBlock, factorScope],
  );

  const submitPrompt = useCallback(
    (prompt: string, capabilityId?: string) => {
      const text = prompt.trim();
      if (!text) return;
      const refusalMessage = classifyRefusal ? classifyRefusal(text) : null;
      const turnId = newTurnId();
      const turn: ConsultTurn = {
        id: turnId,
        prompt: text,
        response: null,
        error: null,
        loading: !refusalMessage,
        timestamp: new Date().toISOString(),
        refusalMessage,
        capabilityId,
      };
      setTurns((prev) => [...prev, turn]);
      if (!refusalMessage) void runConsult(turnId, text, capabilityId);
    },
    [classifyRefusal, runConsult],
  );

  const submitComposer = useCallback(() => {
    const text = composerText.trim();
    if (!text) return;
    submitPrompt(text);
    setComposerText("");
  }, [composerText, submitPrompt]);

  const retryTurn = useCallback(
    (turnId: string) => {
      const turn = turns.find((t) => t.id === turnId);
      if (!turn) return;
      // Resubmit with the SAME explicit capability selection, if the
      // original turn had one — a retry must never fall back to
      // re-classifying the text from scratch.
      void runConsult(turnId, turn.prompt, turn.capabilityId);
    },
    [turns, runConsult],
  );

  const newConversation = useCallback(() => {
    setTurns([]);
    clearThread(storageKey);
  }, [storageKey]);

  const askFollowUp = useCallback(() => {
    composerRef.current?.focus();
  }, []);

  /**
   * Factor's `availableActions` click-through (Phase 6). A
   * `bankr_tokenization:*` action beyond `explain` opens/toggles that turn's
   * inline BankrTokenLaunchCapsule — the ONE real console, never a second
   * chat turn — using the SAME beneficiary agent bound to this thread's
   * `factorScope.agentRef`, when one is bound (the capsule renders its own
   * honest "no agent bound" state otherwise, never a guessed id). Every
   * other action (explain, or any non-Bankr capability) resubmits as a
   * normal prompt turn, unchanged from the suggestion-chip behavior above.
   */
  const handleFactorAction = useCallback(
    (turnId: string, action: FactorActionDescriptor) => {
      const [capabilityId] = action.id.split(":");
      if (capabilityId === "bankr_tokenization" && action.mode !== "explain") {
        setBankrOpenTurns((prev) => ({ ...prev, [turnId]: !prev[turnId] }));
        return;
      }
      submitPrompt(action.label, capabilityId);
    },
    [submitPrompt],
  );

  const onComposerKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitComposer();
      }
    },
    [submitComposer],
  );

  const scrollAreaClass = variant === "modal" ? "max-h-[280px]" : "max-h-[480px]";

  return (
    <div className="flex flex-col gap-3">
      {(actions.length > 0 || onExpand) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {actions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={action.onSelect}
                  disabled={action.disabled}
                  className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-violet-500/50 disabled:opacity-50"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-100"
            >
              Expand to full panel <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {turns.length === 0 ? (
        <button
          type="button"
          onClick={() => {
            const s = normalizeSuggestion(emptyStatePrompt);
            submitPrompt(s.prompt, s.capabilityId);
          }}
          className="rounded-lg border border-slate-800 bg-slate-900/30 p-3 text-left text-sm text-slate-300 hover:border-violet-500/40"
        >
          {normalizeSuggestion(emptyStatePrompt).label}
        </button>
      ) : (
        <div className="flex items-center justify-end">
          <button type="button" onClick={newConversation} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
            <RotateCcw className="h-3 w-3" /> New conversation
          </button>
        </div>
      )}

      <div className={`flex ${scrollAreaClass} flex-col gap-3 overflow-y-auto`}>
        {turns.map((turn) => (
          <div key={turn.id} className="flex flex-col gap-1.5">
            <div className="self-end rounded-lg bg-violet-500/10 px-3 py-2 text-sm text-violet-100">{turn.prompt}</div>
            {turn.refusalMessage ? (
              <div className="flex flex-col gap-2 rounded-lg border border-rose-800/60 bg-rose-500/10 p-3">
                <span className="inline-flex w-fit items-center rounded-full border border-rose-700/60 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-200">
                  Refused
                </span>
                <p className="text-sm text-rose-100">{turn.refusalMessage}</p>
                {onRefusalAction && refusalActionLabel && (
                  <button type="button" onClick={onRefusalAction} className="inline-flex w-fit items-center gap-1 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-violet-500/50">
                    {refusalActionLabel} <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {/* One consistent affordance signal — SpecialistResponseCard's own
                    server-derived badge (data.affordance). A second, hardcoded
                    "Advisory guidance" pill used to render here unconditionally,
                    even for an ACTION_AVAILABLE/PLANNED response, contradicting
                    the card's own badge (Factor runtime-contract closure, Phase 1
                    continuation, 2026-09-05). */}
                <SpecialistResponseCard
                  data={turn.response}
                  loading={turn.loading}
                  error={turn.error}
                  theme="dark"
                  onAction={specialistId === "factor" ? (action) => handleFactorAction(turn.id, action) : undefined}
                />
                {specialistId === "factor" && bankrOpenTurns[turn.id] && (
                  <BankrTokenLaunchCapsule
                    initialPresentation="expanded"
                    beneficiaryAgentRuntimeId={factorScope?.agentRef}
                  />
                )}
                {turn.error && (
                  <button type="button" onClick={() => retryTurn(turn.id)} className="inline-flex w-fit items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
                    <RotateCcw className="h-3 w-3" /> Retry
                  </button>
                )}
              </div>
            )}
            {!turn.loading && (
              <button type="button" onClick={askFollowUp} className="self-start text-xs text-slate-500 hover:text-slate-300">
                Ask a follow-up
              </button>
            )}
          </div>
        ))}
      </div>

      {suggestedFollowups.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestedFollowups.map((suggestion) => {
            const s = normalizeSuggestion(suggestion);
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => submitPrompt(s.prompt, s.capabilityId)}
                className="rounded-full border border-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:border-violet-500/40"
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      <textarea
        ref={composerRef}
        value={composerText}
        onChange={(e) => setComposerText(e.target.value)}
        onKeyDown={onComposerKeyDown}
        placeholder={placeholder}
        rows={variant === "modal" ? 2 : 2}
        className="w-full rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60 focus:outline-none"
      />
      <div>
        <button
          type="button"
          onClick={submitComposer}
          disabled={!composerText.trim()}
          className="inline-flex items-center gap-2 rounded-full border border-violet-500/70 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-100 hover:bg-violet-500/20 disabled:opacity-50"
        >
          {turns.some((t) => t.loading) && <Loader2 className="h-4 w-4 animate-spin" />}
          Send to {specialistLabel}
        </button>
      </div>
    </div>
  );
}

export default SpecialistWorkspace;
