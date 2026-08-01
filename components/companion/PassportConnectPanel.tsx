/**
 * PassportConnectPanel — the Companion's Connect surface.
 *
 * PRD-PAG-001 **Amendment A** §A.7 + the operator's Connect state machine
 * (chartered 2026-07-26), extended by the first-connection closure (operator
 * ruling 2026-07-28, rulings 1–4).
 *
 * ── WHAT CONNECT MEANS HERE ────────────────────────────────────────────────
 *
 * This is Passport-NATIVE access: the citizen does not sign into anything
 * first. They prove control of the wallet holding their Passport, and a
 * session follows. There is no username, no password, and no account to
 * create — the internal principal is resolved behind the proof (§A.3.2).
 *
 * ── THE RULED ORDER (§A.3.4, ruling 1) ─────────────────────────────────────
 *
 *   Connect → wallet challenge → prove wallet control → [present Passport,
 *   only if this wallet has never been linked] → resolve canonical
 *   personhood → establish/reconcile wallet binding → choose persona →
 *   establish application session
 *
 * "Present Passport" (2026-07-28 addition) is a LIVE World ID proof, offered
 * ONLY when the proven wallet has no existing binding — a wallet that is
 * already linked skips straight from proof to persona choice, exactly as
 * before. Persona choice is now its OWN explicit step (ruling 2) — every
 * connection shows its real persona candidates and requires a selecting
 * click, even when there is exactly one. There is no server-side auto-pick
 * anywhere in this flow; see /api/passport-connect/finalize's own header for
 * why that specific absence is load-bearing.
 *
 * ── WALLET CHOOSER ≠ PERSONA CHOOSER (ruling 3) ─────────────────────────────
 *
 * `choose-wallet` picks among WALLET ADDRESSES an injected provider exposes
 * (`eth_requestAccounts`) — a wallet may hold one Passport, control several
 * addresses, and relate to several personas over time. `choose-persona` is
 * the SEPARATE, later step where the citizen picks which of THEIR OWN
 * personas becomes active for this session. Never conflate the two states or
 * their copy.
 *
 * ── RULING A.7: PREFERRED, NEVER EXCLUSIVE ─────────────────────────────────
 *
 * The Companion is the preferred connector, but the PROTOCOL must not depend
 * on it. Everything here talks to `/api/passport-connect/*` over plain HTTP
 * and uses the injected EIP-1193 provider — no `chrome.*`, no extension
 * bridge, no Companion-only capability. If a future edit makes this
 * component the only thing that can authenticate, that is an infraction of
 * the ruling.
 *
 * ── HOLDER CONTROL IS NOT OPTIONAL ─────────────────────────────────────────
 *
 * "A Passport is present in the wallet" is never sufficient — a readable
 * credential is not a bearer token. The citizen always performs a local
 * approval ceremony (the wallet's own signing prompt), and the server always
 * verifies a single-use, origin-bound challenge. What is optional is
 * separately enrolled 2FA; the cryptographic proof is not.
 */

"use client";

import { useCallback, useState } from "react";
import { ShieldCheck, Wallet as WalletIcon, Loader2, AlertTriangle, UserCircle2 } from "lucide-react";

import { getSupabaseBrowserClient } from "@/utils/supabaseBrowser";
import { personaFetch } from "@/utils/personaSpine";
import { WorldIdButton, type WorldIdProofBundle } from "@/components/passport/WorldIdButton";
import { openInSidePanelHostWindow } from "@/services/companion/sidePanelTabBridge";

/**
 * The operator's state machine, extended 2026-07-28 (rulings 1–3). `no-wallet`
 * (A) is not an initial state — it is only entered once we have LOOKED and
 * found no provider, so a citizen with a wallet never sees a "connect a
 * wallet" prompt they don't need.
 */
type ConnectState =
  | { kind: "idle" }
  | { kind: "no-wallet" } // A
  | { kind: "no-passport" } // B
  | { kind: "choose-wallet"; addresses: string[] } // D (renamed from `choose` — ruling 3)
  | { kind: "link-passport"; address: string } // NEW — "present Passport" (ruling 1)
  | { kind: "choose-persona"; transactionToken: string; personas: PersonaChoice[]; passport: PassportFacts } // NEW (ruling 2)
  | { kind: "connected"; passport: PassportFacts; handoffUrl?: string } // E
  | { kind: "working"; step: string }
  | { kind: "error"; message: string };

interface PassportFacts {
  passportClass: string | null;
  citizenStatus: string | null;
  participantStatus: string | null;
  passportGrade: string | null;
  expiresAt: string | null;
}

/** ruling 2's exact projection — never widen this shape client-side either. */
interface PersonaChoice {
  personaPublicRef: string;
  displayLabel: string;
  avatarUrl?: string;
  personaType?: string;
}

interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

/** The audience this surface authenticates for. Bound into the signed message. */
const AUDIENCE = "metame-companion";

function provider(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  const injected = (window as unknown as { ethereum?: Eip1193 }).ethereum;
  return injected ?? null;
}

/**
 * Where this citizen will land — for the consent copy only (ruling 4). NEVER
 * an authority value: the server always determines the real origin itself
 * (request.nextUrl.origin), regardless of what this displays.
 */
function displayOrigin(): string {
  if (typeof window === "undefined") return AUDIENCE;
  return window.location.origin;
}

export interface PassportConnectPanelProps {
  /** Called after a session exists, so the host can re-resolve identity. */
  onConnected?: () => void;
  /**
   * Which STORAGE WORLD this panel is mounted in (ruling A.7 — the Companion
   * is preferred, never exclusive; a mount outside it must exist or the
   * protocol depends on the extension, which the ruling forbids).
   *
   * 'companion' (default): the extension side-panel iframe — a PARTITIONED
   * world. After finalize, the panel opens /passport-connect/complete so the
   * TOP-LEVEL application world can redeem its own single-use grants (the
   * session token_hash and the persona activation are per-world, §A.10.2a).
   *
   * 'application': mounted directly on a top-level page
   * (app/passport-connect/page.tsx). The session and persona pin land in
   * THIS world already, so no handoff tab is opened, and the persona
   * activation is redeemed against the application-world marker.
   */
  world?: "companion" | "application";
  /** Audience bound into the wallet challenge. Defaults per world. */
  audience?: string;
}

export function PassportConnectPanel({
  onConnected,
  world = "companion",
  audience = world === "application" ? "metame-application" : AUDIENCE,
}: PassportConnectPanelProps) {
  const [state, setState] = useState<ConnectState>({ kind: "idle" });

  /**
   * One wallet-challenge-and-proof round trip. Shared by the first attempt
   * (no World ID yet) and the "present Passport" retry (ruling 1) — a
   * SEPARATE ceremony each time, since a challenge nonce is spent whether or
   * not the proof that follows succeeds
   * (services/passport/connectionChallenge.ts), so a retry can never reuse
   * the first attempt's signature.
   */
  const performProof = useCallback(
    async (address: string, worldIdProof?: WorldIdProofBundle) => {
      setState({ kind: "working", step: "Requesting a challenge…" });
      const chRes = await fetch("/api/passport-connect/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, walletAddress: address }),
      });
      const ch = await chRes.json().catch(() => null);
      if (!chRes.ok || !ch?.ok) {
        return { ok: false as const, message: "Could not start a connection. Please try again in a moment." };
      }

      const eth = provider();
      if (!eth) return { ok: false as const, message: "No wallet available." };

      setState({ kind: "working", step: "Approve in your wallet to continue…" });
      let signature: string;
      try {
        signature = (await eth.request({
          method: "personal_sign",
          params: [ch.message, address],
        })) as string;
      } catch {
        return { ok: "cancelled" as const };
      }

      setState({ kind: "working", step: worldIdProof ? "Verifying your Passport…" : "Verifying your wallet…" });
      const prRes = await fetch("/api/passport-connect/proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nonce: ch.nonce,
          message: ch.message,
          signature,
          audience,
          ...(worldIdProof ? { worldIdProof } : {}),
        }),
      });
      const pr = await prRes.json().catch(() => null);
      return { ok: true as const, status: prRes.status, body: pr };
    },
    [audience],
  );

  /** Dispatch on /proof's response. `link_required` is the NEW branch (ruling
   *  1) — this specific wallet has never been linked to anything, and the
   *  rescue path (a live World ID proof) is offered rather than a dead end.
   */
  const handleProofResponse = useCallback(
    (status: number, pr: Record<string, unknown> | null, address?: string) => {
      if (status === 403 && pr?.error === "link_required" && address) {
        setState({ kind: "link-passport", address });
        return;
      }
      if (status === 403 && pr?.error === "no_constitutional_access") {
        setState({ kind: "no-passport" }); // B
        return;
      }
      if (pr?.ok && pr?.stepUp) {
        // Step-up authorises an action; it never opens a session or chooses a
        // persona. Nothing further to render here today.
        setState({ kind: "connected", passport: pr.passport as PassportFacts });
        return;
      }
      if (!pr?.ok || typeof pr?.transactionToken !== "string" || !Array.isArray(pr?.personas)) {
        setState({
          kind: "error",
          message:
            pr?.error === "expired" || pr?.error === "already_consumed"
              ? "That approval expired. Please try connecting again."
              : "Connection failed. No session was created.",
        });
        return;
      }

      // ruling 2 — ALWAYS show the choice, even for exactly one persona. No
      // auto-submit branch belongs here; see this file's own header and
      // /finalize's for why.
      setState({
        kind: "choose-persona",
        transactionToken: pr.transactionToken,
        personas: pr.personas as PersonaChoice[],
        passport: pr.passport as PassportFacts,
      });
    },
    [],
  );

  /** Present a fresh World ID proof for `address` and retry the ceremony with it (ruling 1). */
  const linkWithWorldId = useCallback(
    async (address: string, worldIdProof: WorldIdProofBundle) => {
      const result = await performProof(address, worldIdProof);
      if (result.ok === "cancelled") {
        setState({ kind: "idle" });
        return;
      }
      if (!result.ok) {
        setState({ kind: "error", message: result.message });
        return;
      }
      handleProofResponse(result.status, result.body, address);
    },
    [performProof, handleProofResponse],
  );

  /**
   * The whole ceremony, from wallet selection through the pending-auth
   * transaction (ruling 2 stops session issuance here — persona choice is a
   * SEPARATE act, see `finalizeWithPersona` below).
   */
  const connect = useCallback(
    async (chosenAddress?: string) => {
      const eth = provider();
      if (!eth) {
        setState({ kind: "no-wallet" }); // A
        return;
      }

      try {
        setState({ kind: "working", step: "Waiting for your wallet…" });
        const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
        if (!Array.isArray(accounts) || accounts.length === 0) {
          setState({ kind: "no-wallet" }); // A — a wallet that grants nothing is no wallet here
          return;
        }

        // D — more than one account and none chosen yet. The Companion must
        // never silently pick when several constitutional personas could be
        // behind the choice. (Wallet ADDRESS chooser — ruling 3; the persona
        // chooser is a distinct, later state.)
        const address = chosenAddress ?? (accounts.length === 1 ? accounts[0] : null);
        if (!address) {
          setState({ kind: "choose-wallet", addresses: accounts });
          return;
        }

        const result = await performProof(address);
        if (result.ok === "cancelled") {
          // Cancellation is not an error condition — nothing was created.
          setState({ kind: "idle" });
          return;
        }
        if (!result.ok) {
          setState({ kind: "error", message: result.message });
          return;
        }
        handleProofResponse(result.status, result.body, address);
      } catch {
        setState({ kind: "error", message: "Connection failed. No session was created." });
      }
    },
    [performProof, handleProofResponse],
  );

  /** The citizen's explicit persona choice → /finalize → session. */
  const finalizeWithPersona = useCallback(
    async (transactionToken: string, choice: PersonaChoice) => {
      setState({ kind: "working", step: "Opening your session…" });
      const finRes = await fetch("/api/passport-connect/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionToken, personaPublicRef: choice.personaPublicRef }),
      });
      const fin = await finRes.json().catch(() => null);
      if (!finRes.ok || !fin?.ok || !fin?.tokenHash) {
        setState({
          kind: "error",
          message:
            fin?.error === "expired" || fin?.error === "already_consumed" || fin?.error === "cross_principal_ref"
              ? "That selection could not be completed. Please try connecting again."
              : "Connection failed. No session was created.",
        });
        return;
      }

      // Exchange for the Companion's OWN session (this iframe's storage
      // partition). Supabase owns single-use and expiry; we never hand-roll.
      const { error } = await getSupabaseBrowserClient().auth.verifyOtp({
        token_hash: fin.tokenHash,
        type: "magiclink",
      });
      if (error) {
        setState({ kind: "error", message: "Your Passport verified, but the session could not open." });
        return;
      }

      // THE ONE POST-SESSION SELF-VIEW READ (ruling 2 / MS-5): pin the
      // EXPLICITLY chosen persona ahead of getActivePersona's own fallback,
      // structurally — x-persona-id (personaFetch already attaches this from
      // localStorage.currentPersonaId) outranks the fallback in the spine's
      // own priority order, so setting it here BEFORE any other spine call
      // fires means the fallback never gets a chance to run for this
      // connection. Best-effort: a failure here is not fatal — it degrades
      // to the spine's own resolution on the very next sign-in, same as any
      // other account.
      try {
        const res = await personaFetch(
          `/api/passport-connect/resolved-persona?world=${world}&transactionToken=${encodeURIComponent(transactionToken)}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const body = await res.json();
          if (typeof body?.personaId === "string" && body.personaId) {
            window.localStorage.setItem("currentPersonaId", body.personaId);
            window.sessionStorage.setItem("currentPersonaId", body.personaId);
          }
        }
      } catch {
        // Non-fatal — see above.
      }

      // THE APPLICATION HANDOFF (the partition gap, operator 2026-07-26).
      // This iframe's session cannot reach the top-level app tabs — the
      // browser partitions third-party iframe storage — so the second
      // single-use grant is exchanged by a top-level page in the left-hand
      // browser, where the application actually lives. Without this, the
      // citizen connected here and still hit a sign-in wall over there.
      //
      // THE PERSONA MUST MAKE THE SAME CROSSING (operator, 2026-07-28:
      // "actions aren't working ... not getting right overlay"). The pin
      // written just above lands in THIS iframe's partition only, so the
      // top-level app had a valid session but no chosen persona and fell back
      // to "first owned persona, sorted" — then LATCHED it
      // (MetaMeRuntimeClient's own bootstrap persists its fallback). The
      // extension observer, which scrapes `currentPersonaId` off the
      // top-level tab, then reported "no-active-persona" and refused to pair,
      // which is why every Pull Across died with a red ✗.
      //
      // `transactionToken` rides along so the complete page can redeem the
      // SAME recorded choice for the top-level world. It is NOT a T0
      // identifier — it is an opaque, random, single-use handle carrying no
      // identity on its face, the same security class as the token_hash
      // beside it, and the complete page scrubs the whole query string before
      // it does anything. No raw personaId ever touches a URL.
      //
      // world === 'application' (ruling A.7 top-level mount): this panel is
      // ALREADY in the application's storage world — the session and pin
      // above landed exactly where the app reads them — so a handoff tab
      // would redeem a second grant for a world that already has one. Skip.
      if (world === "companion" && typeof fin.handoffTokenHash === "string" && fin.handoffTokenHash) {
        const handoffUrl = `/passport-connect/complete?token_hash=${encodeURIComponent(fin.handoffTokenHash)}&persona_tx=${encodeURIComponent(transactionToken)}&next=${encodeURIComponent("/metame/runtime")}`;

        // THE CROSSING MUST LAND IN THE RIGHT WINDOW (bug fix, 2026-08-01:
        // "Pull Across" kept dying with a red ✗ even after this handoff
        // reported "Connected", and Quick Links opening in a completely
        // different, non-incognito browser window traced to the exact same
        // mechanism). `world === "companion"` means this panel is mounted
        // inside the extension's side panel iframe (see this file's own
        // header), so a plain `window.open` here is a nested-iframe-under-a-
        // side-panel `window.open` — it does not reliably open in the SAME
        // window the side panel is docked to, which is exactly the window
        // `extension/companion-observer/background.js`'s
        // `chrome.tabs.query({ active: true, currentWindow: true })` looks
        // in when pairing (`connectToMetaMe`). A handoff tab that opened
        // elsewhere is invisible to that query, so pairing kept failing
        // silently downstream of a handoff that this panel had already
        // reported as successful. See
        // `services/companion/sidePanelTabBridge.ts` for the full trace and
        // the fix shared with Quick Links: ask the side panel (which IS
        // correctly bound to the right window) to open the tab via
        // `chrome.tabs.create` instead.
        //
        // The PRE-EXISTING popup-blocked detection (2026-07-31) is kept as
        // the fallback for whenever the bridge cannot answer (no parent, or
        // an older extension build without the `OPEN_TAB_REQUEST` handler) —
        // by the time this line runs, the original click has passed through
        // `fetch`/`await` at least three times (finalize → verifyOtp → the
        // resolved-persona read), long enough that several browsers no
        // longer treat a plain `window.open` as tied to the user's original
        // gesture and silently block it. A blocked popup returns `null` (or
        // an already-closed `Window`) with NO thrown error, so trusting
        // `connected` unconditionally here would be exactly the "No
        // Simulated Completion" defect CLAUDE.md forbids: claiming a
        // crossing that did not happen. Detect it and offer a manual,
        // one-click fallback (a real user gesture, so it is never blocked)
        // instead of a silent dead end.
        const handledByBridge = await openInSidePanelHostWindow(handoffUrl);
        let popup: Window | null = null;
        if (!handledByBridge) {
          try {
            popup = window.open(handoffUrl, "_blank", "noreferrer");
          } catch {
            popup = null;
          }
        }
        if (!handledByBridge && (!popup || popup.closed)) {
          setState({ kind: "connected", passport: fin.passport as PassportFacts, handoffUrl });
          onConnected?.();
          return;
        }
      }

      setState({ kind: "connected", passport: fin.passport as PassportFacts }); // E
      onConnected?.();
    },
    [onConnected, world],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-5 py-6 text-center">
      <div className="rounded-full border border-slate-800 bg-slate-900/40 p-3">
        <ShieldCheck className="h-6 w-6 text-emerald-400" aria-hidden="true" />
      </div>

      {state.kind === "idle" ? (
        <>
          <div className="text-sm font-medium text-slate-100">Connect with your Passport</div>
          <p className="max-w-[22rem] text-xs text-slate-400">
            Your Polity Passport is your access credential. Approve once in your wallet — there is
            no account to create and no password to remember.
          </p>
          {/* Consent copy (ruling 4) — names what is about to happen and where
              it is scoped, before the wallet prompt fires. This is DISPLAY
              only: the server always determines the real origin itself
              (request.nextUrl.origin), never from anything the client sends
              or shows. */}
          <p className="max-w-[22rem] text-[11px] text-slate-500">
            This approves a one-time signature proving you control your wallet, scoped to{" "}
            <span className="text-slate-400">{displayOrigin()}</span>. It does not transfer
            anything, and no Passport credential ever leaves your device — only the outcome
            (a session) does.
          </p>
          <button
            type="button"
            onClick={() => void connect()}
            className="mt-1 inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 shadow-lg transition-all hover:bg-slate-900/60"
          >
            <WalletIcon className="h-4 w-4" aria-hidden="true" />
            Connect
          </button>
        </>
      ) : null}

      {state.kind === "working" ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-slate-300" aria-hidden="true" />
          <div className="text-xs text-slate-300">{state.step}</div>
        </>
      ) : null}

      {/* A — no wallet available */}
      {state.kind === "no-wallet" ? (
        <>
          <div className="text-sm font-medium text-slate-100">Connect or restore your wallet to continue.</div>
          <p className="max-w-[22rem] text-xs text-slate-400">
            Your Passport lives in your wallet. Once it is available here, Connect will find it.
          </p>
          <button
            type="button"
            onClick={() => void connect()}
            className="mt-1 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 transition-all hover:bg-slate-900/60"
          >
            Try again
          </button>
        </>
      ) : null}

      {/* B — the proof held, but no constitutional principal resolved.

          THE SERVER DELIBERATELY WILL NOT SAY WHICH (proof/route.ts): naming
          "this wallet is unknown" vs "this wallet has no Passport" would let
          anyone map the lineage graph with wallets they do not own. That
          property is load-bearing and is NOT relaxed here.

          But the copy used to assert ONE of those causes — "No active Passport
          was found for this wallet" — when the server had said no such thing.
          For a citizen whose Passport is perfectly healthy and whose wallet
          simply was never bound as an alias (`wallet_unknown`, the most common
          real refusal), that message is actively false and dead-ends them: they
          go looking for a Passport problem they do not have. Naming BOTH
          possibilities and the act that satisfies each keeps the server's
          disclosure exactly where it was while telling the citizen something
          true and actionable. */}
      {state.kind === "no-passport" ? (
        <>
          <div className="text-sm font-medium text-slate-100">
            This wallet did not resolve to constitutional access.
          </div>
          <p className="max-w-[22rem] text-xs text-slate-400">
            Your signature was verified — the wallet is yours. What did not resolve is the link
            from it to an active Passport. Either this wallet is not yet linked to your
            personhood, or the Passport it reaches is not currently active.
          </p>
          <p className="max-w-[22rem] text-[11px] text-slate-500">
            If you hold a Passport, link this wallet to it from your wallet&apos;s identity
            settings, then connect again. A wallet connection on its own is never constitutional
            access.
          </p>
          <button
            type="button"
            onClick={() => void connect()}
            className="mt-1 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 transition-all hover:bg-slate-900/60"
          >
            Try another wallet
          </button>
        </>
      ) : null}

      {/* NEW — "present Passport" (ruling 1). This wallet has never been
          linked to anything. Rather than a dead end, a LIVE World ID proof is
          offered: it identifies a unique human independently of any wallet,
          and — combined with the wallet-control proof already produced — is
          sufficient to establish the binding without a prior session. This is
          gated to World ID specifically (not the weaker captcha grade)
          because minting a brand-new wallet↔personhood binding from zero is
          exactly the class of consequential act Amendment A's graded ladder
          reserves for strong proof (§A.6 level 3). */}
      {state.kind === "link-passport" ? (
        <>
          <div className="text-sm font-medium text-slate-100">Present your Passport to link this wallet</div>
          <p className="max-w-[22rem] text-xs text-slate-400">
            This wallet has never been connected before. Verifying with World ID proves your
            personhood independently of this wallet, so the platform can safely link the two
            without asking you to sign in first.
          </p>
          <WorldIdButton
            onProof={(bundle) => linkWithWorldId(state.address, bundle)}
            label="Verify with World ID"
          />
        </>
      ) : null}

      {/* D — several WALLET ADDRESSES; the citizen chooses. Never chosen for
          them, and never to be confused with persona selection below (ruling
          3 — these are two different questions with two different answers). */}
      {state.kind === "choose-wallet" ? (
        <>
          <div className="text-sm font-medium text-slate-100">Which wallet address should connect?</div>
          <p className="max-w-[22rem] text-xs text-slate-400">
            Your provider exposes more than one address. Choose the one holding the Passport you
            want to use — you will choose which persona to activate as a separate step next.
          </p>
          <div className="mt-1 flex w-full max-w-[22rem] flex-col gap-2">
            {state.addresses.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => void connect(a)}
                className="truncate rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-200 transition-colors hover:bg-slate-900/60"
              >
                {`${a.slice(0, 10)}…${a.slice(-8)}`}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {/* NEW — persona selection (ruling 2/5). ALWAYS rendered, even for a
          single candidate — the selecting click is the point, not a
          formality to skip when there's "only one obvious answer". */}
      {state.kind === "choose-persona" ? (
        <>
          <div className="text-sm font-medium text-slate-100">Which persona should be active?</div>
          <p className="max-w-[22rem] text-xs text-slate-400">
            Your Passport is verified
            {state.passport?.passportClass ? ` (class: ${state.passport.passportClass})` : ""}. Choose
            which persona this session activates.
          </p>
          {state.personas.length === 0 ? (
            <p className="max-w-[22rem] text-xs text-amber-300">
              No persona is registered on this account yet. Complete onboarding in the wallet, then
              connect again.
            </p>
          ) : (
            <div className="mt-1 flex w-full max-w-[22rem] flex-col gap-2">
              {state.personas.map((p) => (
                <button
                  key={p.personaPublicRef}
                  type="button"
                  onClick={() => void finalizeWithPersona(state.transactionToken, p)}
                  className="flex items-center gap-2 truncate rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-left text-xs text-slate-200 transition-colors hover:bg-slate-900/60"
                >
                  <UserCircle2 className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="truncate">{p.displayLabel}</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : null}

      {/* E — connected */}
      {state.kind === "connected" ? (
        <>
          <div className="text-sm font-medium text-emerald-300">Connected</div>
          <p className="max-w-[22rem] text-xs text-slate-400">
            Your Passport established this session.
            {state.passport?.passportClass ? ` Class: ${state.passport.passportClass}.` : ""}
          </p>
          {state.handoffUrl ? (
            <>
              <p className="max-w-[22rem] text-xs text-amber-300">
                Your browser blocked the automatic handoff to this site&apos;s tab, so it has not
                signed in yet.
              </p>
              <button
                type="button"
                onClick={() => {
                  const url = state.handoffUrl!;
                  // Same bridge-first, window.open-fallback shape as the
                  // automatic handoff above — a manual retry from inside the
                  // extension's side panel iframe is just as subject to the
                  // wrong-window defect `sidePanelTabBridge.ts` documents.
                  void openInSidePanelHostWindow(url).then((handled) => {
                    if (!handled) window.open(url, "_blank", "noreferrer");
                  });
                }}
                className="mt-1 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 transition-all hover:bg-slate-900/60"
              >
                Finish signing in on this site
              </button>
            </>
          ) : null}
          <p className="max-w-[22rem] text-[11px] text-slate-500">
            Agent Me delegation is separate from access — if it is not active yet, activate it from
            your wallet.
          </p>
        </>
      ) : null}

      {state.kind === "error" ? (
        <>
          <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <div className="max-w-[22rem] text-xs text-amber-300">{state.message}</div>
          <button
            type="button"
            onClick={() => setState({ kind: "idle" })}
            className="mt-1 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 transition-all hover:bg-slate-900/60"
          >
            Start again
          </button>
        </>
      ) : null}
    </div>
  );
}

export default PassportConnectPanel;
