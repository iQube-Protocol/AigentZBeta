"use client";

/**
 * RemixDialog — consumer-facing remix flow for runtime experience capsules.
 *
 * Two states:
 *   1. Compose — skill toggle (article ↔ story), title, prompt. Q¢ cost +
 *      free-remaining displayed at the bottom. Submit calls the
 *      /api/community-content/generate endpoint.
 *   2. Preview — shows the generated title, image, and body with
 *      Discard / Share / Publish actions. Discard refunds inside the 30s
 *      window (1/day). Share writes to localStorage so social-share
 *      pickers can pick it up. Publish flips the row to 'shared' and
 *      surfaces it in the Community Content tab.
 *
 * No financial controls — this is the consumer remix UI; the admin
 * customize panel (RuntimeCapsuleAdminEditor) is separate and unchanged.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Coins, FileText, Image as ImageIcon, Loader2, LogIn, RotateCw, Send, Share2, Sparkles, Trash2, X } from "lucide-react";
import { checkSpineDecision, type SpineDecision } from "@/services/access/spineGateClient";
import { personaFetch } from "@/utils/personaSpine";

type Skill = "article" | "story";

// ─── Interim sign-in gating flag ──────────────────────────────────────────────
// The client-side sign-in gate (banner, "Sign in required" copy, disabled
// Generate button) is disabled while the spine-based remix access policy is
// being re-wired. The backend remains the source of truth for auth/quota/
// policy decisions; the dialog now lets the user attempt generation and
// surfaces any server error via the existing error pathway. Flip back to
// `true` to restore the original UI gate.
const SIGNIN_GATING_ENABLED = false;

interface QuotaCosts {
  article: { baseQc: number; surchargedQc: number; currentQc: number };
  story:   { baseQc: number; surchargedQc: number; currentQc: number };
}

interface QuotaState {
  freeRemaining: number;
  refundRemaining: number;
  costs: QuotaCosts;
  limits: {
    dailyFreeQuota: number;
    dailyDiscardRefund: number;
    discardWindowSeconds: number;
    surchargePct: number;
  };
}

interface GeneratedContent {
  id: string;
  title: string;
  articleBody: string;
  imageUrl: string | null;
  qcCost: number;
  refundableUntil: string;
}

interface Props {
  open: boolean;
  personaId: string | null;
  /** While true, the async persona resolver is still running. Suppresses the
      sign-in banner so signed-in users don't see a flash of "please sign in"
      before the resolver populates personaId. */
  personaResolving?: boolean;
  sourceExperienceId?: string | null;
  initialTitle?: string;
  initialPrompt?: string;
  onClose: () => void;
  onPublished?: (content: GeneratedContent) => void;
  /** Called when an unauthenticated user clicks the sign-in CTA. */
  onSignInRequest?: () => void;
  /**
   * 'modal' (default): renders as a fixed-position overlay dialog.
   * 'inline': renders just the body in-flow — host provides the surrounding
   *   container (e.g. RuntimeCapsuleRemixEditor banner). No close X; host
   *   controls open/close via its own toggle.
   */
  variant?: 'modal' | 'inline';
}

type GenerationStep = "idle" | "charging" | "writing" | "rendering" | "saving";

export function RemixDialog({
  open,
  personaId,
  personaResolving = false,
  sourceExperienceId,
  initialTitle,
  initialPrompt,
  onClose,
  onPublished,
  onSignInRequest,
  variant = 'modal',
}: Props) {
  const [skill, setSkill] = useState<Skill>("article");
  const [title, setTitle] = useState(initialTitle ?? "");
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  // Phase 1.4 spine consumer migration #2 — INFORMATIONAL ONLY for now.
  // Surfaces whether the active persona owns the source experience so the
  // operator can decide gating policy in Phase 2 (per the smarttriad
  // ownership unification backlog: 'remixing an owned source is free;
  // remixing a non-owned source either pays the source price first or is
  // denied'). For now we only display the state; we do not gate.
  const [sourceOwnership, setSourceOwnership] = useState<SpineDecision | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>("idle");
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<"discard" | "publish" | null>(null);
  const [discardCountdown, setDiscardCountdown] = useState<number | null>(null);

  // Hydrate state from props on open
  useEffect(() => {
    if (!open) return;
    setSkill("article");
    setTitle(initialTitle ?? "");
    setPrompt(initialPrompt ?? "");
    setGenerated(null);
    setError(null);
    setActionPending(null);
    setDiscardCountdown(null);
    setGenerationStep("idle");
    setQuotaError(null);
  }, [open, initialTitle, initialPrompt]);

  // Fetch source ownership state when dialog opens with a sourceExperienceId.
  // The spine call is fail-open (returns null on any error / unknown asset);
  // the dialog renders the ownership banner only when a decision was reached.
  useEffect(() => {
    if (!open || !personaId || !sourceExperienceId) {
      setSourceOwnership(null);
      return;
    }
    let cancelled = false;
    checkSpineDecision(sourceExperienceId, 'remix')
      .then((d) => { if (!cancelled) setSourceOwnership(d); })
      .catch(() => { if (!cancelled) setSourceOwnership(null); });
    return () => { cancelled = true; };
  }, [open, personaId, sourceExperienceId]);

  // Fetch quota when dialog opens
  useEffect(() => {
    if (!open || !personaId) {
      setQuota(null);
      return;
    }
    let cancelled = false;
    personaFetch(`/api/community-content/quota?personaId=${encodeURIComponent(personaId)}`, { personaIdHint: personaId })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.ok) {
          setQuota(j as QuotaState);
          setQuotaError(null);
        } else {
          setQuotaError(j.error || "Couldn't load quota");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setQuotaError(err instanceof Error ? err.message : "Couldn't load quota");
      });
    return () => { cancelled = true; };
  }, [open, personaId]);

  // Discard countdown
  useEffect(() => {
    if (!generated) { setDiscardCountdown(null); return; }
    const expiry = new Date(generated.refundableUntil).getTime();
    function tick() {
      const remaining = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      setDiscardCountdown(remaining);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [generated]);

  const submit = useCallback(async () => {
    if (SIGNIN_GATING_ENABLED && !personaId) { setError("Sign in to remix"); return; }
    if (!prompt.trim()) { setError("Prompt is required"); return; }
    setGenerating(true);
    setError(null);
    setGenerationStep("charging");

    // Optimistic step progression — server doesn't stream, so we cycle the
    // step labels on a timer so users can see what's happening.
    const stepTimer1 = setTimeout(() => setGenerationStep("writing"),  1500);
    const stepTimer2 = setTimeout(() => setGenerationStep("rendering"), 6000);
    const stepTimer3 = setTimeout(() => setGenerationStep("saving"),    18000);

    try {
      const res = await personaFetch("/api/community-content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId,
          skill,
          prompt: prompt.trim(),
          title: title.trim() || null,
          sourceExperienceId: sourceExperienceId || null,
        }),
        personaIdHint: personaId ?? undefined,
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setError(j.error || `Generation failed (${res.status})`);
        return;
      }
      setGenerated({
        id: j.id,
        title: j.title,
        articleBody: j.articleBody,
        imageUrl: j.imageUrl ?? null,
        qcCost: j.qcCost,
        refundableUntil: j.refundableUntil,
      });
      // Refresh quota so the next attempt's cost label is accurate. With
      // SIGNIN_GATING_ENABLED off, submit can run without a personaId; skip
      // the refresh in that case since the quota endpoint requires one.
      if (personaId) {
        void personaFetch(`/api/community-content/quota?personaId=${encodeURIComponent(personaId)}`, { personaIdHint: personaId })
          .then((r) => r.json())
          .then((q) => { if (q.ok) setQuota(q as QuotaState); })
          .catch(() => { /* ignore */ });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      setGenerating(false);
      setGenerationStep("idle");
    }
  }, [personaId, skill, prompt, title, sourceExperienceId]);

  const discard = useCallback(async () => {
    if (!generated || !personaId) return;
    setActionPending("discard");
    setError(null);
    try {
      const res = await personaFetch(`/api/community-content/${generated.id}/discard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId }),
        personaIdHint: personaId,
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setError(j.error || `Discard failed (${res.status})`);
        return;
      }
      setGenerated(null);
      setDiscardCountdown(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discard failed");
    } finally {
      setActionPending(null);
    }
  }, [generated, personaId]);

  const publish = useCallback(async () => {
    if (!generated || !personaId) return;
    setActionPending("publish");
    setError(null);
    try {
      const res = await personaFetch(`/api/community-content/${generated.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId }),
        personaIdHint: personaId,
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setError(j.error || `Publish failed (${res.status})`);
        return;
      }
      onPublished?.(generated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setActionPending(null);
    }
  }, [generated, personaId, onPublished, onClose]);

  if (!open) return null;

  const skillCost = quota?.costs[skill];
  const showCostBadge = quota && skillCost;
  const isFree = (quota?.freeRemaining ?? 0) > 0;

  if (variant === 'inline') {
    // Inline variant: skip the overlay + card chrome and the close X.
    // Host banner provides label+toggle. Body and footer use the same flow
    // as the modal variant — just no fixed positioning and no scroll cap.
    return (
      <div className="space-y-3 px-1 pb-1">
        {/* Sign-in banner — only once persona resolution is confirmed failed */}
        {SIGNIN_GATING_ENABLED && !personaId && !personaResolving && !generated && (
          <SignInBanner onSignIn={onSignInRequest} />
        )}

        {/* Source ownership banner — informational; gating policy is Phase 2 */}
        {personaId && !generated && sourceOwnership && (
          <SourceOwnershipBanner decision={sourceOwnership} />
        )}

        {/* Generation progress strip */}
        {generating && (
          <GenerationProgress step={generationStep} skill={skill} />
        )}

        {!generated ? (
          <ComposeView
            skill={skill} setSkill={setSkill}
            title={title} setTitle={setTitle}
            prompt={prompt} setPrompt={setPrompt}
            quota={quota} quotaError={quotaError} hasPersona={!!personaId || personaResolving}
            skillCost={skillCost ?? null} isFree={isFree} showCostBadge={!!showCostBadge}
            disabled={generating || (SIGNIN_GATING_ENABLED && !personaId && !personaResolving)}
          />
        ) : (
          <PreviewView generated={generated} />
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Footer — same buttons as modal variant. Discard/Redo/Publish in preview;
            quota line + Generate (or Sign in) in compose. */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {!generated ? (
            <>
              <div className="text-[10px] text-slate-400 min-w-0 truncate">
                {personaResolving && !personaId
                  ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Checking session…</span>
                  : SIGNIN_GATING_ENABLED && !personaId
                  ? <span className="text-amber-300/80">Sign in required</span>
                  : !quota && !quotaError
                  ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Loading quota…</span>
                  : quotaError
                  ? <span className="text-red-300/80">{quotaError}</span>
                  : quota
                  ? <>
                      <span className={quota.freeRemaining > 0 ? "text-emerald-300" : "text-slate-500"}>
                        {quota.freeRemaining}/{quota.limits.dailyFreeQuota} free
                      </span>
                      <span className="text-slate-600"> · resets daily</span>
                    </>
                  : "—"
                }
              </div>
              {personaResolving && !personaId ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 opacity-40"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading…
                </button>
              ) : SIGNIN_GATING_ENABLED && !personaId ? (
                <button
                  type="button"
                  onClick={() => onSignInRequest?.()}
                  disabled={!onSignInRequest}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-40"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign in to remix
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={generating || !prompt.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-40"
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {generating ? generationStepLabel(generationStep) : skillCost && skillCost.currentQc === 0 ? "Generate (free)" : skillCost ? `Generate · ${skillCost.currentQc} Q¢` : "Generate"}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={discard}
                disabled={
                  actionPending !== null ||
                  (discardCountdown !== null && discardCountdown <= 0) ||
                  (quota?.refundRemaining ?? 0) <= 0
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-30"
                title={
                  discardCountdown === 0
                    ? "Discard window expired"
                    : (quota?.refundRemaining ?? 0) <= 0
                    ? "Daily discard refund used"
                    : `Refund within ${discardCountdown}s`
                }
              >
                {actionPending === "discard" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Discard{discardCountdown !== null && discardCountdown > 0 ? ` (${discardCountdown}s)` : ""}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setGenerated(null); setError(null); }}
                  disabled={actionPending !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-30"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Redo
                </button>
                <button
                  type="button"
                  onClick={publish}
                  disabled={actionPending !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-40"
                >
                  {actionPending === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                  Publish
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !generating && !actionPending) onClose(); }}
    >
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-100 truncate">
              {generated ? "Preview your remix" : "Remix this experience"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={generating || actionPending !== null}
            className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Sign-in banner — only once persona resolution is confirmed failed */}
          {SIGNIN_GATING_ENABLED && !personaId && !personaResolving && !generated && (
            <SignInBanner onSignIn={onSignInRequest} />
          )}

          {/* Source ownership banner — informational; gating policy is Phase 2 */}
          {personaId && !generated && sourceOwnership && (
            <SourceOwnershipBanner decision={sourceOwnership} />
          )}

          {/* Generation progress strip — shows above the form while charging/generating */}
          {generating && (
            <GenerationProgress step={generationStep} skill={skill} />
          )}

          {!generated ? (
            <ComposeView
              skill={skill}
              setSkill={setSkill}
              title={title}
              setTitle={setTitle}
              prompt={prompt}
              setPrompt={setPrompt}
              quota={quota}
              quotaError={quotaError}
              hasPersona={!!personaId}
              skillCost={skillCost ?? null}
              isFree={isFree}
              showCostBadge={!!showCostBadge}
              disabled={generating || (SIGNIN_GATING_ENABLED && !personaId && !personaResolving)}
            />
          ) : (
            <PreviewView generated={generated} />
          )}

          {error && (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.08] px-4 py-3 flex items-center justify-between gap-2">
          {!generated ? (
            <>
              <div className="text-[10px] text-slate-400 min-w-0 truncate">
                {personaResolving && !personaId
                  ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Checking session…</span>
                  : SIGNIN_GATING_ENABLED && !personaId
                  ? <span className="text-amber-300/80">Sign in required</span>
                  : !quota && !quotaError
                  ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Loading quota…</span>
                  : quotaError
                  ? <span className="text-red-300/80">{quotaError}</span>
                  : quota
                  ? <>
                      <span className={quota.freeRemaining > 0 ? "text-emerald-300" : "text-slate-500"}>
                        {quota.freeRemaining}/{quota.limits.dailyFreeQuota} free
                      </span>
                      <span className="text-slate-600"> · resets daily</span>
                    </>
                  : "—"
                }
              </div>
              {personaResolving && !personaId ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 opacity-40"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading…
                </button>
              ) : SIGNIN_GATING_ENABLED && !personaId ? (
                <button
                  type="button"
                  onClick={() => onSignInRequest?.()}
                  disabled={!onSignInRequest}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-40"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign in to remix
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={generating || !prompt.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-40"
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {generating ? generationStepLabel(generationStep) : skillCost && skillCost.currentQc === 0 ? "Generate (free)" : skillCost ? `Generate · ${skillCost.currentQc} Q¢` : "Generate"}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={discard}
                disabled={
                  actionPending !== null ||
                  (discardCountdown !== null && discardCountdown <= 0) ||
                  (quota?.refundRemaining ?? 0) <= 0
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-30"
                title={
                  discardCountdown === 0
                    ? "Discard window expired"
                    : (quota?.refundRemaining ?? 0) <= 0
                    ? "Daily discard refund used"
                    : `Refund within ${discardCountdown}s`
                }
              >
                {actionPending === "discard" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Discard{discardCountdown !== null && discardCountdown > 0 ? ` (${discardCountdown}s)` : ""}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setGenerated(null);
                    setError(null);
                  }}
                  disabled={actionPending !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-30"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Redo
                </button>
                <button
                  type="button"
                  onClick={publish}
                  disabled={actionPending !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-40"
                >
                  {actionPending === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                  Publish
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Compose view ────────────────────────────────────────────────────────────

function ComposeView({
  skill, setSkill,
  title, setTitle,
  prompt, setPrompt,
  quota, quotaError, hasPersona,
  skillCost, isFree, showCostBadge,
  disabled,
}: {
  skill: Skill;
  setSkill: (s: Skill) => void;
  title: string;
  setTitle: (s: string) => void;
  prompt: string;
  setPrompt: (s: string) => void;
  quota: QuotaState | null;
  quotaError: string | null;
  hasPersona: boolean;
  skillCost: QuotaCosts["article"] | null;
  isFree: boolean;
  showCostBadge: boolean;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      {/* Skill toggle */}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setSkill("article")}
          disabled={disabled}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
            skill === "article"
              ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
              : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          Article
        </button>
        <button
          type="button"
          onClick={() => setSkill("story")}
          disabled={disabled}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
            skill === "story"
              ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
              : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Story
        </button>
      </div>

      <div className="text-[10px] text-slate-500 leading-relaxed">
        {skill === "story"
          ? "Short KNYT-canon fiction (~250–500 words) plus a generated image. Your @knyt persona context is woven into the narrative."
          : "Editorial article (~600–900 words) plus a generated image. Connect to your KNYT context where it fits."}
      </div>

      {/* Title (optional) */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
          Title <span className="text-slate-600">(optional)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          disabled={disabled}
          placeholder="Auto-generated if blank"
          className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-amber-400/40 focus:outline-none disabled:opacity-60"
        />
      </div>

      {/* Prompt */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
          Prompt
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={2000}
          rows={5}
          disabled={disabled}
          placeholder={
            skill === "story"
              ? 'e.g. "Kn0w1 confronts a rogue protocol guardian on the chrome plains."'
              : 'e.g. "Why the 21 Sats Stewards matter for the protocol\'s future."'
          }
          className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-amber-400/40 focus:outline-none resize-none disabled:opacity-60"
        />
        <div className="text-right text-[10px] text-slate-600 mt-0.5">{prompt.length}/2000</div>
      </div>

      {/* Cost summary — three states: signed-out (hidden during interim
          gating-disabled window), loading, loaded. When SIGNIN_GATING_ENABLED
          is flipped back on this branch will surface the sign-in prompt
          again. */}
      {!hasPersona ? null : showCostBadge && skillCost ? (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Coins className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-slate-200">
                {isFree
                  ? <>Free this generation <span className="text-slate-500">· next is {skillCost.surchargedQc} Q¢</span></>
                  : <>{skillCost.currentQc} Q¢ <span className="text-slate-500">(base {skillCost.baseQc} + {quota?.limits.surchargePct}% after free quota)</span></>
                }
              </div>
              <div className="text-[10px] text-slate-500">
                Includes {skill === "story" ? "story" : "article"} text + 1 generated image
              </div>
            </div>
          </div>
          <ImageIcon className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden />
        </div>
      ) : quotaError ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-300">
          Couldn't load pricing: {quotaError}
        </div>
      ) : (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-slate-500 inline-flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading pricing…
        </div>
      )}
    </div>
  );
}

// ─── Sign-in banner ──────────────────────────────────────────────────────────

// ─── Source ownership banner ─────────────────────────────────────────────────
// Phase 1.4 spine consumer migration #2 — INFORMATIONAL ONLY.
// Surfaces the spine's decision on whether the active persona owns the source
// experience this remix is derived from. The gating policy (charge / deny /
// allow) is a Phase 2 decision per the smarttriad ownership unification
// backlog; this banner just makes the state visible to the user and operator.
function SourceOwnershipBanner({ decision }: { decision: SpineDecision }) {
  const owned = decision.allow && decision.reason === 'owned';
  const free  = decision.allow && decision.reason === 'free';
  if (free) {
    return (
      <div className="mb-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[11px] text-emerald-300/80">
        Source: free preview — remixable.
      </div>
    );
  }
  if (owned) {
    return (
      <div className="mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-200">
        Source: owned by your persona — remixable.
      </div>
    );
  }
  // Not owned — surface the gate reason without blocking generation today.
  return (
    <div className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200">
      Source: not owned by your persona ({decision.reason}). Generation continues for now;
      Phase 2 will enforce the source-ownership policy.
    </div>
  );
}

function SignInBanner({ onSignIn }: { onSignIn?: () => void }) {
  return (
    <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-3 flex items-start gap-2.5">
      <LogIn className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-200 leading-snug">Sign in to remix</p>
        <p className="text-[11px] text-amber-200/70 leading-snug mt-0.5">
          Each KNYT persona gets <span className="font-semibold text-amber-200">3 free generations per day</span> plus a daily discard refund. Sign in to start remixing.
        </p>
        {onSignIn && (
          <button
            type="button"
            onClick={onSignIn}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/30"
          >
            <LogIn className="h-3 w-3" />
            Sign in
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Generation progress strip ───────────────────────────────────────────────

const STEP_LABELS: Record<GenerationStep, string> = {
  idle:      "",
  charging:  "Reserving Q¢…",
  writing:   "Writing the piece…",
  rendering: "Rendering image…",
  saving:    "Saving your remix…",
};

function generationStepLabel(step: GenerationStep): string {
  return STEP_LABELS[step] || "Generating…";
}

function GenerationProgress({ step, skill }: { step: GenerationStep; skill: Skill }) {
  const order: GenerationStep[] = ["charging", "writing", "rendering", "saving"];
  const currentIdx = order.indexOf(step);
  return (
    <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-950/20 px-3 py-2.5">
      <div className="flex items-center gap-2 mb-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
        <p className="text-[11px] font-semibold text-amber-200">
          {generationStepLabel(step)}
        </p>
      </div>
      <div className="flex gap-1">
        {order.map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition ${
              i < currentIdx
                ? "bg-amber-400"
                : i === currentIdx
                ? "bg-amber-400/60 animate-pulse"
                : "bg-white/[0.06]"
            }`}
          />
        ))}
      </div>
      <p className="text-[10px] text-amber-200/60 mt-2 leading-snug">
        {skill === "story" ? "Stories" : "Articles"} typically take 15–30 seconds.
        Keep this dialog open until generation completes.
      </p>
    </div>
  );
}

// ─── Preview view ────────────────────────────────────────────────────────────

function PreviewView({ generated }: { generated: GeneratedContent }) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-slate-100 leading-tight">{generated.title}</h2>
      {generated.imageUrl ? (
        <img
          src={generated.imageUrl}
          alt={generated.title}
          className="w-full rounded-xl border border-white/10 object-cover max-h-64"
          loading="lazy"
        />
      ) : (
        <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
          Image generation unavailable — text-only preview.
        </div>
      )}
      <article className="prose prose-invert prose-sm max-w-none text-slate-200 whitespace-pre-wrap">
        {generated.articleBody}
      </article>
      <div className="text-[10px] text-slate-500">
        Charged: {generated.qcCost} Q¢
      </div>
    </div>
  );
}

export default RemixDialog;
