/**
 * PassportConnectPanel — the Companion's Connect surface.
 *
 * PRD-PAG-001 **Amendment A** §A.7 + the operator's Connect state machine
 * (chartered 2026-07-26), extended by the first-connection closure (operator
 * ruling 2026-07-28, rulings 1–4), and REPAIRED by the metaMe-wallet-signing
 * ruling (operator, 2026-08-01) below.
 *
 * ── WHAT CONNECT MEANS HERE ────────────────────────────────────────────────
 *
 * This is Passport-NATIVE access: the citizen does not sign into anything
 * first. They prove control of the wallet holding their Passport, and a
 * session follows. There is no username, no password, and no account to
 * create — the internal principal is resolved behind the proof (§A.3.2).
 *
 * ── THE SIGNING-SURFACE REPAIR (operator ruling, 2026-08-01) ───────────────
 *
 * PRIOR REGRESSION: this file signed the wallet-control challenge through
 * `window.ethereum` (an injected browser-extension provider — MetaMask,
 * Phantom, etc. depending on what happened to be installed). That is
 * architecturally wrong. The canonical boundary is:
 *
 *   metaMe wallet        = the Passport's principal signing surface
 *   MetaMask / Phantom /
 *   WalletConnect        = OPTIONAL externally linked wallets — never the
 *                          Passport authentication surface
 *
 * This file now signs EXCLUSIVELY through the metaMe wallet's own local key
 * material (`services/wallet/keyService.signMessage`), unlocked via the same
 * `UnlockModal` + `sessionService` stack every other wallet surface uses.
 * `window.ethereum` / `window.solana` / WalletConnect are NEVER referenced
 * here — see `refuseInjectedProviderForPassportAuth` below for the
 * deterministic backstop, and `tests/passport-connect-no-injected-provider.test.ts`
 * for the canary that fails the build if either ever reappears.
 *
 * THE ANONYMOUS-FIRST ARCHITECTURE IS UNCHANGED: no Supabase session is
 * required before signing, and the client does not need to know the
 * authoritative persona before signing either. It only needs to select and
 * unlock a LOCALLY HELD metaMe wallet profile (`services/wallet/localWalletStore.ts`
 * — a browser-local, session-independent index of encrypted key material
 * created/imported on this device). The corrected order is:
 *
 *   resolve local wallet candidate → prove control (sign) → server recovers
 *   the address → server resolves the authenticated Passport/persona
 *
 *   NOT: resolve active persona → unlock its key
 *
 * `localStorage.currentPersonaId` is used ONLY to preselect/label the
 * last-used local profile (`getPreselectedLocalWalletProfile`) — it is never
 * authentication, authority, or a source of truth. Before login, a local
 * wallet profile is not an authenticated persona; the server's
 * recovered-address lookup (`/api/passport-connect/proof`) remains the sole
 * authority for who is signing in. The `/challenge` and `/proof` server
 * contract is UNCHANGED by this repair — `keyService.signMessage` produces
 * the same EIP-191 personal-sign signature format an injected provider's
 * `personal_sign` would have, so the server needs no changes at all.
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
 * ── WALLET PROFILE CHOOSER ≠ PERSONA CHOOSER ────────────────────────────────
 *
 * `select-wallet-profile` picks among LOCAL metaMe wallet profiles held on
 * this device — a device may hold several wallets, each possibly reaching a
 * different Passport. `choose-persona` is the SEPARATE, later step where the
 * citizen picks which of THEIR OWN personas becomes active for this session,
 * decided by the SERVER from the recovered address. Never conflate the two
 * states or their copy.
 *
 * ── RULING A.7: PREFERRED, NEVER EXCLUSIVE ─────────────────────────────────
 *
 * The Companion is the preferred connector, but the PROTOCOL must not depend
 * on it. Everything here talks to `/api/passport-connect/*` over plain HTTP.
 * Signing is pure local WebCrypto (`keyService`) with no `chrome.*`, no
 * extension bridge, and no injected-provider dependency — which, as a
 * side effect of this repair, makes the panel reachable from partitioned
 * mount points (like the extension side panel iframe) that an injected
 * provider could never reach in the first place. What IS still
 * partition-sensitive is the LOCAL WALLET PROFILE INDEX itself
 * (`localStorage`, per-origin/per-partition) — a wallet created in the
 * top-level app's storage world is not visible from inside a partitioned
 * iframe. That is a distinct, already-tracked gap ("Pair another metaMe
 * device", surfaced in the `no-local-wallet` state below), not a regression
 * this repair introduces.
 *
 * ── HOLDER CONTROL IS NOT OPTIONAL ─────────────────────────────────────────
 *
 * "A Passport is present in the wallet" is never sufficient — a readable
 * credential is not a bearer token. The citizen always performs a local
 * approval ceremony (unlocking the metaMe wallet and signing), and the
 * server always verifies a single-use, origin-bound challenge. What is
 * optional is separately enrolled 2FA; the cryptographic proof is not.
 *
 * ── PASSKEY-FIRST, PRIVATE-KEY-IS-RECOVERY-ONLY (operator ruling, 2026-08-01) ──
 *
 * PRIOR DEFECT: the only ENABLED action from the idle screen was "Connect",
 * which — for anyone whose device held no `localWalletStore` entry — routed
 * straight to a raw private-key import form. Private-key entry is an
 * emergency recovery mechanism; it must never be the normal sign-in path,
 * and unlocking an existing wallet must never be conflated with restoring
 * one from scratch.
 *
 * THE FIX REUSES AN ALREADY-BUILT, ALREADY-RATIFIED CAPABILITY rather than
 * inventing a new one: `services/passport/passkeyService.ts` +
 * `/api/passport/passkey/{auth,enrol}-{options,verify}` (PRD-PAG-001
 * Amendment A §A.6, "ratified 2026-07-27 — ratified - build") were fully
 * built server-side but had ZERO client caller anywhere in the app. That
 * ceremony resolves a WebAuthn assertion straight to a Passport principal and
 * mints a session — no wallet profile, no local index, no device-specific
 * storage lookup at all, since a synced passkey (iCloud Keychain, Google
 * Password Manager, Windows Hello) makes every device the citizen owns
 * "recognized" the moment the platform authenticator offers the credential.
 * This is the SAME two-step holder-control model the wallet path uses
 * (prove control → server resolves who you are), just with a different proof
 * primitive — never a second, parallel identity resolver.
 *
 * `connectWithPasskey` below is the ONLY new client logic this repair adds;
 * everything else (wallet-password unlock via `UnlockModal`/`sessionService`,
 * the local wallet profile index, the recovered-address proof route) is
 * UNCHANGED. The idle screen now offers, in order:
 *
 *   1. "Continue with passkey"       — connectWithPasskey() below
 *   2. "Unlock with wallet password" — the pre-existing `connect()` flow
 *
 * and only under an explicit "Using a new device?" disclosure does
 * `no-local-wallet` appear, where the raw private-key form is relabeled
 * "Advanced: import recovery key" and carries a security warning — it is no
 * longer reachable as anything resembling a default action.
 */

"use client";

import { useCallback, useState, type FormEvent } from "react";
import { ShieldCheck, Wallet as WalletIcon, Loader2, AlertTriangle, UserCircle2, KeyRound, Fingerprint } from "lucide-react";
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import type { AuthenticationResponseJSON } from "@simplewebauthn/browser";

import { getSupabaseBrowserClient } from "@/utils/supabaseBrowser";
import { personaFetch } from "@/utils/personaSpine";
import { WorldIdButton, type WorldIdProofBundle } from "@/components/passport/WorldIdButton";
import { openInSidePanelHostWindow } from "@/services/companion/sidePanelTabBridge";
import {
  listLocalWalletProfiles,
  getPreselectedLocalWalletProfile,
  touchLocalWalletProfile,
  saveLocalWalletProfile,
  type LocalWalletProfile,
} from "@/services/wallet/localWalletStore";
import { UnlockModal } from "@/app/components/wallet/UnlockModal";
import { getKeyForSigning, isWalletUnlocked } from "@/services/wallet/sessionService";
import { signMessage as signWithLocalKey, importEvmKeyPair, isValidPrivateKey, validatePassword } from "@/services/wallet/keyService";
import type { PersonaQube } from "@/types/persona";

/**
 * Deterministic refusal for any code path that tries to sign a Passport
 * challenge through an injected/external wallet provider. Nothing in this
 * file's normal control flow calls this — Passport auth signs exclusively
 * through the local metaMe wallet key material. It exists so a future
 * regression that reintroduces a `window.ethereum` / `window.solana` /
 * WalletConnect signing branch here fails loudly and immediately instead of
 * silently substituting an external wallet as the Passport authentication
 * surface.
 */
export const PASSPORT_AUTH_EXTERNAL_WALLET_NOT_PERMITTED = "PASSPORT_AUTH_EXTERNAL_WALLET_NOT_PERMITTED";

export function refuseInjectedProviderForPassportAuth(): never {
  throw new Error(PASSPORT_AUTH_EXTERNAL_WALLET_NOT_PERMITTED);
}

/**
 * The operator's state machine, extended 2026-07-28 (rulings 1–3) and
 * repaired 2026-08-01 (local metaMe wallet profiles replace the injected
 * provider chooser). `no-local-wallet` (A) is not an initial state — it is
 * only entered once we have LOOKED and found no local profile, so a citizen
 * with a metaMe wallet on this device never sees a "no wallet" prompt they
 * don't need.
 */
type ConnectState =
  | { kind: "idle" }
  | { kind: "no-local-wallet" } // A
  | { kind: "restore-wallet" } // A — first-party recovery, never an injected-provider fallback
  | { kind: "no-passport" } // B
  | { kind: "select-wallet-profile"; profiles: LocalWalletProfile[]; preselectedPersonaId: string | null } // D
  | { kind: "unlock-wallet-profile"; profile: LocalWalletProfile }
  | { kind: "link-passport"; profile: LocalWalletProfile } // NEW — "present Passport" (ruling 1)
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

/** The audience this surface authenticates for. Bound into the signed message. */
const AUDIENCE = "metame-companion";

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
  /**
   * True when this panel is mounted INSIDE a host that already supplies its
   * own full-viewport chrome (SmartWalletDrawer's persona menu, or a future
   * drawer-hosted sign-in view) — never for the standalone `/passport-connect`
   * page or the Companion's own iframe, both of which own the whole viewport
   * themselves and should keep the full-screen unlock treatment. Threaded
   * straight through to this panel's own `<UnlockModal>` mount so a wallet
   * unlock never pops a SECOND, viewport-covering overlay on top of the
   * host's (operator ruling, 2026-08-01: "nested modal inside modal" is the
   * anti-pattern this exists to close).
   */
  embedded?: boolean;
}

export function PassportConnectPanel({
  onConnected,
  world = "companion",
  audience = world === "application" ? "metame-application" : AUDIENCE,
  embedded = false,
}: PassportConnectPanelProps) {
  const [state, setState] = useState<ConnectState>({ kind: "idle" });

  /**
   * One wallet-challenge-and-proof round trip. Shared by the first attempt
   * (no World ID yet) and the "present Passport" retry (ruling 1) — a
   * SEPARATE ceremony each time, since a challenge nonce is spent whether or
   * not the proof that follows succeeds
   * (services/passport/connectionChallenge.ts), so a retry can never reuse
   * the first attempt's signature.
   *
   * `sign` is ALWAYS the local metaMe wallet signer
   * (`keyService.signMessage` over the unlocked profile's decrypted key) —
   * never an injected provider. See this file's header for the ruling.
   */
  const performProof = useCallback(
    async (profile: LocalWalletProfile, worldIdProof?: WorldIdProofBundle) => {
      setState({ kind: "working", step: "Requesting a challenge…" });
      const chRes = await fetch("/api/passport-connect/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, walletAddress: profile.address }),
      });
      const ch = await chRes.json().catch(() => null);
      if (!chRes.ok || !ch?.ok) {
        return { ok: false as const, message: "Could not start a connection. Please try again in a moment." };
      }

      const privateKeyHex = getKeyForSigning(profile.personaId);
      if (!privateKeyHex) {
        return { ok: false as const, message: "Your metaMe wallet locked again — please unlock and try once more." };
      }

      setState({ kind: "working", step: worldIdProof ? "Verifying your Passport…" : "Signing with your metaMe wallet…" });
      let signature: string;
      try {
        signature = await signWithLocalKey(ch.message, privateKeyHex);
      } catch {
        return { ok: false as const, message: "Signing failed. Please try again." };
      }

      touchLocalWalletProfile(profile.personaId);

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
    (status: number, pr: Record<string, unknown> | null, profile?: LocalWalletProfile) => {
      if (status === 403 && pr?.error === "link_required" && profile) {
        setState({ kind: "link-passport", profile });
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

  /** Present a fresh World ID proof for `profile` and retry the ceremony with it (ruling 1). */
  const linkWithWorldId = useCallback(
    async (profile: LocalWalletProfile, worldIdProof: WorldIdProofBundle) => {
      const result = await performProof(profile, worldIdProof);
      if (!result.ok) {
        setState({ kind: "error", message: result.message });
        return;
      }
      handleProofResponse(result.status, result.body, profile);
    },
    [performProof, handleProofResponse],
  );

  /** Begin the ceremony: look for local metaMe wallet profiles on this device. */
  const connect = useCallback(() => {
    const profiles = listLocalWalletProfiles();
    if (profiles.length === 0) {
      setState({ kind: "no-local-wallet" }); // A
      return;
    }
    const preselected = getPreselectedLocalWalletProfile();
    setState({ kind: "select-wallet-profile", profiles, preselectedPersonaId: preselected?.personaId ?? null });
  }, []);

  const runProofForProfile = useCallback(
    async (profile: LocalWalletProfile) => {
      const result = await performProof(profile);
      if (!result.ok) {
        setState({ kind: "error", message: result.message });
        return;
      }
      handleProofResponse(result.status, result.body, profile);
    },
    [performProof, handleProofResponse],
  );

  /** After choosing a profile: unlock it if needed, else sign immediately. */
  const selectProfile = useCallback(
    (profile: LocalWalletProfile) => {
      if (isWalletUnlocked(profile.personaId)) {
        void runProofForProfile(profile);
        return;
      }
      setState({ kind: "unlock-wallet-profile", profile });
    },
    [runProofForProfile],
  );

  /**
   * The shared tail of EVERY path that ends in a session: exchange the
   * single-use grant for this world's own session, best-effort pin the
   * explicitly-resolved persona (when one exists — the passkey path has none,
   * see below), then perform the Companion→application handoff. Factored out
   * of the wallet path's `finalizeWithPersona` (2026-08-01) so the passkey
   * path (`connectWithPasskey`) reuses it verbatim rather than a second,
   * parallel copy of the handoff dance — inv.engineering.036/037.
   *
   * `transactionToken` is `null` for the passkey ceremony: `/api/passport/
   * passkey/auth-verify` mints a session straight from the credential's own
   * resolved principal (see this file's header) with no persona-choice step
   * to pin — the resolved-persona read and the handoff URL's `persona_tx`
   * are both skipped, and the top-level app falls back to its own ordinary
   * active-persona resolution, exactly as `/passport-connect/complete`
   * already tolerates (`persona_tx` there is optional).
   */
  const completeSessionFromGrant = useCallback(
    async (
      grant: { tokenHash: string; handoffTokenHash?: string | null; passport: PassportFacts },
      transactionToken: string | null,
    ) => {
      // Exchange for the Companion's OWN session (this iframe's storage
      // partition). Supabase owns single-use and expiry; we never hand-roll.
      const { error } = await getSupabaseBrowserClient().auth.verifyOtp({
        token_hash: grant.tokenHash,
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
      if (transactionToken) {
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
      if (world === "companion" && typeof grant.handoffTokenHash === "string" && grant.handoffTokenHash) {
        // `persona_tx` is always present in the URL, but empty for the
        // passkey path (transactionToken null — no persona-choice step ran).
        // `/passport-connect/complete` already treats an empty persona_tx as
        // "nothing to redeem" (`if (personaTx)` is falsy for ""), so this
        // needs no change there — it degrades to the app's own ordinary
        // active-persona resolution, exactly as documented above.
        const handoffUrl = `/passport-connect/complete?token_hash=${encodeURIComponent(grant.handoffTokenHash)}&persona_tx=${encodeURIComponent(transactionToken ?? "")}&next=${encodeURIComponent("/metame/runtime")}`;

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
          setState({ kind: "connected", passport: grant.passport, handoffUrl });
          onConnected?.();
          return;
        }
      }

      setState({ kind: "connected", passport: grant.passport }); // E
      onConnected?.();
    },
    [onConnected, world],
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
      await completeSessionFromGrant(
        { tokenHash: fin.tokenHash, handoffTokenHash: fin.handoffTokenHash, passport: fin.passport as PassportFacts },
        transactionToken,
      );
    },
    [completeSessionFromGrant],
  );

  /**
   * "Continue with passkey" — the PRIMARY sign-in path (operator ruling,
   * 2026-08-01; see this file's header). Wires the already-built, already-
   * ratified `/api/passport/passkey/{auth-options,auth-verify}` ceremony:
   * request options → the platform authenticator's own native prompt
   * (Face ID/Touch ID/Windows Hello/security key — never a bespoke popup
   * this file draws) → verify → session. No wallet profile is looked up,
   * unlocked, or signed with; a passkey resolves straight to a Passport
   * principal server-side.
   */
  const connectWithPasskey = useCallback(async () => {
    if (!browserSupportsWebAuthn()) {
      setState({
        kind: "error",
        message: "Passkeys aren't available in this browser. Try unlocking with your wallet password instead.",
      });
      return;
    }
    setState({ kind: "working", step: "Requesting your passkey…" });
    try {
      const optRes = await fetch("/api/passport/passkey/auth-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience }),
      });
      const opt = await optRes.json().catch(() => null);
      if (!optRes.ok || !opt?.ok) {
        setState({ kind: "error", message: "Could not start passkey sign-in. Please try again in a moment." });
        return;
      }

      setState({ kind: "working", step: "Waiting for your passkey…" });
      let assertion: AuthenticationResponseJSON;
      try {
        assertion = await startAuthentication({ optionsJSON: opt.options });
      } catch (err) {
        // The user dismissed the platform authenticator prompt — a quiet
        // return to idle, never an error banner for a deliberate cancel.
        if ((err as Error)?.name === "NotAllowedError") {
          setState({ kind: "idle" });
          return;
        }
        setState({ kind: "error", message: "Passkey sign-in was not completed. Please try again." });
        return;
      }

      setState({ kind: "working", step: "Verifying your passkey…" });
      const verRes = await fetch("/api/passport/passkey/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, response: assertion }),
      });
      const ver = await verRes.json().catch(() => null);
      if (!verRes.ok || !ver?.ok || !ver?.tokenHash) {
        const message =
          ver?.error === "no_constitutional_access"
            ? "This passkey did not resolve to an active Passport."
            : ver?.error === "challenge_rejected"
              ? "That passkey attempt expired. Please try again."
              : "Passkey sign-in is unavailable right now. Try unlocking with your wallet password instead.";
        setState({ kind: "error", message });
        return;
      }

      await completeSessionFromGrant(
        { tokenHash: ver.tokenHash, handoffTokenHash: ver.handoffTokenHash, passport: ver.passport as PassportFacts },
        null,
      );
    } catch {
      setState({ kind: "error", message: "Passkey sign-in failed. Try unlocking with your wallet password instead." });
    }
  }, [audience, completeSessionFromGrant]);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-5 py-6 text-center">
      <div className="rounded-full border border-slate-800 bg-slate-900/40 p-3">
        <ShieldCheck className="h-6 w-6 text-emerald-400" aria-hidden="true" />
      </div>

      {state.kind === "idle" ? (
        <>
          <div className="text-sm font-medium text-slate-100">Connect with your Passport</div>
          <p className="max-w-[22rem] text-xs text-slate-400">
            Your Passport is held in your metaMe wallet. Unlock it to approve a one-time Passport
            proof — there is no account to create and no password to remember.
          </p>
          {/* Consent copy (ruling 4) — names what is about to happen and where
              it is scoped, before the wallet prompt fires. This is DISPLAY
              only: the server always determines the real origin itself
              (request.nextUrl.origin), never from anything the client sends
              or shows. */}
          <p className="max-w-[22rem] text-[11px] text-slate-500">
            This approves a one-time signature proving you control your metaMe wallet, scoped to{" "}
            <span className="text-slate-400">{displayOrigin()}</span>. It does not transfer
            anything, and no Passport credential ever leaves your device — only the outcome
            (a session) does.
          </p>
          {/* PASSKEY-FIRST (operator ruling, 2026-08-01 — see this file's
              header): the primary action never asks for a private key. Wallet
              password is the fallback for browsers/devices without a passkey,
              not a demotion of it — both unlock the SAME metaMe wallet
              signing surface for the recognized-device case. */}
          <div className="mt-1 flex w-full max-w-[22rem] flex-col gap-2">
            <button
              type="button"
              onClick={() => void connectWithPasskey()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 shadow-lg transition-all hover:bg-slate-900/60"
            >
              <Fingerprint className="h-4 w-4" aria-hidden="true" />
              Continue with passkey
            </button>
            <button
              type="button"
              onClick={connect}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/20 px-4 py-2 text-sm text-slate-300 transition-all hover:bg-slate-900/40"
            >
              <WalletIcon className="h-4 w-4" aria-hidden="true" />
              Unlock with wallet password
            </button>
          </div>
          {/* Recovery is a SEPARATE, exceptional journey — reachable, never
              defaulted into (see NoLocalWalletState below). */}
          <button
            type="button"
            onClick={() => setState({ kind: "no-local-wallet" })}
            className="mt-1 text-[11px] text-slate-500 underline decoration-slate-700 underline-offset-2 transition-colors hover:text-slate-400"
          >
            Using a new device? Restore or pair your metaMe wallet
          </button>
        </>
      ) : null}

      {state.kind === "working" ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-slate-300" aria-hidden="true" />
          <div className="text-xs text-slate-300">{state.step}</div>
        </>
      ) : null}

      {/* A — no local metaMe wallet on this device. First-party recovery
          ONLY — never a fallback to an injected external wallet. */}
      {state.kind === "no-local-wallet" ? (
        <NoLocalWalletState
          onPasskey={() => void connectWithPasskey()}
          onRestore={() => setState({ kind: "restore-wallet" })}
          onBack={() => setState({ kind: "idle" })}
        />
      ) : null}

      {state.kind === "restore-wallet" ? (
        <RestoreWalletForm
          onRestored={(profile) => {
            saveLocalWalletProfile(profile);
            selectProfile({ ...profile, createdAt: new Date().toISOString(), lastUsedAt: new Date().toISOString() });
          }}
          onCancel={() => setState({ kind: "no-local-wallet" })}
        />
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
            If you hold a Passport, link this wallet to it from your metaMe wallet&apos;s identity
            settings, then connect again. A wallet connection on its own is never constitutional
            access.
          </p>
          <button
            type="button"
            onClick={connect}
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
            onProof={(bundle) => linkWithWorldId(state.profile, bundle)}
            label="Verify with World ID"
          />
        </>
      ) : null}

      {/* D — several LOCAL metaMe wallet profiles; the citizen chooses. Never
          chosen for them, and never to be confused with persona selection
          below. Sourced from THIS DEVICE's local wallet index — never an
          injected provider's account list. */}
      {state.kind === "select-wallet-profile" ? (
        <>
          <div className="text-sm font-medium text-slate-100">Which metaMe wallet should connect?</div>
          <p className="max-w-[22rem] text-xs text-slate-400">
            Choose the metaMe wallet holding the Passport you want to use — you will choose which
            persona to activate as a separate step next.
          </p>
          <div className="mt-1 flex w-full max-w-[22rem] flex-col gap-2">
            {state.profiles.map((p) => (
              <button
                key={p.personaId}
                type="button"
                onClick={() => selectProfile(p)}
                className="flex items-center justify-between gap-2 truncate rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-left text-xs text-slate-200 transition-colors hover:bg-slate-900/60"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <WalletIcon className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="truncate">{p.displayLabel}</span>
                </span>
                {state.preselectedPersonaId === p.personaId ? (
                  <span className="flex-shrink-0 text-[10px] uppercase tracking-wide text-emerald-400">
                    Last used
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {state.kind === "unlock-wallet-profile" ? (
        <UnlockModal
          persona={{ id: state.profile.personaId, evmKey: { encryptedPrivateKey: state.profile.encryptedPrivateKey } } as PersonaQube}
          personaName={state.profile.displayLabel}
          onUnlockSuccess={() => void runProofForProfile(state.profile)}
          onCancel={() => setState({ kind: "idle" })}
          embedded={embedded}
        />
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

/**
 * A — this metaMe wallet is not available on this device (renamed from "No
 * metaMe wallet on this device yet" — 2026-08-01: that phrasing asserted the
 * wallet does not exist at all, when the true state is narrower and often
 * wrong outright, since a synced passkey makes ANY device "recognized"
 * regardless of this browser's local storage — see this file's header).
 *
 * Ordering matches the operator's ruling: a passkey retry first (the thing
 * that actually solves "new device" for anyone who enrolled one), then the
 * not-yet-built first-party recovery mechanisms as labeled, disabled
 * affordances (never a broken link — each needs its own design, tracked
 * separately, not improvised here), and ONLY THEN the raw private-key
 * import, demoted to "Advanced recovery" with an explicit warning — it must
 * never read as a normal, equally-weighted option among the others.
 *
 * "Create a new Passport" is described rather than linked: the wallet-
 * creation wizard (`PersonaSetupWizard`) is mounted inside the SmartWallet
 * drawer, not behind a verified standalone URL reachable from every context
 * this panel mounts in — CLAUDE.md forbids guessing one.
 */
function NoLocalWalletState({
  onPasskey,
  onRestore,
  onBack,
}: {
  onPasskey: () => void;
  onRestore: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <div className="text-sm font-medium text-slate-100">This metaMe wallet is not available on this device.</div>
      <p className="max-w-[22rem] text-xs text-slate-400">
        Your Passport lives in your metaMe wallet. If you enrolled a passkey, it may already work
        here — platform passkeys sync across your devices independently of this browser.
      </p>
      <div className="mt-1 flex w-full max-w-[22rem] flex-col gap-2">
        <button
          type="button"
          onClick={onPasskey}
          className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-left text-xs text-slate-200 transition-colors hover:bg-slate-900/60"
        >
          <Fingerprint className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
          Try passkey on this device
        </button>
        <button
          type="button"
          disabled
          title="Cross-device pairing is not yet available."
          className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-800/60 bg-slate-900/20 px-3 py-2 text-left text-xs text-slate-500"
        >
          <WalletIcon className="h-4 w-4 flex-shrink-0 text-slate-600" aria-hidden="true" />
          Pair another metaMe device — coming soon
        </button>
        <button
          type="button"
          disabled
          title="Encrypted backup restore is not yet available."
          className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-800/60 bg-slate-900/20 px-3 py-2 text-left text-xs text-slate-500"
        >
          <WalletIcon className="h-4 w-4 flex-shrink-0 text-slate-600" aria-hidden="true" />
          Restore encrypted backup — coming soon
        </button>
        <button
          type="button"
          disabled
          title="Recovery-contact restore is not yet available."
          className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-800/60 bg-slate-900/20 px-3 py-2 text-left text-xs text-slate-500"
        >
          <WalletIcon className="h-4 w-4 flex-shrink-0 text-slate-600" aria-hidden="true" />
          Use an approved recovery method — coming soon
        </button>
        {/* Advanced recovery — deliberately visually demoted (amber warning
            treatment, not the neutral slate every other option above uses)
            so it never reads as an ordinary, equally-weighted choice. */}
        <button
          type="button"
          onClick={onRestore}
          className="flex items-center gap-2 rounded-lg border border-amber-900/40 bg-amber-950/10 px-3 py-2 text-left text-xs text-amber-200/90 transition-colors hover:bg-amber-950/20"
        >
          <KeyRound className="h-4 w-4 flex-shrink-0 text-amber-400/80" aria-hidden="true" />
          Advanced: import recovery key
        </button>
      </div>
      <p className="max-w-[22rem] text-[11px] text-slate-500">
        Don&apos;t have a metaMe wallet yet? Create a new Passport from the SmartWallet drawer in
        the app, then come back here to connect.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mt-1 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 transition-all hover:bg-slate-900/60"
      >
        Back
      </button>
    </>
  );
}

/**
 * Advanced recovery: import a raw private key you already hold, encrypted
 * with a NEW local password, and saved as a local wallet profile on this
 * device (`localWalletStore.ts`). This never touches
 * `window.ethereum`/`window.solana` — it is pure local WebCrypto
 * (`keyService.importEvmKeyPair`), the same primitive persona creation uses.
 *
 * DELIBERATELY THE LAST RESORT (operator ruling, 2026-08-01 — see this
 * file's header): entering a private key is an emergency recovery mechanism,
 * never the normal sign-in path. This form is reachable ONLY through
 * `NoLocalWalletState`'s demoted "Advanced: import recovery key" action —
 * never from the idle screen directly — and carries an explicit warning
 * because pasting a private key into any form is inherently higher-risk than
 * every option above it.
 */
function RestoreWalletForm({
  onRestored,
  onCancel,
}: {
  onRestored: (profile: {
    personaId: string;
    address: string;
    displayLabel: string;
    encryptedPrivateKey: LocalWalletProfile["encryptedPrivateKey"];
  }) => void;
  onCancel: () => void;
}) {
  const [privateKey, setPrivateKey] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!isValidPrivateKey(privateKey)) {
        setError("That does not look like a valid private key (32 bytes, hex).");
        return;
      }
      const strength = validatePassword(password);
      if (!strength.valid) {
        setError(strength.errors[0]);
        return;
      }
      setBusy(true);
      try {
        const evmKey = await importEvmKeyPair(privateKey, password);
        onRestored({
          // Not a server-known persona UUID — this wallet has not yet
          // resolved to a persona. It is only a local, opaque handle for
          // sessionService's own key cache; the server's recovered-address
          // lookup decides the real persona once this wallet signs.
          personaId: `restored:${evmKey.address}`,
          address: evmKey.address,
          displayLabel: `Restored wallet (${evmKey.address.slice(0, 6)}…${evmKey.address.slice(-4)})`,
          encryptedPrivateKey: evmKey.encryptedPrivateKey,
        });
      } catch (err) {
        setError((err as Error).message || "Could not restore that key.");
      } finally {
        setBusy(false);
      }
    },
    [privateKey, password, onRestored],
  );

  return (
    <form onSubmit={submit} className="flex w-full max-w-[22rem] flex-col gap-2 text-left">
      <div className="text-sm font-medium text-slate-100">Advanced recovery</div>
      <div className="flex items-start gap-2 rounded-lg border border-amber-900/40 bg-amber-950/10 px-3 py-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-400/80" aria-hidden="true" />
        <p className="text-xs text-amber-200/90">
          Only use this if you already hold the private key for the wallet your Passport lives in.
          Anyone with this key can control that wallet — never paste it anywhere else, and prefer
          passkey or wallet-password unlock whenever either is available.
        </p>
      </div>
      <p className="text-xs text-slate-400">
        Enter the private key for the wallet holding your Passport, and set a password to encrypt
        it on this device.
      </p>
      {error ? <p className="text-xs text-amber-300">{error}</p> : null}
      <label className="text-[11px] uppercase tracking-wide text-slate-500">Private key</label>
      <input
        type="password"
        value={privateKey}
        onChange={(e) => setPrivateKey(e.target.value)}
        placeholder="0x…"
        className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-100"
        autoComplete="off"
      />
      <label className="text-[11px] uppercase tracking-wide text-slate-500">New local password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password to encrypt this wallet here"
        className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-100"
        autoComplete="new-password"
      />
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 transition-all hover:bg-slate-900/60 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !privateKey || !password}
          className="flex-1 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 transition-all hover:bg-slate-900/60 disabled:opacity-50"
        >
          {busy ? "Restoring…" : "Restore"}
        </button>
      </div>
    </form>
  );
}

export default PassportConnectPanel;
