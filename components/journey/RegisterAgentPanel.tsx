'use client';

/**
 * RegisterAgentPanel — the Register stage's real surface (agent-selectable
 * Register stage, 2026-07-31). Replaces the bare `AgentCardSurface` (which
 * only ever displayed MoneyPenny's card) with a panel that lets the operator
 * choose WHICH agent to register in Horizen's ERC-8004 registry.
 *
 * ── REWIRED TO THE MANDATE CEREMONY (bug fix, 2026-08-02) ──────────────────
 *
 * PRIOR DEFECT: the Register button failed with
 * `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. This panel was
 * still calling `register/prepare` and `register/broadcast` — two routes the
 * Wallet Signing Topology ruling (2026-08-01) RETIRED, because together they
 * fired a real server-custodial signature as the consequence of one
 * authenticated click. Next.js served its 404 HTML page and `res.json()`
 * choked on the doctype, so a stale-client problem surfaced as a parser
 * message that named nothing real.
 *
 * The flow is now the ceremony that actually exists:
 *
 *   mandate/prepare -> a PRINCIPAL SigningRequest is created (signs NOTHING)
 *                   -> the operator signs it in their own wallet
 *                   -> mandate/approve -> broadcast happens server-side as a
 *                      CONSEQUENCE of that signature
 *                   -> status (polled until Horizen confirms)
 *
 * The client never receives an unsigned transaction to hold or submit, and
 * there is no administrative fallback — see the mandate/prepare route header.
 *
 * The signing surface (the wallet's Pending Actions) SHIPPED with Signing
 * Phase 2 (2026-08-02): the awaiting-signature step hands the operator to it
 * via the serializable wallet-surface request, and the completion event
 * triggers a fresh status read here.
 *
 * "MoneyPenny is the demo agent; Aigent Nakamoto is the dry-run agent" —
 * operator ruling 2026-07-31. The dropdown lists both
 * (services/horizen/registrableAgents.ts), plus — stubbed, honestly — the
 * operator's own sponsored agents from the existing, real
 * /api/persona/sponsored-agents route. A sponsored agent has no
 * registry_assets/Agent Card/owner-key prerequisites yet, so it lists but
 * stays disabled with a note, rather than fabricating registrability. This
 * is the seam a future agent becomes real Horizen-registrable through: add
 * it to registrableAgents.ts, give it a registry_assets row + Agent Card
 * route, and it stops being disabled here — no UI change required.
 *
 * Every route this panel calls resolves getActivePersona server-side — MUST
 * use personaFetch, never raw fetch (CLAUDE.md Identity & Access Spine rule),
 * mirroring PulseTransparencyToggle.tsx's own convention.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, ShieldAlert } from 'lucide-react';
import { readJsonOrExplain } from '@/utils/readJsonOrExplain';
import { personaFetch } from '@/utils/personaSpine';
import {
  requestWalletSurface,
  subscribeWalletSurfaceCompletion,
  subscribeWalletSurfaceAck,
} from '@/services/wallet/walletSurfaceRequest';
import {
  registerCeremonyProgress,
  expiredAttemptsNote,
  horizenContact,
  REGISTER_CEREMONY_LADDER,
  type RegisterCeremonyProgress,
} from '@/services/horizen/registerCeremonyProgress';
import { AgentCardSurface } from './AgentCardSurface';

interface RegistrableAgentOption {
  slug: string;
  displayName: string;
  agentCardPath: string;
}

/**
 * Mirrors services/horizen/registrableAgents.ts's REGISTRABLE_AGENTS.
 * Duplicated as a small client-safe literal (not imported) — only the
 * slug/label/path a client needs, never the server-side agent_keys
 * resolution registrableAgents.ts's runtimeAgentId feeds into. Covered by
 * tests/horizen-registrable-agents.test.ts on the server side, so a drift
 * here would fail loudly (a 400 UNKNOWN_AGENT from register/prepare), never
 * silently.
 */

/**
 * How long the live mandate has left, ticking, and an auto-reread on expiry.
 *
 * Five mandates expired invisibly: the TTL existed only as a death the
 * operator discovered afterwards. A visible countdown converts it into a
 * deadline they can beat — and when it does lapse, the ladder re-reads
 * immediately instead of asserting "awaiting your signature" about a corpse
 * (the exact stale disagreement in the 00:18 screenshots).
 */
function MandateCountdown({ expiresAt, onExpired }: { expiresAt: string; onExpired: () => void }) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(expiresAt).getTime() - Date.now());
  const firedRef = useRef(false);
  useEffect(() => {
    firedRef.current = false;
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemainingMs(ms);
      if (ms <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpired();
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt, onExpired]);
  if (remainingMs <= 0) return null;
  const mins = Math.floor(remainingMs / 60_000);
  const secs = Math.floor((remainingMs % 60_000) / 1000);
  const urgent = remainingMs < 5 * 60_000;
  return (
    <p className={`mt-1 text-[11px] ${urgent ? 'text-amber-300' : 'text-slate-500'}`}>
      This mandate expires in {mins}:{String(secs).padStart(2, '0')}
      {urgent ? ' — sign it now or prepare a fresh one after it lapses.' : '.'}
    </p>
  );
}

/*
 * NAKAMOTO FIRST (operator, 2026-08-02).
 *
 * "MoneyPenny is the demo agent; Aigent Nakamoto is the dry-run agent"
 * (ruling 2026-07-31). The dry run is what is being exercised, so it is what
 * should be selected on arrival — MoneyPenny led only because it was written
 * first, and a mandate was prepared against it by accident.
 *
 * Order matters twice: this is the dropdown order AND `PILOT_AGENTS[0]` is the
 * fallback `resolveSurfaceProps` uses when a slug does not resolve. Both must
 * be the dry-run agent, or the fallback silently reintroduces the default this
 * change removes.
 */
export const PILOT_AGENTS: RegistrableAgentOption[] = [
  { slug: 'nakamoto', displayName: 'Aigent Nakamoto', agentCardPath: '/api/agents/nakamoto/agent-card.json' },
  { slug: 'moneypenny', displayName: 'Aigent MoneyPenny', agentCardPath: '/api/agents/moneypenny/agent-card.json' },
];

interface SponsoredAgent {
  agentRootId: string;
  displayName: string;
  agentCardUrl: string | null;
}

// `UnsignedTx` lived here. Removed with the retired broadcast path: under the
// Wallet Signing Topology the client never receives an unsigned transaction to
// hold, review and submit — the mandate is signed in the operator's wallet and
// broadcast server-side as a consequence of that signature.

/**
 * The principal wallet is a PREREQUISITE of the Register mandate, not a
 * failure mode of it.
 *
 *   Journey detects and explains the prerequisite
 *   → SmartWallet provisions and proves the wallet
 *   → Journey resumes the consequential act
 *
 * So this panel checks BEFORE offering the button, and hands the operator to
 * the wallet's own ceremony rather than describing one — "do not require the
 * user to discover the wallet setup manually". It never provisions anything
 * itself: wallet creation and proof belong to the wallet.
 */
interface PrincipalWalletGate {
  ready: boolean;
  capability: string;
  controlProven: boolean;
  detail: string;
  /**
   * WHO this verdict is about — the persona's T1 display label, never its id.
   *
   * The route has always returned it (`personaLabel`) precisely so a reader
   * can tell a contradiction from a question, and this panel dropped it. When
   * the Journey said "quarantined" and the wallet said "ready" there was
   * nothing on either surface to reveal that they were describing different
   * personas. Shown on every refusal so the next divergence names itself.
   */
  personaLabel: string | null;
}

/**
 * Six states, six things to say (operator, 2026-08-02).
 *
 *   > "Do not collapse every non-ready result into 'You do not yet have a
 *   >  principal wallet'."
 *
 * The browser run showed why that collapse is not merely imprecise: after a
 * provisioning attempt the operator's wallet may hold a real encrypted
 * envelope, and being told they have NO wallet invites them to make a second
 * one — abandoning the first. Each state names what is actually true and what
 * the remaining step is.
 */
function describeWalletGate(gate: PrincipalWalletGate): { title: string; body: string; action: string } {
  const RESUME = 'Registering requires you to sign a mandate with your own wallet. That wallet must be under ' +
    'first-party custody and must have freshly proven it holds its key — an external wallet cannot carry a ' +
    'principal mandate.';
  switch (gate.capability) {
    case 'ABSENT':
      return {
        title: 'You do not yet have a principal wallet',
        body: RESUME,
        action: 'Set up your principal wallet',
      };
    case 'AMBIGUOUS':
      return {
        title: 'Two addresses are on file and neither can sign',
        body:
          'This persona holds two different addresses with no key material behind either. One may be a real ' +
          'external wallet; the other a keyless placeholder. The wallet will show what happens to each before ' +
          'anything changes.',
        action: 'Review and repair in your wallet',
      };
    case 'ADDRESS_ONLY':
      return {
        title: 'An address is on file with no key behind it',
        body:
          'The recorded address was never derived from a key, so it can never produce a signature. It will be ' +
          'kept in audit history as non-signing and superseded by a real wallet.',
        action: 'Set up your principal wallet',
      };
    case 'EXTERNAL_UNPROVEN':
    case 'EXTERNAL_PROVEN':
      return {
        title: 'Your principal field holds an external wallet',
        body:
          'A connected external wallet is an execution instrument and may never carry a principal mandate. It ' +
          'will be preserved as a linked wallet, and a first-party principal wallet created beside it.',
        action: 'Set up your principal wallet',
      };
    case 'SIGNER_CONFIGURED':
      // The state the browser run produced. NEVER offer "create" here.
      return {
        title: 'Principal wallet configured · control proof incomplete',
        body:
          'An encrypted principal wallet already exists for this persona, but its control has not been proven. ' +
          'Nothing needs to be created — the remaining step is to unlock it and sign a fresh nonce.',
        action: 'Retry control proof in your wallet',
      };
    case 'LEGACY_EVIDENCE_ONLY':
    case 'COMPROMISED':
      return {
        title: 'This wallet is quarantined and cannot become your principal',
        body: gate.detail || 'A legacy or compromised address cannot serve as a principal signer.',
        action: 'Open your wallet',
      };
    default:
      // UNAVAILABLE / UNKNOWN — could not check is not "you have none".
      return {
        title: 'Your principal wallet state could not be read',
        body:
          'This is not a refusal and does not mean you have no wallet. Until the check succeeds, a mandate ' +
          'cannot be offered — because offering one on an unknown answer is how a second wallet gets created.',
        action: 'Open your wallet',
      };
  }
}

type FlowState =
  | { step: 'idle' }
  | { step: 'preparing' }
  /** The PRINCIPAL SigningRequest exists and awaits the operator's own wallet
   *  signature in Pending Actions. Nothing is signed or broadcast until then. */
  | { step: 'awaiting-signature'; requestId: string; summary: string | null }
  | { step: 'polling'; txHash: string; ownerWalletAddress: string; network: string; attempts: number }
  | { step: 'confirmed'; tokenId: string }
  | { step: 'error'; message: string };

const MAX_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 8000;

interface RegisterAgentPanelProps {
  personaId?: string;
  /** Initial selected agent slug — uncontrolled default only, read once on mount. */
  agentSlug?: string;
  /** Notified on every selection change so a parent (e.g. PilotJourneyTab) can
   * carry "which agent is being sponsored" forward to later journey stages
   * (Passport, Delegate, ...) — this component still owns the selection
   * itself; the parent only observes it. */
  onAgentSlugChange?: (agentSlug: string) => void;
}

export function RegisterAgentPanel({
  /*
   * WHICH PERSONA THIS PANEL IS ABOUT (operator, 2026-08-02, 12:34).
   *
   *   > "The second card isn't rendering, the status bar isn't progressing and
   *   >  there's no way to advance it in the wallet or journey picker."
   *
   * At that moment this panel said "This wallet is quarantined and cannot
   * become your principal · Principal wallet not ready", while the wallet
   * beside it said "Principal wallet ready · Control Proven ·
   * 0xa85e4662…". Neither was lying about the row it read — they were reading
   * DIFFERENT PERSONAS.
   *
   * `JourneyRunSurface` passes `personaId` to every surface it mounts
   * (JourneyRunSurface.tsx:494) and this panel declared it and then dropped
   * it. Without a hint `personaFetch` falls back to
   * localStorage['currentPersonaId'], and when that is unset the server
   * resolves "first persona owned, created_at ASC" — the devagent row named in
   * personaSpine.tsx's own comment. The wallet's Principal Wallet section and
   * Pending Actions BOTH pass `personaIdHint`, so they read the operator's
   * real persona. One surface hinted, its neighbour not, is the exact
   * inconsistency the spine exists to abolish (CLAUDE.md, 2026-07-20).
   *
   * The consequence was not cosmetic: the gate read a legacy address
   * (LEGACY_EVIDENCE_ONLY → "quarantined"), so the Register button was
   * withdrawn, and the ladder counted a stranger's signing requests — which is
   * why the agent-key card never appeared and nothing could be advanced from
   * either side.
   *
   * Every spine read below carries this hint. All of them, or none: a panel
   * that mixes hinted and unhinted reads contradicts itself between renders.
   */
  personaId,
  agentSlug: initialAgentSlug,
  onAgentSlugChange,
}: RegisterAgentPanelProps) {
  const [agentSlug, setAgentSlugState] = useState<string>(initialAgentSlug ?? PILOT_AGENTS[0].slug);
  const setAgentSlug = useCallback(
    (slug: string) => {
      setAgentSlugState(slug);
      onAgentSlugChange?.(slug);
    },
    [onAgentSlugChange],
  );
  // Announce the initial (default) selection too — a parent observing only
  // future changes would otherwise never learn the starting agent.
  useEffect(() => {
    onAgentSlugChange?.(agentSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [sponsoredAgents, setSponsoredAgents] = useState<SponsoredAgent[]>([]);
  const [cardVersion, setCardVersion] = useState(0);
  const [flow, setFlow] = useState<FlowState>({ step: 'idle' });
  const [walletGate, setWalletGate] = useState<PrincipalWalletGate | null>(null);
  /*
   * WHAT HAS ACTUALLY HAPPENED (operator, 2026-08-02).
   *
   *   > "The journey period is not progressing … It's kind of completely in
   *   >  the dark as to what's going on."
   *
   * Between clicks this panel fell back to `idle`, which looked identical
   * whether the operator had never started, had five mandates expire, or had
   * signed one. The only conclusion available was "nothing is happening".
   * The ladder is read from the signing store and the Horizen status, so the
   * surface states the stage instead of resetting to a button.
   */
  const [progress, setProgress] = useState<RegisterCeremonyProgress | null>(null);
  /*
   * Facts about Horizen itself, read from the status route rather than
   * assumed. Null means "not known from here" — `horizenContact` renders that
   * as "the configured network" rather than naming one we did not read.
   */
  const [horizenFacts, setHorizenFacts] = useState<{ network: string | null; tokenId: string | null }>({
    network: null,
    tokenId: null,
  });

  const readProgress = useCallback(async () => {
    try {
      /*
       * TWO SOURCES, EACH THE RIGHT ONE (fix, 2026-08-02 late).
       *
       * The first version read `register/status` with a bare GET. That route
       * is a POST requiring {agentSlug, txHash, ownerWalletAddress, network} —
       * it answers "has THIS broadcast confirmed", not "is this agent
       * registered". The bare call 400'd on every render, so `tokenId` was
       * always null, the REGISTERED rung could never light, and the network
       * was never known. The one break in an otherwise intact chain.
       *
       * "Is this agent registered" is answered by the agent card:
       * `metadata.horizen` is a projection of the SAME registry_assets binding
       * the status route writes on confirmation (never a second source of
       * truth), and the card is a public GET — the same read
       * PulseTransparencyToggle already does.
       */
      /*
       * A BROADCAST OUTLIVES THE PAGE THAT MADE IT (operator, 2026-08-02, 13:43).
       *
       *   > "We advanced to approve and then it hung ... And then interface is
       *   >  back to start over."
       *
       * The approval succeeded: `approveAgentRegistryInvocation` broadcast a
       * real transaction and wrote two receipts for it. The confirmation poll
       * then ran out, and the txHash — held ONLY in this component's `flow`
       * state — was lost on the next render. A live on-chain transaction with
       * no way left to ask about it, and "Register again" as the only visible
       * move, is how a duplicate registration gets made.
       *
       * The fact was never lost, only the page's memory of it. Read back from
       * the receipts, which are the durable record of exactly this.
       */
      const [reqRes, cardRes, receiptRes] = await Promise.all([
        personaFetch('/api/wallet/signing-requests', { cache: 'no-store', personaIdHint: personaId }),
        fetch(`/api/agents/${agentSlug}/agent-card.json`, { cache: 'no-store' }),
        personaFetch(
          '/api/assistant/receipts?limit=100&actionTypes=horizen_registration_submitted,horizen_agent_registered',
          { cache: 'no-store', personaIdHint: personaId },
        ),
      ]);
      const reqJson = (await reqRes.json().catch(() => null)) as {
        ok?: boolean;
        requests?: {
          actionKind: string;
          signerRole: string;
          subjectAgentRef: string | null;
          expired: boolean;
          expiresAt?: string;
        }[];
      } | null;
      const cardJson = (await cardRes.json().catch(() => null)) as {
        metadata?: { horizen?: { tokenId?: unknown; network?: unknown } };
      } | null;
      const horizen = cardJson?.metadata?.horizen;
      const cardTokenId = typeof horizen?.tokenId === 'string' && horizen.tokenId ? horizen.tokenId : null;
      const receiptJson = (await receiptRes.json().catch(() => null)) as {
        receipts?: {
          actionType: string;
          agentsInvoked?: string[] | null;
          actionInput?: {
            txHash?: unknown;
            network?: unknown;
            horizenAgentId?: unknown;
            registration?: { tokenId?: unknown } | null;
          } | null;
        }[];
      } | null;
      const forThisAgent = (receiptJson?.receipts ?? []).filter((r) =>
        (r.agentsInvoked ?? []).includes(`aigent-${agentSlug}`),
      );
      const confirmedReceipts = forThisAgent.filter((r) => r.actionType === 'horizen_agent_registered');
      const confirmedHashes = new Set(
        confirmedReceipts
          .map((r) => (typeof r.actionInput?.txHash === 'string' ? r.actionInput.txHash : ''))
          .filter(Boolean),
      );

      /*
       * ONE SCREEN, ONE ANSWER (pilot, 2026-08-03).
       *
       * The panel held Nakamoto's tokenId in THREE places and fed its ladder
       * from the weakest one, so a single screenshot showed all of:
       *   "Awaiting confirmation from Horizen"   (ladder — from the card alone)
       *   "HORIZEN TOKENID: not yet registered"  (card — projection was stuck)
       *   "Aigent Nakamoto is registered — Horizen tokenId 8798"  (flow)
       *
       * Three claims, mutually exclusive, all rendered at once. The remedy is
       * the operator's own precedence rule: a CONFIRMED external consequence
       * outranks a pending request, which outranks prepared local state. Any
       * source that can say "confirmed" settles it for every source.
       */
      const receiptTokenId =
        confirmedReceipts
          .map((r) => r.actionInput?.registration?.tokenId)
          .find((t): t is string => typeof t === 'string' && t.length > 0) ?? null;
      const tokenId = cardTokenId ?? receiptTokenId ?? flowTokenIdRef.current;

      setHorizenFacts({
        network: typeof horizen?.network === 'string' && horizen.network ? horizen.network : null,
        tokenId,
      });
      // The most recent broadcast with no confirmation receipt behind it.
      const unconfirmed = forThisAgent.find(
        (r) =>
          r.actionType === 'horizen_registration_submitted' &&
          typeof r.actionInput?.txHash === 'string' &&
          !confirmedHashes.has(r.actionInput.txHash),
      );
      setPendingBroadcast(
        unconfirmed && typeof unconfirmed.actionInput?.txHash === 'string'
          ? {
              txHash: unconfirmed.actionInput.txHash,
              network:
                typeof unconfirmed.actionInput?.network === 'string'
                  ? unconfirmed.actionInput.network
                  : null,
              horizenAgentId:
                typeof unconfirmed.actionInput?.horizenAgentId === 'string'
                  ? unconfirmed.actionInput.horizenAgentId
                  : null,
            }
          : null,
      );

      const mine = (reqJson?.requests ?? []).filter((r) => r.subjectAgentRef === `aigent-${agentSlug}`);
      const liveMandateRow = mine.find((r) => r.actionKind === 'authorize_registration' && !r.expired);
      setLiveMandateExpiresAt(liveMandateRow?.expiresAt ?? null);
      setProgress(
        registerCeremonyProgress({
          walletReady: Boolean(walletGate?.ready),
          liveMandate: Boolean(liveMandateRow),
          liveInvocation: mine.some((r) => r.actionKind === 'sign_registry_transaction' && !r.expired),
          expiredInvocations: mine.filter((r) => r.actionKind === 'sign_registry_transaction' && r.expired).length,
          // The broadcast leg is knowable only from this panel's own poll —
          // the tx facts live in the completion event, not in any store row.
          broadcastPending: flowStepRef.current === 'polling' || (!tokenId && unconfirmed !== undefined),
          tokenId,
          expiredAttempts: mine.filter((r) => r.expired).length,
        }),
      );
    } catch {
      // An unreadable ladder is left absent rather than rendered as
      // "nothing has happened" — the same rule the wallet count follows.
      setProgress(null);
    }
  }, [agentSlug, walletGate?.ready, personaId]);

  // The flow step, readable inside readProgress without re-creating the
  // callback (and its polling interval) on every step change.
  const flowStepRef = useRef<string>('idle');
  useEffect(() => {
    flowStepRef.current = flow.step;
  }, [flow.step]);

  /*
   * The tokenId this session's own confirmation returned — the LAST-RESORT
   * source for the ladder, used only when neither the Agent Card nor a
   * confirmation receipt carries it (both server writes stuck at once). It is
   * never cleared on a later poll: a confirmed registration does not become
   * unconfirmed because a subsequent read failed to see it.
   */
  const flowTokenIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (flow.step === 'confirmed' && flow.tokenId) flowTokenIdRef.current = flow.tokenId;
  }, [flow]);

  /** When the live mandate runs out — the countdown, and the auto-flip. */
  const [liveMandateExpiresAt, setLiveMandateExpiresAt] = useState<string | null>(null);
  /**
   * A transaction that was broadcast and has not been confirmed, recovered
   * from the receipts rather than remembered. Null means none — never "we
   * forgot": the read either finds one or the receipts say there is none.
   */
  const [pendingBroadcast, setPendingBroadcast] = useState<{
    txHash: string;
    network: string | null;
    horizenAgentId: string | null;
  } | null>(null);
  /**
   * Horizen's own words from the last status check, verbatim. Shown because
   * "not confirmed" and "answered something this code does not recognise" look
   * identical from the outside, and only one of them is about the chain.
   */
  const [lastHorizenAnswer, setLastHorizenAnswer] = useState<string | null>(null);
  /*
   * The INDEPENDENT chain read, reported alongside Horizen's answer (pilot,
   * 2026-08-03: twenty checks with the identifier recovered and the tool
   * answering, none of it matching the confirmation words). The two sources
   * measure different things, so both are shown and any disagreement is
   * stated — never one silently standing in for the other.
   */
  const [onChainDetail, setOnChainDetail] = useState<string | null>(null);
  const [confirmationSource, setConfirmationSource] = useState<string | null>(null);
  const [divergence, setDivergence] = useState<string | null>(null);

  useEffect(() => {
    void readProgress();
  }, [readProgress, flow.step]);

  /*
   * THE LADDER REFRESHES ITSELF (operator screenshots, 2026-08-02 00:18).
   *
   * The wallet said "nothing waiting · 5 expired" while this ladder said
   * "awaiting your signature" — both truthful AT THE MOMENT EACH LAST READ.
   * The ladder read once and froze; the mandate expired underneath it; the
   * wallet, opened later, saw the truth. A surface that reports a state with
   * a 30-minute fuse cannot read once: it must re-read, or it becomes the
   * stale half of every disagreement.
   *
   * 30s cadence (a 30-minute TTL loses a minute of accuracy at most), plus a
   * read on window focus — the operator returning from the wallet is exactly
   * when the state has most likely changed.
   */
  useEffect(() => {
    const interval = setInterval(() => void readProgress(), 30_000);
    const onFocus = () => void readProgress();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [readProgress]);

  /*
   * WHETHER ANY WALLET ANSWERED (operator, 2026-08-02, fourth round).
   *
   * Three fixes were aimed at which component hears a wallet-surface request,
   * and each time the operator reported the same thing: the button does
   * nothing and the console says nothing. That report was true and useless,
   * because a request delivered to nobody was indistinguishable from one
   * delivered and mishandled.
   *
   * Now a host ACKs when it actually opens the wallet. No ACK inside the
   * window below means no wallet in this host answered — a fact, which this
   * panel states along with the manual route, instead of leaving a dead
   * button. Handing over is still best-effort; being SILENT about a failed
   * hand-over is what stops here.
   */
  const [handoffUnanswered, setHandoffUnanswered] = useState(false);
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awaitingAckTokenRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeWalletSurfaceAck((ack) => {
      if (awaitingAckTokenRef.current !== ack.token) return;
      awaitingAckTokenRef.current = null;
      if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
      setHandoffUnanswered(false);
    });
    return () => {
      unsubscribe();
      if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
    };
  }, []);

  /** Ask for a wallet surface and notice if nothing answers. */
  const handOverToWallet = useCallback(
    (surface: 'PRINCIPAL_WALLET_PROVISIONING' | 'PENDING_ACTIONS', agentSlugForReturn: string, agentName: string) => {
      setHandoffUnanswered(false);
      const token = requestWalletSurface({
        surface,
        origin: 'HORIZEN_REGISTER',
        subjectAgentId: `aigent-${agentSlugForReturn}`,
        returnTarget: `journey:horizen:register:aigent-${agentSlugForReturn}`,
        returnLabel: `Continue to ${agentName} registration`,
      });
      awaitingAckTokenRef.current = token;
      if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
      // Generous enough that a host doing real work is not called silent;
      // short enough that the operator is not left staring at a dead button.
      ackTimerRef.current = setTimeout(() => {
        if (awaitingAckTokenRef.current !== token) return;
        awaitingAckTokenRef.current = null;
        setHandoffUnanswered(true);
      }, 1500);
    },
    [],
  );

  const readWalletGate = useCallback(async () => {
    try {
      const res = await personaFetch('/api/wallet/principal/status', { cache: 'no-store', personaIdHint: personaId });
      const json = (await res.json()) as {
        ok?: boolean;
        capability?: string;
        controlProven?: boolean;
        detail?: string;
        personaLabel?: string | null;
      };
      if (!res.ok || !json.ok) {
        // Unknown is not ready, and it is also not "you have no wallet".
        setWalletGate({
          ready: false,
          capability: 'UNKNOWN',
          controlProven: false,
          detail: 'Your principal wallet state could not be read, so a signing mandate cannot be offered yet.',
          personaLabel: null,
        });
        return;
      }
      setWalletGate({
        ready: json.capability === 'SIGNER_CONFIGURED' && Boolean(json.controlProven),
        capability: String(json.capability),
        controlProven: Boolean(json.controlProven),
        detail: String(json.detail ?? ''),
        personaLabel: typeof json.personaLabel === 'string' ? json.personaLabel : null,
      });
    } catch {
      setWalletGate({
        ready: false,
        capability: 'UNKNOWN',
        controlProven: false,
        detail: 'Your principal wallet state could not be read, so a signing mandate cannot be offered yet.',
        personaLabel: null,
      });
    }
  }, [personaId]);

  useEffect(() => {
    void readWalletGate();
  }, [readWalletGate]);

  /*
   * Reread on the wallet's completion event — serializable, so it crosses the
   * iframe boundary the Multi-Cartridge Viewer puts between this panel and the
   * wallet. The read is authoritative and uncached: the event says what the
   * wallet believes, and this stage acts only on what the status route
   * actually reports. Any outcome triggers a reread, including
   * SIGNER_CONFIGURED_AWAITING_PROOF — a partial result must update this card,
   * not leave it showing a state that has since moved on.
   */
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stub: the operator's own sponsored agents, real data from the existing
  // spine-gated route — never fabricated. None of these are Horizen-
  // registrable yet (no registry_assets/Agent Card prerequisite), so they
  // render disabled with an honest note rather than a working option.
  useEffect(() => {
    (async () => {
      try {
        const res = await personaFetch('/api/persona/sponsored-agents', { cache: 'no-store', personaIdHint: personaId });
        if (!res.ok) return;
        const json = await res.json();
        if (Array.isArray(json?.agents)) {
          setSponsoredAgents(
            json.agents.map((a: { agentRootId: string; displayName: string; agentCardUrl: string | null }) => ({
              agentRootId: a.agentRootId,
              displayName: a.displayName,
              agentCardUrl: a.agentCardUrl,
            })),
          );
        }
      } catch {
        // Soft-fail — the pilot-agent dropdown still works without this.
      }
    })();
  }, [personaId]);

  useEffect(() => () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
  }, []);

  const selectedAgent = PILOT_AGENTS.find((a) => a.slug === agentSlug) ?? PILOT_AGENTS[0];

  /*
   * Has the ceremony moved PAST the mandate rung? Compared by position on the
   * ladder rather than by naming the later stages, so a rung inserted after
   * this one is covered without anyone remembering to come back here.
   */
  const ladderMovedPastMandate = (() => {
    if (!progress) return false;
    const mandateAt = REGISTER_CEREMONY_LADDER.findIndex((s) => s.id === 'MANDATE_AWAITING_SIGNATURE');
    const nowAt = REGISTER_CEREMONY_LADDER.findIndex((s) => s.id === progress.stageId);
    return nowAt > mandateAt;
  })();

  /*
   * The wallet act the CURRENT rung requires, if any. Both live in Pending
   * actions; they are different acts and are labelled as such. Every other
   * rung is either the wallet gate (its own card, its own hand-over), the
   * network's turn, or done — none of them has a wallet act to offer.
   */
  /*
   * ONE PRIMARY CONTROL, AND IT FOLLOWS THE RUNG (operator, 2026-08-02, 13:43).
   *
   *   > "The main button should be state aware and direct the user to the next
   *   >  state ... if action is not available it can be inactive."
   *
   * "Register X in Horizen" was rendered on `flow.step === 'idle'` alone, so it
   * offered the FIRST act of the ceremony whatever rung the ceremony was on.
   * At rung 5 — a transaction broadcast and unconfirmed — that is not merely
   * unhelpful: pressing it builds and broadcasts a SECOND registration, and the
   * only guard against a duplicate (`ALREADY_REGISTERED`) reads the Agent
   * Card's tokenId, which is not written until a confirmation this ceremony has
   * not had. So the button is derived from the rung, and at rung 5 it asks
   * Horizen rather than starting again.
   */
  const primaryAction: { label: string; run: () => void; enabled: boolean; note: string | null } | null =
    !progress
      ? null
      : progress.stageId === 'REGISTERED'
        ? null
        : progress.stageId === 'WALLET_NOT_READY'
          ? {
              label: 'Set up your principal wallet',
              run: () => handOverToWallet('PRINCIPAL_WALLET_PROVISIONING', selectedAgent.slug, selectedAgent.displayName),
              enabled: true,
              note: null,
            }
          : progress.stageId === 'MANDATE_AWAITING_SIGNATURE'
            ? {
                label: 'Sign in your wallet',
                run: () => handOverToWallet('PENDING_ACTIONS', selectedAgent.slug, selectedAgent.displayName),
                enabled: true,
                note: null,
              }
            : progress.stageId === 'INVOCATION_AWAITING_APPROVAL'
              ? {
                  label: 'Approve the agent key in your wallet',
                  run: () => handOverToWallet('PENDING_ACTIONS', selectedAgent.slug, selectedAgent.displayName),
                  enabled: true,
                  note: null,
                }
              : progress.stageId === 'BROADCAST_AWAITING_CONFIRMATION'
                ? {
                    label: 'Check status with Horizen',
                    run: () => {
                      if (!pendingBroadcast) return;
                      setFlow({
                        step: 'polling',
                        txHash: pendingBroadcast.txHash,
                        ownerWalletAddress: '',
                        network: pendingBroadcast.network ?? 'base-sepolia',
                        attempts: 0,
                      });
                      void pollStatus(
                        pendingBroadcast.txHash,
                        '',
                        pendingBroadcast.network ?? 'base-sepolia',
                        0,
                        pendingBroadcast.horizenAgentId,
                      );
                    },
                    enabled: pendingBroadcast !== null,
                    note:
                      'A registration transaction is already on the network for this agent. Registering again ' +
                      'would broadcast a second one — ask Horizen about this one first.',
                  }
                : {
                    label: `Register ${selectedAgent.displayName} in Horizen`,
                    run: () => void prepare(),
                    enabled: Boolean(walletGate?.ready),
                    note: walletGate?.ready ? null : 'Your principal wallet must be ready before a mandate can be prepared.',
                  };

  const walletActLabel =
    progress?.stageId === 'MANDATE_AWAITING_SIGNATURE'
      ? 'Sign in your wallet'
      : progress?.stageId === 'INVOCATION_AWAITING_APPROVAL'
        ? 'Approve the agent key in your wallet'
        : null;

  const prepare = useCallback(async () => {
    setFlow({ step: 'preparing' });
    try {
      /*
       * The mandate is CREATED for whichever persona the server resolves. If
       * that is not the persona the wallet lists Pending Actions for, the
       * request exists and is invisible — which is what "the second card isn't
       * rendering" was. Prepared under the same persona this panel reads.
       */
      const res = await personaFetch('/api/journey/moneypenny-horizen/register/mandate/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentSlug }),
        personaIdHint: personaId,
      });
      const json = await readJsonOrExplain(res, 'register/mandate/prepare');
      if (!res.ok || !json.ok) {
        throw new Error((json?.error as string) ?? `Register mandate could not be prepared (${res.status})`);
      }
      const request = json.request as { id?: string; summary?: string } | undefined;
      if (!request?.id) throw new Error('The server prepared no signing request to authorize.');
      setFlow({ step: 'awaiting-signature', requestId: request.id, summary: request.summary ?? null });
    } catch (err) {
      setFlow({ step: 'error', message: err instanceof Error ? err.message : 'Could not prepare registration' });
    }
  }, [agentSlug, personaId]);

  const pollStatus = useCallback(
    async (
      txHash: string,
      ownerWalletAddress: string,
      network: string,
      attempts: number,
      horizenAgentId?: string | null,
    ) => {
      try {
        const res = await personaFetch('/api/journey/moneypenny-horizen/register/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentSlug, txHash, ownerWalletAddress, network, horizenAgentId }),
          personaIdHint: personaId,
        });
        const json = await readJsonOrExplain(res, 'register/status');
        if (!res.ok || !json.ok) {
          throw new Error((json?.error as string) ?? `Register status check failed (${res.status})`);
        }
        /*
         * WHAT HORIZEN ACTUALLY SAID (operator, 2026-08-02: "It's stuck here
         * and not confirming the broadcast").
         *
         * `confirmed` is decided by a substring match over the flattened tool
         * result — 'active' | 'confirmed' | 'complete'. If Horizen answers in
         * any other words, this reports "not confirmed" forever and the
         * surface says only that. The service already returns `rawStatus`;
         * nothing was showing it, so an unconfirmed answer was
         * indistinguishable from an unrecognised one.
         *
         * Widening the match on a guess would risk the opposite error —
         * declaring a registration confirmed that is not. So the raw answer is
         * SHOWN and the match is left alone until there is evidence of what to
         * widen it to.
         */
        if (typeof json.rawStatus === 'string' && json.rawStatus) {
          setLastHorizenAnswer(json.rawStatus);
        }
        const chain = json.onChain as { detail?: unknown } | undefined;
        if (chain && typeof chain.detail === 'string') setOnChainDetail(chain.detail);
        setConfirmationSource(typeof json.confirmationSource === 'string' ? json.confirmationSource : null);
        setDivergence(typeof json.divergence === 'string' ? json.divergence : null);
        if (json.confirmed) {
          // `readJsonOrExplain` returns unknown-valued fields — a tokenId that
          // arrived as something other than a string must not be rendered as
          // one. Reported honestly rather than coerced.
          const tokenId = typeof json.tokenId === 'string' ? json.tokenId : '';
          setFlow({ step: 'confirmed', tokenId });
          setCardVersion((v) => v + 1);
          return;
        }
      } catch (err) {
        setFlow({ step: 'error', message: err instanceof Error ? err.message : 'Could not check registration status' });
        return;
      }
      if (attempts + 1 >= MAX_POLL_ATTEMPTS) {
        setFlow({
          step: 'error',
          message:
            `Horizen has not confirmed this registration after ${MAX_POLL_ATTEMPTS} checks. The transaction ` +
            `(${txHash}) is broadcast on ${network} and this is a report about the CHECK, not a failure of the ` +
            'transaction — nothing has been lost and nothing needs re-registering. Press “Check status with ' +
            'Horizen” again, or read the transaction on the network directly.',
        });
        return;
      }
      setFlow({ step: 'polling', txHash, ownerWalletAddress, network, attempts: attempts + 1 });
      pollTimerRef.current = setTimeout(
        () => void pollStatus(txHash, ownerWalletAddress, network, attempts + 1, horizenAgentId),
        POLL_INTERVAL_MS,
      );
    },
    [agentSlug, personaId],
  );

  useEffect(
    () =>
      subscribeWalletSurfaceCompletion((completion) => {
        if (completion.surface === 'PRINCIPAL_WALLET_PROVISIONING') {
          void readWalletGate();
          return;
        }
        if (completion.surface !== 'PENDING_ACTIONS' || completion.outcome !== 'ACTION_COMPLETED') return;
        const result = completion.result ?? {};
        /*
         * The invocation approval broadcast the transaction, and its facts
         * arrive HERE because Register is the surface that drives the Horizen
         * confirmation poll — the poll that writes the binding receipt. The
         * wallet completed both acts; without this hand-back the ceremony
         * could never reach COMPLETE, because nobody who knew the txHash was
         * responsible for confirming it.
         */
        if (
          result.actionKind === 'sign_registry_transaction' &&
          typeof result.txHash === 'string' &&
          typeof result.ownerWalletAddress === 'string' &&
          typeof result.network === 'string' &&
          result.subjectAgentRef === `aigent-${agentSlug}`
        ) {
          setFlow({
            step: 'polling',
            txHash: result.txHash,
            ownerWalletAddress: result.ownerWalletAddress,
            network: result.network,
            attempts: 0,
          });
          void pollStatus(result.txHash, result.ownerWalletAddress, result.network, 0);
        }
      }),
    [readWalletGate, agentSlug, pollStatus],
  );

  // The retired `register/broadcast` call lived here. It is GONE, not
  // renamed: the Wallet Signing Topology ruling (2026-08-01) removed the
  // server-custodial "confirm → we sign for you" path entirely, and its route
  // header states there is no administrative fallback. Broadcasting now
  // happens only as a consequence of the operator signing the mandate in
  // their own wallet. Re-adding a client-side broadcast here would restore
  // exactly the custody violation that ruling closed.

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
        <label className="text-[10px] uppercase tracking-wide text-slate-500" htmlFor="register-agent-select">
          Agent to register
        </label>
        <select
          id="register-agent-select"
          value={agentSlug}
          onChange={(e) => {
            setAgentSlug(e.target.value);
            setFlow({ step: 'idle' });
          }}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-200"
        >
          <optgroup label="Pilot agents">
            {PILOT_AGENTS.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.displayName}
              </option>
            ))}
          </optgroup>
          {sponsoredAgents.length > 0 && (
            <optgroup label="Your sponsored agents (Horizen registration not yet available)">
              {sponsoredAgents.map((a) => (
                <option key={a.agentRootId} value={a.agentRootId} disabled>
                  {a.displayName}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <AgentCardSurface key={`${agentSlug}-${cardVersion}`} route={selectedAgent.agentCardPath} />

      <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
        {flow.step === 'idle' && walletGate && !walletGate.ready && (() => {
          const shown = describeWalletGate(walletGate);
          return (
            <div className="text-xs">
              <div className="font-medium text-amber-200">{shown.title}</div>
              <p className="mt-1 leading-relaxed text-slate-400">{shown.body}</p>
              {walletGate.detail && walletGate.capability !== 'LEGACY_EVIDENCE_ONLY' && (
                <p className="mt-1 text-[11px] text-slate-500">{walletGate.detail}</p>
              )}
              {/* Which persona this refusal is about. A refusal that does not
                  say whose wallet it read is indistinguishable from a
                  contradiction when the wallet beside it says otherwise. */}
              {walletGate.personaLabel && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Read for persona <span className="text-slate-400">{walletGate.personaLabel}</span>. If your wallet
                  shows a different persona, switch to that one and this refusal will re-read.
                </p>
              )}
              <button
                onClick={() => {
                  handOverToWallet('PRINCIPAL_WALLET_PROVISIONING', selectedAgent.slug, selectedAgent.displayName);
                }}
                className="mt-2 flex items-center gap-1.5 rounded-md border border-violet-800/60 bg-violet-950/30 px-3 py-1.5 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-900/40"
              >
                {shown.action} <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })()}

        {/* THE LADDER — what has happened, and who acts next.
            The panel used to fall back to a bare button between clicks, which
            looked the same whether nothing had been tried or five mandates had
            expired. "Nothing is progressing" was the only reading available. */}
        {progress && (
          <div className="mb-1 rounded-md border border-slate-800 bg-slate-950/40 p-3">
            <div className="flex items-center gap-2">
              {/* The HEADLINE, not the rung's achievement label. This read
                  "Mandate signed by you · waiting on you" directly above "A
                  mandate is prepared and waiting for your signature" — the
                  current rung is the one that has NOT happened. */}
              <span className="text-xs font-semibold text-slate-100">{progress.headline}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium border ${
                  progress.nextActor === 'you'
                    ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
                    : progress.nextActor === 'the network'
                      ? 'border-sky-500/40 bg-sky-500/10 text-sky-200'
                      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                }`}
              >
                {progress.nextActor === 'nobody' ? 'complete' : `waiting on ${progress.nextActor}`}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{progress.meaning}</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-200">
              <span className="text-slate-500">Next:</span> {progress.nextAct}
            </p>
            {/* The fuse, visible while it burns. Five mandates died invisibly;
                a deadline the operator can see is one they can beat. */}
            {progress.stageId === 'MANDATE_AWAITING_SIGNATURE' && liveMandateExpiresAt && (
              <MandateCountdown expiresAt={liveMandateExpiresAt} onExpired={() => void readProgress()} />
            )}
            {expiredAttemptsNote(progress.expiredAttempts) && (
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                {expiredAttemptsNote(progress.expiredAttempts)}
              </p>
            )}
            {/* START OVER (operator, 2026-08-02: "probably needs a start over
                button to clear and restart otherwise we'll remain stuck
                here").

                It clears THIS PAGE'S view of the ceremony and re-reads the
                store — it does not refuse or delete anything. Nothing server
                side is cancelled: a live mandate stays live and stays
                signable, because abandoning an authorisation on the operator's
                behalf is not a side effect a "clear the screen" control may
                have. To retire a request deliberately, Refuse it in the
                wallet, where the consequence is stated. */}
            {/* THE LADDER NAMES AN ACT — SO IT OFFERS IT (operator,
                2026-08-02, 13:10: "It's stuck again").

                At rung 4 the card said "Next: Open Pending actions and approve
                the agent's key invocation" and gave no way to do it. The only
                wallet button on the page belonged to the stale
                awaiting-signature card below, and it was labelled "Sign in
                your wallet" for a mandate that was already signed. So the one
                control the operator could see performed the wrong step, and
                the right step had no control at all.

                Both acts happen in Pending actions — the same hand-over, the
                same bus, the same flow. Only the label changes with the rung,
                because "sign" and "approve" are not the same act and must not
                be worded as if they were. */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {walletActLabel && (
                <button
                  type="button"
                  onClick={() => {
                    handOverToWallet('PENDING_ACTIONS', selectedAgent.slug, selectedAgent.displayName);
                  }}
                  className="flex items-center gap-1.5 rounded-md border border-violet-800/60 bg-violet-950/30 px-3 py-1.5 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-900/40"
                >
                  {walletActLabel} <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
              {progress.stageId !== 'REGISTERED' && (
                <button
                  type="button"
                  onClick={() => {
                    setFlow({ step: 'idle' });
                    void readProgress();
                  }}
                  className="rounded-md border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200"
                >
                  Start over
                </button>
              )}
            </div>
            {/* A hand-over that reached nobody is reported here too — this is
                now the primary wallet control, so its failure must be as
                visible as the one below it always was. */}
            {handoffUnanswered && walletActLabel && (
              <p className="mt-2 rounded-md border border-amber-900/40 bg-amber-950/20 p-2 text-[11px] leading-relaxed text-amber-200">
                No wallet surface in this page answered the hand-over, so nothing opened. Nothing has been lost — the
                request is stored and still waiting. Open your wallet from the{' '}
                <span className="text-amber-100">Welcome, &lt;persona&gt;</span> badge at the top of the cartridge and
                choose <span className="text-amber-100">Pending actions</span>.
              </p>
            )}
            {/* HORIZONTAL, completed rungs in green (operator, 2026-08-02).
                Read at a glance during a walkthrough: how far along, and how
                much is left. Scrolls on narrow viewports rather than wrapping
                into an unreadable stack. */}
            <ol className="mt-3 flex items-start gap-1 overflow-x-auto pb-1">
              {progress.ladder.map((st, i) => (
                <li key={st.id} className="flex min-w-[7.5rem] flex-1 items-start gap-1">
                  <div className="flex min-w-0 flex-col items-start gap-1">
                    <div className="flex w-full items-center gap-1">
                      <span
                        aria-hidden="true"
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                          st.state === 'done'
                            ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                            : st.state === 'current'
                              ? 'border-violet-400/60 bg-violet-500/20 text-violet-200'
                              : 'border-slate-700 text-slate-600'
                        }`}
                      >
                        {st.state === 'done' ? '✓' : st.state === 'current' ? '●' : i + 1}
                      </span>
                      {i < progress.ladder.length - 1 && (
                        <span
                          aria-hidden="true"
                          className={`h-px flex-1 ${st.state === 'done' ? 'bg-emerald-500/40' : 'bg-slate-800'}`}
                        />
                      )}
                    </div>
                    <span
                      className={`text-[10px] leading-tight ${
                        st.state === 'done'
                          ? 'text-emerald-300'
                          : st.state === 'current'
                            ? 'font-medium text-slate-100'
                            : 'text-slate-600'
                      }`}
                    >
                      {st.label}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            {/* WHAT CONTACT WITH HORIZEN HAS ACTUALLY OCCURRED.
                "Nothing indicates that we're talking to the Horizen system at
                all" was TRUE — nothing is sent until the operator signs and
                approves. Saying so beats a "connecting…" that would be
                theatre. */}
            {(() => {
              const contact = horizenContact({
                network: horizenFacts.network,
                broadcastPending: progress.stageId === 'BROADCAST_AWAITING_CONFIRMATION',
                tokenId: progress.stageId === 'REGISTERED' ? horizenFacts.tokenId : null,
              });
              return (
                <p
                  className={`mt-2.5 rounded border p-2 text-[10px] leading-relaxed ${
                    contact.contacted
                      ? 'border-emerald-900/40 bg-emerald-950/20 text-emerald-200'
                      : 'border-slate-800 bg-slate-950/50 text-slate-400'
                  }`}
                >
                  <span className="text-slate-500">Horizen:</span> {contact.statement}
                </p>
              );
            })()}
          </div>
        )}

        {flow.step === 'idle' && primaryAction && (
          <div>
            <button
              onClick={primaryAction.run}
              disabled={!primaryAction.enabled}
              className="flex items-center gap-1.5 rounded-md border border-purple-800/60 bg-purple-950/30 px-3 py-1.5 text-xs font-medium text-purple-200 transition-colors hover:bg-purple-900/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {primaryAction.label} <ChevronRight className="h-3.5 w-3.5" />
            </button>
            {primaryAction.note && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-amber-200">{primaryAction.note}</p>
            )}
          </div>
        )}

        {flow.step === 'idle' && !walletGate && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking your principal wallet…
          </div>
        )}

        {flow.step === 'preparing' && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Building the registration transaction…
          </div>
        )}

        {/* THE LADDER OUTRANKS THIS CARD.

            `flow` is what THIS PAGE last did; the ladder is what the signing
            store says IS. They agreed until the mandate was signed in the
            wallet — after that this card went on asking for a signature the
            operator had already given, directly beneath a ladder reporting the
            mandate signed and the agent key awaiting approval. One panel,
            two answers, and the wrong one carried the only button.

            Rendered only while the ladder has NOT moved past the mandate rung.
            NOT_STARTED still shows it, so the moment between preparing a
            mandate and the ladder catching up does not flash empty. */}
        {flow.step === 'awaiting-signature' && !ladderMovedPastMandate && (
          <div className="text-xs">
            <p className="flex items-center gap-1.5 font-medium text-amber-200">
              <ShieldAlert className="h-3.5 w-3.5" /> Awaiting your wallet signature
            </p>
            <p className="mt-1 text-slate-400">
              A registration mandate has been prepared and is waiting for you to sign it with your own wallet. Nothing
              has been signed or broadcast — and nothing will be until you approve it yourself.
            </p>
            {flow.summary && <p className="mt-1.5 text-slate-300">{flow.summary}</p>}
            <p className="mt-1 font-mono text-[11px] text-slate-500">request {flow.requestId}</p>
            {/* Signing Phase 2 shipped (2026-08-02): the wallet's Pending
                Actions surface is where this signature happens. The Journey
                DETECTS and hands over; the wallet signs — same boundary as
                provisioning, same request bus. */}
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => {
                  handOverToWallet('PENDING_ACTIONS', selectedAgent.slug, selectedAgent.displayName);
                }}
                className="flex items-center gap-1.5 rounded-md border border-violet-800/60 bg-violet-950/30 px-3 py-1.5 text-xs font-medium text-violet-200 transition-colors hover:bg-violet-900/40"
              >
                Sign in your wallet <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setFlow({ step: 'idle' })}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800/60"
              >
                Back
              </button>
            </div>
            {/* A hand-over that reached nobody is reported, never left blank.
                The mandate is safe either way — it is a row in the signing
                store, not something held in this page — so the manual route
                genuinely works and is worth naming precisely. */}
            {handoffUnanswered && (
              <p className="mt-2 rounded-md border border-amber-900/40 bg-amber-950/20 p-2 text-[11px] leading-relaxed text-amber-200">
                No wallet surface in this page answered the hand-over, so nothing opened. Your mandate is
                unaffected — it is stored and still waiting. Open your wallet from the{' '}
                <span className="text-amber-100">Welcome, &lt;persona&gt;</span> badge at the top of the cartridge and
                choose <span className="text-amber-100">Pending actions</span> to sign request{' '}
                <span className="font-mono">{flow.step === 'awaiting-signature' ? flow.requestId : ''}</span> there.
              </p>
            )}
          </div>
        )}

        {flow.step === 'polling' && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Waiting for Horizen to confirm ({flow.attempts}/{MAX_POLL_ATTEMPTS})…
          </div>
        )}

        {flow.step === 'confirmed' && (
          <div className="flex items-start gap-2 text-xs text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p>
                {selectedAgent.displayName} is registered — Horizen tokenId <span className="font-mono">{flow.tokenId}</span>.
                The Verify stage can now authorize Pulse/P&amp;L transparency.
              </p>
              {/* WHICH SOURCE SAID SO. A confirmation from the chain alone and
                  one Horizen also reports are different findings, and an
                  operator acting on this is entitled to know which they have. */}
              {confirmationSource && (
                <p className="mt-1 text-[10px] text-emerald-200/80">
                  confirmed by:{' '}
                  {confirmationSource === 'both'
                    ? 'the transaction receipt on-chain AND Horizen’s onboarding status'
                    : confirmationSource === 'on-chain-receipt'
                      ? 'the transaction receipt on-chain (verified by ownerOf)'
                      : 'Horizen’s onboarding status'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Stated, never resolved — the two sources measure different things. */}
        {divergence && (flow.step === 'confirmed' || flow.step === 'error' || flow.step === 'polling') && (
          <div className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] leading-relaxed text-amber-100">
            {divergence}
          </div>
        )}

        {onChainDetail && (flow.step === 'error' || flow.step === 'polling') && (
          <details className="mb-2 rounded-md border border-slate-800 bg-slate-950/60 p-2 text-[11px]">
            <summary className="cursor-pointer text-slate-300">What the chain says</summary>
            <p className="mt-1.5 break-all text-[10px] leading-relaxed text-slate-400">{onChainDetail}</p>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
              Read directly from the registration transaction’s own receipt — a minted{' '}
              <span className="font-mono">Registered</span>/<span className="font-mono">Transfer</span> event whose{' '}
              <span className="font-mono">ownerOf</span> resolves to this agent’s wallet. This does not depend on how
              Horizen words its status string.
            </p>
          </details>
        )}

        {flow.step === 'error' && lastHorizenAnswer && (
          <details className="mb-2 rounded-md border border-slate-800 bg-slate-950/60 p-2 text-[11px]">
            <summary className="cursor-pointer text-slate-300">What Horizen answered</summary>
            <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed text-slate-400">
              {lastHorizenAnswer}
            </pre>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
              A registration is treated as confirmed when this answer contains “active”, “confirmed” or
              “complete”. If it plainly says the registration succeeded in other words, that is a match this code
              does not yet make — report it rather than assuming either way.
            </p>
          </details>
        )}
        {flow.step === 'error' && (
          <div className="flex items-start gap-2 text-xs text-rose-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0 flex-1">
              {/* Some refusals (e.g. UNSIGNED_TX_UNAVAILABLE) embed the raw MCP
                  arguments + response so the exact call/response is visible —
                  never a bare "not found" — rendered as a scrollable, wrapped
                  block rather than a single unreadable paragraph. */}
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded border border-rose-900/40 bg-rose-950/20 p-2 font-mono text-[11px] leading-snug text-rose-200">
                {flow.message}
              </pre>
              <button
                onClick={() => setFlow({ step: 'idle' })}
                className="mt-2 rounded-md border border-slate-700 px-2 py-1 text-slate-300 hover:bg-slate-800/60"
              >
                Start over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RegisterAgentPanel;
