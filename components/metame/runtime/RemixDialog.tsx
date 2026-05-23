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
import { BookMarked, Check, Coins, FileText, Image as ImageIcon, Loader2, LogIn, RotateCw, Send, Share2, Sparkles, Trash2, X } from "lucide-react";
import { checkSpineDecision, type SpineDecision } from "@/services/access/spineGateClient";
import { personaFetch } from "@/utils/personaSpine";
import { useExternalWallet } from "@/app/components/wallet/useExternalWallet";
import { useActivePersona } from "@/app/hooks/useActivePersona";
import { MicButton } from "@/components/ui/MicButton";
import { ListenButton } from "@/components/shared/ListenButton";

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

/** x402-style payment envelope returned by /generate on insufficient DVN. */
interface QcPaymentIntent {
  intentId: string;
  asset: 'QCT';
  chainId: number;
  tokenAddress: string;
  payTo: string;
  amount: string;       // ERC20 base units (18 decimals)
  amountQc: number;     // user-facing Q¢ cents
  currency: 'QCT';
  deadline: number;
  /** Current DVN balance — when this is >= amountQc the client offers a
      "Pay from DVN balance" alternative to the external-wallet flow. */
  dvnAvailable: number;
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
  /** Full source-experience cover image — saved alongside the origin entry
      when the user saves the remix to myCanvas so the canvas can render
      the original capsule, not just an ID reference. */
  sourceImageUrl?: string | null;
  /** Description / synopsis of the source experience — saved into the
      origin entry's bodyMd so the canvas reader sees the source's content,
      not an empty card. */
  sourceDescription?: string | null;
  onClose: () => void;
  onPublished?: (content: GeneratedContent) => void;
  /** Called when an unauthenticated user clicks the sign-in CTA. */
  onSignInRequest?: () => void;
  /** Called when the user clicks "Connect wallet" or "Buy Q¢" in the
      payment-intent panel. Host should open the wallet drawer to the
      Connections tab (where the user can connect or top up). */
  onConnectWallet?: () => void;
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
  sourceImageUrl,
  sourceDescription,
  onClose,
  onPublished,
  onSignInRequest,
  onConnectWallet,
  variant = 'modal',
}: Props) {
  const [skill, setSkill] = useState<Skill>("article");
  const [title, setTitle] = useState(initialTitle ?? "");
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  // Drafter strip — one-liner idea → LLM-drafted title/article/image prompts.
  const [idea, setIdea] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftRationale, setDraftRationale] = useState<string | null>(null);
  const [draftSource, setDraftSource] = useState<"llm" | "template" | null>(null);
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
  const [savingToCanvas, setSavingToCanvas] = useState(false);
  const [savedToCanvas, setSavedToCanvas] = useState(false);
  // x402 payment-intent state — populated when /generate returns 402
  // with a `payment` envelope. The PaymentIntentPanel surfaces a
  // "Pay via Base" CTA that prompts the user's external wallet to
  // sign the QCT transfer, then settles via /api/community-content/settle
  // and re-runs submit() on success.
  const [paymentIntent, setPaymentIntent] = useState<QcPaymentIntent | null>(null);
  const [paymentPending, setPaymentPending] = useState<null | "sending" | "verifying">(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  /** Set when /generate returned needsBuyQc — user explicitly chose DVN
      payment but their DVN balance also can't cover. Drives the
      "Buy more Q¢" CTA in the panel. */
  const [needsBuyQc, setNeedsBuyQc] = useState(false);
  const wallet = useExternalWallet();
  // Surface the active persona alongside the dialog's prop-passed
  // personaId so we can spot mismatches — a stale prop will debit a
  // different ledger row than the wallet UI is displaying.
  const { surface: activePersonaSurface } = useActivePersona();
  type SurfaceWithFio = typeof activePersonaSurface & { ownFioHandle?: string };
  const dialogPersonaLabel =
    activePersonaSurface?.displayLabel ??
    (activePersonaSurface as SurfaceWithFio | null)?.ownFioHandle ??
    null;
  // After the user connects a wallet from the drawer, the dialog's
  // own useExternalWallet instance doesn't auto-pick up the session
  // until it polls. When the payment panel is showing AND no wallet
  // is connected yet, refresh on a short interval so we adopt the
  // session within ~1s of the user returning to the dialog.
  useEffect(() => {
    if (!paymentIntent || wallet.address) return;
    const id = setInterval(() => { wallet.refresh(); }, 1000);
    return () => clearInterval(id);
  }, [paymentIntent, wallet]);

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
    setSavedToCanvas(false);
    setSavingToCanvas(false);
    setPaymentIntent(null);
    setPaymentPending(null);
    setPaymentError(null);
    setNeedsBuyQc(false);
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

  const draft = useCallback(async () => {
    setError(null);
    if (!idea.trim()) {
      setError("Tell aigentMe what the remix is about (one sentence).");
      return;
    }
    setDrafting(true);
    try {
      const res = await personaFetch("/api/composer/remix-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: idea.trim(),
          skill,
          sourceExperienceId: sourceExperienceId || null,
        }),
        personaIdHint: personaId ?? undefined,
      });
      const j = (await res.json()) as {
        ok?: boolean;
        title?: string;
        articlePrompt?: string;
        imagePrompt?: string;
        rationale?: string;
        source?: "llm" | "template";
        error?: string;
      };
      if (!res.ok || !j.ok) {
        setError(j.error || `Draft failed (${res.status})`);
        return;
      }
      setTitle(j.title ?? "");
      setPrompt(j.articlePrompt ?? "");
      setImagePrompt(j.imagePrompt ?? "");
      setDraftRationale(j.rationale ?? null);
      setDraftSource(j.source ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDrafting(false);
    }
  }, [idea, skill, sourceExperienceId, personaId]);

  const submit = useCallback(async (paymentMode: 'auto' | 'dvn' = 'auto') => {
    if (SIGNIN_GATING_ENABLED && !personaId) { setError("Sign in to remix"); return; }
    if (!prompt.trim()) { setError("Prompt is required"); return; }
    // PATH A persona-resolution defense — refuse to submit when we have
    // no explicit persona signal. Without this guard the server's
    // getActivePersona() falls back to "first owned by created_at ASC",
    // which for dele@metame.com resolves to devagent and debits the
    // wrong DVN ledger row. The user must explicitly pick a persona in
    // the wallet drawer before remixing.
    const hasPst = !!activePersonaSurface?.personaSessionToken;
    if (!personaId && !hasPst) {
      setError(
        'No active persona resolved — please pick a persona in the wallet drawer and retry.',
      );
      return;
    }
    console.info('[RemixDialog] submit', {
      personaId,
      paymentMode,
      activePersonaLabel: dialogPersonaLabel,
      surfacePersonaIdToken: activePersonaSurface?.personaSessionToken
        ? activePersonaSurface.personaSessionToken.slice(0, 12) + '…'
        : null,
    });
    setGenerating(true);
    setError(null);
    setGenerationStep("charging");

    // Optimistic step progression — server doesn't stream, so we cycle the
    // step labels on a timer so users can see what's happening.
    const stepTimer1 = setTimeout(() => setGenerationStep("writing"),  1500);
    const stepTimer2 = setTimeout(() => setGenerationStep("rendering"), 6000);
    const stepTimer3 = setTimeout(() => setGenerationStep("saving"),    18000);

    try {
      // Attach the persona-session-token (PST) so the server's
      // getActivePersona() resolves via priority 1 (PST bound to the
      // exact persona the user picked) instead of priority 4 (silent
      // "first owned" fallback). This is Path A of the persona-override
      // fix — Path B (server-side default_persona_id schema) is in the
      // 2026-05-22 backlog brief.
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (activePersonaSurface?.personaSessionToken) {
        headers['x-persona-session-token'] = activePersonaSurface.personaSessionToken;
      }
      const res = await personaFetch("/api/community-content/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          personaId,
          skill,
          prompt: prompt.trim(),
          title: title.trim() || null,
          imagePrompt: imagePrompt.trim() || null,
          sourceExperienceId: sourceExperienceId || null,
          paymentMode,
        }),
        personaIdHint: personaId ?? undefined,
      });
      let j: Record<string, unknown>;
      try {
        j = (await res.json()) as Record<string, unknown>;
      } catch {
        setError(`Generation failed (${res.status || "server error"}) — please try again`);
        return;
      }
      if (!res.ok || !j.ok) {
        // 402 with `needsBuyQc` → user picked "Pay from DVN" but DVN
        // can't cover. Flip the panel into buy-Q¢ mode by clearing the
        // intent payment object and setting a top-up signal.
        if (res.status === 402 && j.needsBuyQc) {
          setPaymentIntent(null);
          setNeedsBuyQc(true);
          setPaymentError(typeof j.error === "string" ? j.error : "Top up Q¢ to continue.");
          return;
        }
        // 402 with a payment envelope → DVN was insufficient AND custodial
        // settlement wasn't available. Stash the intent so the panel can
        // drive the user-facing fallback chain (external wallet → DVN → buy Q¢).
        if (res.status === 402 && j.payment && typeof j.payment === "object") {
          setPaymentIntent(j.payment as unknown as QcPaymentIntent);
          setPaymentError(null);
          setNeedsBuyQc(false);
          return;
        }
        setError(typeof j.error === "string" ? j.error : `Generation failed (${res.status})`);
        return;
      }
      setGenerated({
        id: String(j.id ?? ""),
        title: String(j.title ?? ""),
        articleBody: String(j.articleBody ?? ""),
        imageUrl: typeof j.imageUrl === "string" ? j.imageUrl : null,
        qcCost: typeof j.qcCost === "number" ? j.qcCost : 0,
        refundableUntil: String(j.refundableUntil ?? ""),
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
  }, [personaId, skill, prompt, title, imagePrompt, sourceExperienceId, dialogPersonaLabel, activePersonaSurface]);

  // ── x402 on-chain payment execution ────────────────────────────────────
  // Prompts the user's already-connected EVM wallet to sign a QCT
  // transfer for the intent.amount to intent.payTo on intent.chainId,
  // then POSTs the txHash to /api/community-content/settle which credits
  // DVN with the verified amount. On success we re-run submit() so the
  // remix can debit DVN normally.
  const payWithWallet = useCallback(async () => {
    if (!paymentIntent) return;
    setPaymentError(null);

    if (!wallet.provider || !wallet.address) {
      setPaymentError("Connect an EVM wallet (Wallet drawer → Connect) and try again.");
      return;
    }

    // Switch to the intent's chain if the wallet isn't already there.
    const wantChainHex = `0x${paymentIntent.chainId.toString(16)}`;
    if (wallet.chainId !== paymentIntent.chainId) {
      try {
        await wallet.switchToChain(wantChainHex);
      } catch (err) {
        setPaymentError(err instanceof Error ? err.message : "Couldn't switch chain");
        return;
      }
    }

    // Encode ERC20 transfer(address,uint256) call data without pulling
    // an ABI lib — selector + 32-byte padded args is tiny and stable.
    const TRANSFER_SELECTOR = "0xa9059cbb";
    const padHexAddress = (addr: string) =>
      addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
    const padHexUint = (decimal: string) => {
      const hex = BigInt(decimal).toString(16);
      return hex.padStart(64, "0");
    };
    const data = `${TRANSFER_SELECTOR}${padHexAddress(paymentIntent.payTo)}${padHexUint(paymentIntent.amount)}`;

    setPaymentPending("sending");
    let txHash: string;
    try {
      txHash = (await wallet.provider.request({
        method: "eth_sendTransaction",
        params: [{
          from: wallet.address,
          to: paymentIntent.tokenAddress,
          data,
          value: "0x0",
        }],
      })) as string;
    } catch (err) {
      setPaymentPending(null);
      const msg = err instanceof Error ? err.message : "Wallet transaction rejected";
      // Don't surface "user rejected" as an error — it's expected when
      // the user dismisses the wallet prompt.
      if (msg.toLowerCase().includes("rejected") || msg.toLowerCase().includes("denied")) {
        return;
      }
      setPaymentError(msg);
      return;
    }

    setPaymentPending("verifying");
    try {
      const settleRes = await personaFetch("/api/community-content/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId: paymentIntent.intentId, txHash }),
        personaIdHint: personaId ?? undefined,
      });
      const settleJson = (await settleRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!settleRes.ok || !settleJson.ok) {
        setPaymentPending(null);
        setPaymentError(settleJson.error ?? `Settlement failed (${settleRes.status})`);
        return;
      }
      // Settlement complete — DVN credited. Clear the intent and retry
      // the original generation. submit() will hit /generate again and
      // debitQc will now find sufficient DVN.
      setPaymentIntent(null);
      setPaymentPending(null);
      void submit();
    } catch (err) {
      setPaymentPending(null);
      setPaymentError(err instanceof Error ? err.message : "Settlement failed");
    }
  }, [paymentIntent, personaId, wallet, submit]);

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

  const saveToCanvas = useCallback(async () => {
    if (!generated) return;
    setSavingToCanvas(true);
    setError(null);
    try {
      const saves: Promise<Response>[] = [
        personaFetch("/api/mycanvas/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: generated.title,
            bodyMd: generated.articleBody,
            entryType: "experience_derived",
            metaJson: {
              contentId: generated.id,
              sourceExperienceId: sourceExperienceId ?? null,
              imageUrl: generated.imageUrl,
              skill,
            },
          }),
          personaIdHint: personaId ?? undefined,
        }),
      ];
      if (sourceExperienceId) {
        saves.push(
          personaFetch("/api/mycanvas/entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: initialTitle ?? "Origin Experience",
              bodyMd: sourceDescription ?? "",
              entryType: "experience_origin",
              metaJson: {
                experienceId: sourceExperienceId,
                imageUrl: sourceImageUrl ?? null,
                description: sourceDescription ?? null,
              },
            }),
            personaIdHint: personaId ?? undefined,
          }),
        );
      }
      const results = await Promise.all(saves);
      if (!results.every((r) => r.ok)) {
        setError("Couldn't save to myCanvas");
        return;
      }
      setSavedToCanvas(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save to myCanvas");
    } finally {
      setSavingToCanvas(false);
    }
  }, [generated, personaId, skill, sourceExperienceId, initialTitle, sourceImageUrl, sourceDescription]);

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

        {/* x402 on-chain payment intent — surfaces when /generate returns
            402 because DVN was insufficient. User signs a QCT transfer
            with their EVM wallet; we settle via /settle which credits
            DVN; then submit() re-runs and debits DVN normally. */}
        {paymentIntent && !generated && (
          <PaymentIntentPanel
            intent={paymentIntent}
            wallet={wallet}
            pending={paymentPending}
            error={paymentError}
            onPay={payWithWallet}
            onPayFromDvn={() => { setPaymentIntent(null); setPaymentError(null); void submit('dvn'); }}
            onConnectWallet={onConnectWallet}
            personaLabel={dialogPersonaLabel}
            onRetry={() => { setPaymentIntent(null); setPaymentError(null); void submit(); }}
            onCancel={() => { setPaymentIntent(null); setPaymentError(null); setPaymentPending(null); setNeedsBuyQc(false); }}
          />
        )}

        {/* DVN can't cover either — surface a Buy Q¢ CTA */}
        {needsBuyQc && !paymentIntent && !generated && (
          <BuyQcPanel
            error={paymentError}
            onBuyQc={onConnectWallet}
            onCancel={() => { setNeedsBuyQc(false); setPaymentError(null); }}
          />
        )}

        {!generated ? (
          <ComposeView
            skill={skill} setSkill={setSkill}
            title={title} setTitle={setTitle}
            prompt={prompt} setPrompt={setPrompt}
            imagePrompt={imagePrompt} setImagePrompt={setImagePrompt}
            idea={idea} setIdea={setIdea}
            onDraft={draft} drafting={drafting}
            draftRationale={draftRationale} draftSource={draftSource}
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
                  onClick={() => void submit()}
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
                  onClick={() => { setGenerated(null); setError(null); setSavedToCanvas(false); }}
                  disabled={actionPending !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-30"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Redo
                </button>
                <button
                  type="button"
                  onClick={saveToCanvas}
                  disabled={actionPending !== null || savingToCanvas || savedToCanvas}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 transition ${
                    savedToCanvas
                      ? "border-violet-500/40 bg-violet-500/15 text-violet-200"
                      : "border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-100"
                  }`}
                >
                  {savingToCanvas ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedToCanvas ? <Check className="h-3.5 w-3.5" /> : <BookMarked className="h-3.5 w-3.5" />}
                  {savedToCanvas ? "Saved" : "Save"}
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

          {/* x402 on-chain payment intent (see inline-variant comment) */}
          {paymentIntent && !generated && (
            <PaymentIntentPanel
              intent={paymentIntent}
              wallet={wallet}
              pending={paymentPending}
              error={paymentError}
              onPay={payWithWallet}
              onPayFromDvn={() => { setPaymentIntent(null); setPaymentError(null); void submit('dvn'); }}
              onConnectWallet={onConnectWallet}
              personaLabel={dialogPersonaLabel}
              onRetry={() => { setPaymentIntent(null); setPaymentError(null); void submit(); }}
              onCancel={() => { setPaymentIntent(null); setPaymentError(null); setPaymentPending(null); setNeedsBuyQc(false); }}
            />
          )}

          {needsBuyQc && !paymentIntent && !generated && (
            <BuyQcPanel
              error={paymentError}
              onBuyQc={onConnectWallet}
              onCancel={() => { setNeedsBuyQc(false); setPaymentError(null); }}
            />
          )}

          {!generated ? (
            <ComposeView
              skill={skill}
              setSkill={setSkill}
              title={title}
              setTitle={setTitle}
              prompt={prompt}
              setPrompt={setPrompt}
              imagePrompt={imagePrompt}
              setImagePrompt={setImagePrompt}
              idea={idea}
              setIdea={setIdea}
              onDraft={draft}
              drafting={drafting}
              draftRationale={draftRationale}
              draftSource={draftSource}
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
                  onClick={() => void submit()}
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
                    setSavedToCanvas(false);
                  }}
                  disabled={actionPending !== null}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-30"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Redo
                </button>
                <button
                  type="button"
                  onClick={saveToCanvas}
                  disabled={actionPending !== null || savingToCanvas || savedToCanvas}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 transition ${
                    savedToCanvas
                      ? "border-violet-500/40 bg-violet-500/15 text-violet-200"
                      : "border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-violet-100"
                  }`}
                >
                  {savingToCanvas ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedToCanvas ? <Check className="h-3.5 w-3.5" /> : <BookMarked className="h-3.5 w-3.5" />}
                  {savedToCanvas ? "Saved" : "Save to myCanvas"}
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
  imagePrompt, setImagePrompt,
  idea, setIdea,
  onDraft, drafting,
  draftRationale, draftSource,
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
  imagePrompt: string;
  setImagePrompt: (s: string) => void;
  idea: string;
  setIdea: (s: string) => void;
  onDraft: () => void;
  drafting: boolean;
  draftRationale: string | null;
  draftSource: "llm" | "template" | null;
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

      {/* Drafter strip — one-liner idea → LLM drafts title + article + image */}
      <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
        <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
          What's this remix about? <span className="text-slate-600">(aigentMe will draft it)</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            name="aigentme-remix-idea"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={skill === "story"
              ? 'e.g. "Kn0w1 hunting a rogue guardian on the chrome plains, cinematic"'
              : 'e.g. "Why the 21 Sats Stewards matter — three concrete takeaways"'}
            disabled={drafting || disabled}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onDraft(); }
            }}
            className="flex-1 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-violet-400/40 focus:outline-none disabled:opacity-60"
          />
          <MicButton
            onTranscript={(text) => setIdea((idea ? `${idea.trimEnd()} ${text}` : text))}
            disabled={drafting || disabled}
            theme="dark"
          />
          <button
            type="button"
            onClick={onDraft}
            disabled={drafting || disabled || !idea.trim()}
            className="flex items-center gap-1.5 rounded-md bg-violet-500 hover:bg-violet-400 px-3 py-2 text-xs font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {drafting ? 'Drafting…' : 'Draft for me'}
          </button>
        </div>
        {draftRationale && (
          <p className="text-[10px] text-slate-400 mt-2">
            <span className="font-medium">aigentMe:</span> {draftRationale}
            {draftSource === 'template' && <span className="opacity-60"> (template fallback)</span>}
          </p>
        )}
      </div>

      {/* Title (optional) */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
          Title <span className="text-slate-600">(optional)</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            name="aigentme-remix-title"
            autoComplete="off"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            disabled={disabled}
            placeholder="Auto-generated if blank"
            className="flex-1 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:border-amber-400/40 focus:outline-none disabled:opacity-60"
          />
          <MicButton
            onTranscript={(text) => setTitle((title ? `${title.trimEnd()} ${text}` : text))}
            disabled={disabled}
            theme="dark"
          />
        </div>
      </div>

      {/* Prompt */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
          Article prompt
        </label>
        <div className="relative">
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
            className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 pr-12 text-sm text-slate-100 placeholder-slate-600 focus:border-amber-400/40 focus:outline-none resize-none disabled:opacity-60"
          />
          <div className="absolute top-2 right-2">
            <MicButton
              onTranscript={(text) => setPrompt((prompt ? `${prompt.trimEnd()} ${text}` : text))}
              size="sm"
              disabled={disabled}
              theme="dark"
            />
          </div>
        </div>
        <div className="text-right text-[10px] text-slate-600 mt-0.5">{prompt.length}/2000</div>
      </div>

      {/* Image prompt */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
          Image prompt <span className="text-slate-600">(optional — inferred from article if blank)</span>
        </label>
        <div className="relative">
          <textarea
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            maxLength={1000}
            rows={3}
            disabled={disabled}
            placeholder='e.g. "Editorial illustration of the 21 Sats Stewards, soft chiaroscuro."'
            className="w-full rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 pr-12 text-sm text-slate-100 placeholder-slate-600 focus:border-amber-400/40 focus:outline-none resize-none disabled:opacity-60"
          />
          <div className="absolute top-2 right-2">
            <MicButton
              onTranscript={(text) => setImagePrompt((imagePrompt ? `${imagePrompt.trimEnd()} ${text}` : text))}
              size="sm"
              disabled={disabled}
              theme="dark"
            />
          </div>
        </div>
        <div className="text-right text-[10px] text-slate-600 mt-0.5">{imagePrompt.length}/1000</div>
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
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-100 leading-tight">{generated.title}</h2>
        <ListenButton
          getText={() => `${generated.title}. ${generated.articleBody}`}
        />
      </div>
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

// ─── Payment intent panel (x402 on-chain Q¢ settlement) ─────────────────────

function PaymentIntentPanel({
  intent,
  wallet,
  pending,
  error,
  personaLabel,
  onPay,
  onPayFromDvn,
  onConnectWallet,
  onRetry,
  onCancel,
}: {
  intent: QcPaymentIntent;
  wallet: ReturnType<typeof useExternalWallet>;
  pending: null | "sending" | "verifying";
  error: string | null;
  /** Active persona display label — surfaced so the user can spot a
      persona mismatch (e.g. dialog debiting persona A while the wallet
      drawer is displaying persona B's balance). */
  personaLabel: string | null;
  onPay: () => void;
  onPayFromDvn: () => void;
  onConnectWallet?: () => void;
  /** Re-runs submit() — useful if the user switched persona in the
      drawer and wants to recompute the DVN balance check. */
  onRetry: () => void;
  onCancel: () => void;
}) {
  const chainName =
    intent.chainId === 84532  ? "Base Sepolia" :
    intent.chainId === 421614 ? "Arbitrum Sepolia" :
    intent.chainId === 11155111 ? "Ethereum Sepolia" :
    intent.chainId === 11155420 ? "Optimism Sepolia" :
    intent.chainId === 80002 ? "Polygon Amoy" :
    `Chain ${intent.chainId}`;
  const connected = !!wallet.address;
  const wrongChain = connected && wallet.chainId !== intent.chainId;
  const dvnCanCover = intent.dvnAvailable >= intent.amountQc;

  return (
    <div className="mb-3 rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-3 space-y-2.5">
      <div className="flex items-start gap-2.5">
        <Coins className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-indigo-200">
            Payment required — {intent.amountQc} Q¢
          </p>
          <p className="text-[11px] text-indigo-200/70 leading-snug mt-0.5">
            Choose how to pay: sign a {intent.amountQc} QCT transfer on
            {' '}{chainName} from your connected wallet, or pay from your
            DVN Q¢ balance ({intent.dvnAvailable.toLocaleString()} Q¢
            {dvnCanCover ? ' — sufficient' : ' — insufficient'}).
          </p>
        </div>
      </div>

      {/* Persona + balance diagnostic strip — when the server thinks DVN
          is insufficient but the user expects it to be, the most likely
          cause is a persona mismatch (dialog debiting a different
          persona than the wallet UI is displaying). Surface the label
          + a Retry so the user can switch persona and re-check. */}
      <div className="rounded border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[10px] text-slate-400 min-w-0 truncate">
          Charging persona: <span className="text-slate-200 font-medium">{personaLabel ?? '(no active persona)'}</span>
          {' · '}
          DVN: <span className={dvnCanCover ? 'text-emerald-300 font-medium' : 'text-amber-300 font-medium'}>
            {intent.dvnAvailable.toLocaleString()} Q¢
          </span>
        </div>
        <button
          type="button"
          onClick={onRetry}
          disabled={pending !== null}
          className="text-[10px] font-medium text-slate-300 hover:text-white underline underline-offset-2 disabled:opacity-40"
          title="Re-run the check — useful after switching persona"
        >
          Re-check
        </button>
      </div>

      {!connected ? (
        <div className="rounded border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] text-amber-200">No EVM wallet connected.</span>
          {onConnectWallet && (
            <button
              type="button"
              onClick={onConnectWallet}
              className="text-[11px] font-semibold text-amber-100 hover:text-white underline underline-offset-2"
            >
              Open wallet drawer →
            </button>
          )}
        </div>
      ) : wrongChain ? (
        <div className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded px-2.5 py-1.5">
          Wallet is on chain {wallet.chainId}. We'll prompt you to switch to {chainName} when you pay.
        </div>
      ) : null}

      {error && (
        <div className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/25 rounded px-2.5 py-1.5">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending !== null}
          className="text-[11px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
        >
          Cancel
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {/* DVN fallback — primary CTA when no wallet OR when DVN can
              cover the full cost. Always offered as an alternative even
              if wallet is connected. */}
          {dvnCanCover && (
            <button
              type="button"
              onClick={onPayFromDvn}
              disabled={pending !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-40"
              title={`Use ${intent.amountQc} Q¢ from your DVN balance`}
            >
              <Coins className="h-3.5 w-3.5" />
              Pay {intent.amountQc} Q¢ from DVN
            </button>
          )}
          {/* External wallet — atomic Mainnet path. Disabled until wallet
              is connected; clicking 'Open wallet drawer' above resolves it. */}
          <button
            type="button"
            onClick={onPay}
            disabled={pending !== null || !connected}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-100 hover:bg-indigo-500/25 disabled:opacity-40"
            title={!connected ? 'Connect a wallet to enable Mainnet payment' : undefined}
          >
            {pending === "sending" ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Awaiting wallet…</>
            ) : pending === "verifying" ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying tx…</>
            ) : (
              <><Coins className="h-3.5 w-3.5" /> Pay {intent.amountQc} Q¢ on {chainName}</>
            )}
          </button>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 font-mono break-all">
        Treasury: {intent.payTo.slice(0, 10)}…{intent.payTo.slice(-6)} · Token: {intent.tokenAddress.slice(0, 10)}…
      </p>
    </div>
  );
}

// ─── Buy Q¢ panel — terminal state of the fallback chain ────────────────────

function BuyQcPanel({
  error,
  onBuyQc,
  onCancel,
}: {
  error: string | null;
  onBuyQc?: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 space-y-2.5">
      <div className="flex items-start gap-2.5">
        <Coins className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-200">Not enough Q¢ to continue</p>
          <p className="text-[11px] text-amber-200/70 leading-snug mt-0.5">
            Your DVN balance is too low and no Mainnet payment was made.
            Top up your Q¢ to keep remixing.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-[11px] text-amber-200/70 leading-snug">{error}</div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] text-slate-400 hover:text-slate-200"
        >
          Cancel
        </button>
        {onBuyQc && (
          <button
            type="button"
            onClick={onBuyQc}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/25"
          >
            <Coins className="h-3.5 w-3.5" /> Buy more Q¢
          </button>
        )}
      </div>
    </div>
  );
}

export default RemixDialog;
