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
 * Read a response as JSON, or explain what actually came back.
 *
 * THE DEFECT THIS CLOSES (operator report, 2026-08-02): the Register button
 * failed with `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. That
 * is a JSON *parser* message leaking to an operator, and it names the wrong
 * problem entirely — nothing was wrong with the JSON, because there was no
 * JSON. The panel was calling `register/prepare` and `register/broadcast`,
 * two routes RETIRED by the Wallet Signing Topology ruling (2026-08-01), so
 * Next.js served its 404 HTML page and `res.json()` choked on the doctype.
 *
 * A blind `res.json()` turns every "route missing / gateway error / auth
 * redirect" into the same misleading parse error, so the real cause stays
 * invisible. This reads the body ONCE as text, parses only if it plausibly is
 * JSON, and otherwise raises a message that says what actually happened.
 */
async function readJsonOrExplain(res: Response, label: string): Promise<Record<string, unknown>> {
  const raw = await res.text();
  const trimmed = raw.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(`${label} returned malformed JSON (HTTP ${res.status}).`);
    }
  }
  if (trimmed.startsWith('<')) {
    throw new Error(
      `${label} returned an HTML page instead of JSON (HTTP ${res.status}). ` +
        `This usually means the route does not exist at that path, or a proxy/auth layer intercepted the call.`,
    );
  }
  throw new Error(`${label} returned an unexpected response (HTTP ${res.status}).`);
}

export const PILOT_AGENTS: RegistrableAgentOption[] = [
  { slug: 'moneypenny', displayName: 'Aigent MoneyPenny', agentCardPath: '/api/agents/moneypenny/agent-card.json' },
  { slug: 'nakamoto', displayName: 'Aigent Nakamoto', agentCardPath: '/api/agents/nakamoto/agent-card.json' },
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

export function RegisterAgentPanel({ agentSlug: initialAgentSlug, onAgentSlugChange }: RegisterAgentPanelProps) {
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
      const [reqRes, statusRes] = await Promise.all([
        personaFetch('/api/wallet/signing-requests', { cache: 'no-store' }),
        personaFetch('/api/journey/moneypenny-horizen/register/status', { cache: 'no-store' }),
      ]);
      const reqJson = (await reqRes.json().catch(() => null)) as {
        ok?: boolean;
        requests?: {
          actionKind: string;
          signerRole: string;
          subjectAgentRef: string | null;
          expired: boolean;
        }[];
      } | null;
      const statusJson = (await statusRes.json().catch(() => null)) as
        | { tokenId?: unknown; network?: unknown }
        | null;
      const tokenId = typeof statusJson?.tokenId === 'string' && statusJson.tokenId ? statusJson.tokenId : null;
      setHorizenFacts({
        network: typeof statusJson?.network === 'string' && statusJson.network ? statusJson.network : null,
        tokenId,
      });
      const mine = (reqJson?.requests ?? []).filter((r) => r.subjectAgentRef === `aigent-${agentSlug}`);
      setProgress(
        registerCeremonyProgress({
          walletReady: Boolean(walletGate?.ready),
          liveMandate: mine.some((r) => r.actionKind === 'authorize_registration' && !r.expired),
          liveInvocation: mine.some((r) => r.actionKind === 'sign_registry_transaction' && !r.expired),
          broadcastPending: false,
          tokenId,
          expiredAttempts: mine.filter((r) => r.expired).length,
        }),
      );
    } catch {
      // An unreadable ladder is left absent rather than rendered as
      // "nothing has happened" — the same rule the wallet count follows.
      setProgress(null);
    }
  }, [agentSlug, walletGate?.ready]);

  useEffect(() => {
    void readProgress();
  }, [readProgress, flow.step]);

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
      const res = await personaFetch('/api/wallet/principal/status', { cache: 'no-store' });
      const json = (await res.json()) as {
        ok?: boolean;
        capability?: string;
        controlProven?: boolean;
        detail?: string;
      };
      if (!res.ok || !json.ok) {
        // Unknown is not ready, and it is also not "you have no wallet".
        setWalletGate({
          ready: false,
          capability: 'UNKNOWN',
          controlProven: false,
          detail: 'Your principal wallet state could not be read, so a signing mandate cannot be offered yet.',
        });
        return;
      }
      setWalletGate({
        ready: json.capability === 'SIGNER_CONFIGURED' && Boolean(json.controlProven),
        capability: String(json.capability),
        controlProven: Boolean(json.controlProven),
        detail: String(json.detail ?? ''),
      });
    } catch {
      setWalletGate({
        ready: false,
        capability: 'UNKNOWN',
        controlProven: false,
        detail: 'Your principal wallet state could not be read, so a signing mandate cannot be offered yet.',
      });
    }
  }, []);

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
        const res = await personaFetch('/api/persona/sponsored-agents', { cache: 'no-store' });
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
  }, []);

  useEffect(() => () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
  }, []);

  const selectedAgent = PILOT_AGENTS.find((a) => a.slug === agentSlug) ?? PILOT_AGENTS[0];

  const prepare = useCallback(async () => {
    setFlow({ step: 'preparing' });
    try {
      const res = await personaFetch('/api/journey/moneypenny-horizen/register/mandate/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentSlug }),
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
  }, [agentSlug]);

  const pollStatus = useCallback(
    async (txHash: string, ownerWalletAddress: string, network: string, attempts: number) => {
      try {
        const res = await personaFetch('/api/journey/moneypenny-horizen/register/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentSlug, txHash, ownerWalletAddress, network }),
        });
        const json = await readJsonOrExplain(res, 'register/status');
        if (!res.ok || !json.ok) {
          throw new Error((json?.error as string) ?? `Register status check failed (${res.status})`);
        }
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
        setFlow({ step: 'error', message: 'Horizen has not confirmed registration yet — check back later, or try "Check status" again.' });
        return;
      }
      setFlow({ step: 'polling', txHash, ownerWalletAddress, network, attempts: attempts + 1 });
      pollTimerRef.current = setTimeout(() => void pollStatus(txHash, ownerWalletAddress, network, attempts + 1), POLL_INTERVAL_MS);
    },
    [agentSlug],
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
            {expiredAttemptsNote(progress.expiredAttempts) && (
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                {expiredAttemptsNote(progress.expiredAttempts)}
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

        {flow.step === 'idle' && walletGate?.ready && (
          <button
            onClick={() => void prepare()}
            className="flex items-center gap-1.5 rounded-md border border-purple-800/60 bg-purple-950/30 px-3 py-1.5 text-xs font-medium text-purple-200 transition-colors hover:bg-purple-900/40"
          >
            Register {selectedAgent.displayName} in Horizen <ChevronRight className="h-3.5 w-3.5" />
          </button>
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

        {flow.step === 'awaiting-signature' && (
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
            <p>
              {selectedAgent.displayName} is registered — Horizen tokenId <span className="font-mono">{flow.tokenId}</span>.
              The Verify stage can now authorize Pulse/P&amp;L transparency.
            </p>
          </div>
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
