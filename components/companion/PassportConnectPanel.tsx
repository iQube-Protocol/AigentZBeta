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
 *
 * ── SIGN-IN HIERARCHY REPAIR + PASSWORD-IDENTITY AUDIT (operator ruling, 2026-08-02) ──
 *
 * PRIOR DEFECT: wallet password had no visible field on the ordinary sign-in
 * surface at all — the only password-based path was the fully separate
 * `no-local-wallet` → "Advanced: import recovery key" screen, which reads as
 * recovery. "The current implementation still treats password as though it
 * belongs to recovery, which is the wrong hierarchy" (operator). The required
 * ordinary hierarchy, Recovery always last:
 *
 *   1. Continue with passkey
 *   2. Unlock with wallet password   (inline field — no username needed when
 *                                     exactly one local wallet profile is
 *                                     known on this device; §"WALLET PROFILE
 *                                     CHOOSER" above still governs the 2+
 *                                     profile case)
 *   3. Sign in with username and password   (`UsernamePasswordForm` below —
 *                                     the conventional Supabase account
 *                                     route, for citizens who prefer or
 *                                     require it)
 *   4. Recovery                      ("Using a new device?" → `no-local-wallet`)
 *
 * PASSWORD-IDENTITY AUDIT (required, not assumed): traced Passport wizard
 * Account step → persona creation → wallet encryption → Supabase
 * authentication → `UnlockModal` validation. Finding: **these are two
 * structurally independent, never-synced credentials today, not one.**
 *
 *   - The WALLET-ENCRYPTION password (`PersonaSetupWizard.tsx`'s "Secure Your
 *     Wallet" step) is collected client-side only, feeds
 *     `keyService.encryptPrivateKey` (PBKDF2 → AES-256-GCM, entirely local
 *     WebCrypto), and is verified thereafter ONLY by `keyService.verifyPassword`
 *     / `sessionService.unlockWallet` (which is what `UnlockModal` and the
 *     inline field below both call). It never leaves the browser and Supabase
 *     never sees it.
 *   - The SUPABASE ACCOUNT password (`useSupabaseSessionPersonas.ts`'s
 *     `signIn`/`signUp`) is a completely separate credential verified by
 *     Supabase Auth server-side. Nothing in that path calls `keyService` or
 *     `sessionService`, and nothing in the wallet path calls Supabase auth.
 *
 * They are NOT the same credential, are not required to match, and nothing
 * today keeps them in sync if a citizen sets them differently (which the
 * existing separate collection UIs make easy to do by accident). This file
 * does not attempt to silently unify them — that would require a migration
 * decision (which password wins? re-encrypt the wallet key under the other
 * one?) that belongs to the operator, not an inline guess. What it DOES do,
 * per the governing rule "one persona wallet, one user-established password,
 * multiple ways to locate and unlock it": treat the WALLET-ENCRYPTION
 * password as canonical for wallet access (every wallet-unlock surface —
 * `UnlockModal`, the inline field below, `RestoreWalletForm` — already
 * converges on `keyService`/`sessionService` and always has), and label the
 * Supabase path honestly as a separate "account" credential rather than
 * pretending it is the same secret. `Forgot password?` below therefore
 * recovers the SUPABASE credential only and is labeled "Recover account
 * access" — not "Recover wallet" — because Supabase's password reset has no
 * mechanism that can rewrap or recover `encryptedPrivateKey` (that key is
 * derived from the wallet password via PBKDF2 and exists nowhere in
 * plaintext, including on the server); resetting the Supabase password
 * changes nothing about the encrypted wallet blob.
 *
 * PASSKEY FAILURE DIAGNOSIS — ROOT CAUSE FOUND AND FIXED (2026-08-02).
 * `classifyPasskeyStartError` below replaces the old single generic retry
 * message. The reason the passkey path failed was never on THIS side: the
 * server-side enrolment ceremony (`/api/passport/passkey/enrol-{options,verify}`,
 * `services/passport/passkeyService.ts`, its credential table and migration)
 * was fully built and ratified with **zero client caller anywhere in the
 * app** — so no citizen had ever been able to REGISTER a passkey, and every
 * authentication attempt ran correctly against an authenticator holding no
 * credential for this relying party.
 *
 * `components/passport/PasskeyEnrolmentPanel.tsx` is that missing caller,
 * mounted on the connected-Passport wallet surface where a citizen is both
 * signed in and looking at their Passport. Enrol once there, and
 * "Continue with passkey" works from then on. Every `auth-options`/`startAuthentication`
 * attempt today therefore legitimately finds zero discoverable credentials on
 * the authenticator, which the WebAuthn spec surfaces as `NotAllowedError` —
 * the SAME error a deliberate user cancel produces (browsers deliberately
 * conflate the two for anti-enumeration privacy; confirmed by reading
 * `@simplewebauthn/browser`'s own `identifyAuthenticationError.js`, whose
 * comment reads "Platforms are overloading this error beyond what the spec
 * defines and we don't want to overwrite potentially useful error
 * messages"). This is an honest platform limit, not a bug this file can fix
 * client-side — `classifyPasskeyStartError` names it accurately
 * (`no-credential-or-cancelled`) and always offers the wallet-password
 * fallback rather than a dead end. Building the enrollment UI itself is a
 * separate, larger feature this repair does not include.
 *
 * ── ANONYMOUS-FIRST: NO EMAIL IN THE WALLET PATH (operator ruling, 2026-08-02) ──
 *
 * PRIOR DEFECT: the conventional fallback's identifier field was labelled and
 * typed as `EMAIL`, which excluded the citizens this platform exists for — a
 * Passport holder who deliberately created a persona and wallet without ever
 * supplying one. The governing rule:
 *
 *   the local wallet profile IDENTIFIES the wallet;
 *   the wallet password UNLOCKS it;
 *   an email is OPTIONAL recovery metadata and nothing else.
 *
 * So the recognized-device path below contains NO email field at all, and must
 * never acquire one. It is: select the local wallet (a selector appears only
 * when the device holds more than one — a password cannot say WHICH envelope
 * to decrypt) → wallet password → decrypt locally → sign the Passport
 * challenge → resolve the principal → session. Every label in it is
 * device-local: persona label and a shortened address, never an email.
 *
 * The conventional route's identifier is now "Persona or recovery email".
 *
 * ── WHAT THE CUSTODY AUDIT FOUND (and why persona sign-in is not offered) ──
 *
 * Full trace: `codexes/packs/agentiq/updates/2026-08-02_wallet-custody-and-password-identity-audit.md`.
 *
 * Classification **B — remote package exists, restoration incomplete**. The
 * encrypted envelope genuinely IS persisted beyond the device (Supabase
 * `personas.evm_key`, written by `POST /api/wallet/persona`; AES-256-GCM under
 * a PBKDF2-100k password-derived key; the password never reaches any server,
 * so the platform holds ciphertext it cannot decrypt). But NO route serialises
 * it back — every persona read uses an explicit column list that excludes
 * `evm_key`, and `GET /api/wallet/personas` selects it server-side yet emits
 * only `evmAddress`. There is no persona-handle lookup route of any kind. From
 * the client, the envelope is write-only.
 *
 * That gap is not merely unwired plumbing. An envelope fetch keyed on a
 * persona would be an offline brute-force oracle — the persona is a LOCATOR,
 * not a secret (it reaches local storage, logs, screenshots, support requests)
 * — which is the problem an augmented PAKE exists to solve, and an operator
 * custody decision rather than an inline one.
 *
 * Therefore a persona handle entered below gets an explicit "not built yet"
 * notice naming the paths that DO work — never the generic credential-mismatch
 * message. Generic is right for a real mismatch (it prevents enumeration);
 * using it here would disguise an unbuilt capability as the citizen's mistake
 * and loop them through something that cannot succeed.
 *
 * The password-identity finding is unchanged and now explained: the
 * wallet-encryption password and the Supabase account password are two
 * independent credentials, and that separation is load-bearing — the wallet
 * password's security property IS that no server receives it, which is exactly
 * what makes remote envelope storage safe. "One user-established password" is
 * reachable by DERIVING both from one typed secret client-side, never by
 * making them equal; that migration is scoped, not performed. Until it is, the
 * UI keeps saying they are separate, because they are.
 *
 * REMEMBERED ACCESS: `services/wallet/sessionService.ts`'s
 * `getWalletAccessState` models the five facts
 * (`sessionAuthenticated`/`walletAvailable`/`walletUnlocked`/
 * `walletSessionExpiresAt`/`lastStrongAuthenticationAt`) independently.
 * `recordStrongAuthentication()` is called ONLY at the moment a cryptographic
 * holder-control proof actually completes — the wallet-password proof
 * (inside `handleProofResponse`, shared by every path that reaches it) and a
 * successful passkey ceremony (`connectWithPasskey`) — never from
 * `UsernamePasswordForm`'s Supabase sign-in, which proves an account
 * credential, not wallet control. The plaintext wallet password is never
 * persisted anywhere in this file; only the resulting bounded
 * `sessionService` session (decrypted key in an in-memory `Map`, metadata in
 * `sessionStorage`) survives past the unlock call.
 */

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ShieldCheck, Wallet as WalletIcon, Loader2, AlertTriangle, UserCircle2, KeyRound, Fingerprint } from "lucide-react";
import { startAuthentication, browserSupportsWebAuthn, WebAuthnError } from "@simplewebauthn/browser";
import type { AuthenticationResponseJSON } from "@simplewebauthn/browser";

import { getSupabaseBrowserClient } from "@/utils/supabaseBrowser";
import { personaFetch } from "@/utils/personaSpine";
import { WorldIdButton, type WorldIdProofBundle } from "@/components/passport/WorldIdButton";
import { openInSidePanelHostWindow } from "@/services/companion/sidePanelTabBridge";
import { logRuntimeEvent } from "@/utils/runtimeSessionDiagnostics";
import {
  listLocalWalletProfiles,
  getPreselectedLocalWalletProfile,
  touchLocalWalletProfile,
  saveLocalWalletProfile,
  type LocalWalletProfile,
} from "@/services/wallet/localWalletStore";
import { UnlockModal } from "@/app/components/wallet/UnlockModal";
import { getKeyForSigning, isWalletUnlocked, unlockWallet, recordStrongAuthentication } from "@/services/wallet/sessionService";
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
  | { kind: "username-password"; initialMode?: "signin" | "forgot" } // conventional Supabase account fallback
  | { kind: "select-wallet-profile"; profiles: LocalWalletProfile[]; preselectedPersonaId: string | null } // D
  | { kind: "unlock-wallet-profile"; profile: LocalWalletProfile }
  | { kind: "link-passport"; profile: LocalWalletProfile } // NEW — "present Passport" (ruling 1)
  | { kind: "choose-persona"; transactionToken: string; personas: PersonaChoice[]; passport: PassportFacts } // NEW (ruling 2)
  | {
      kind: "connected";
      passport: PassportFacts;
      handoffUrl?: string;
      /** Set only when the sequential handoff-grant request itself failed
       *  (P0.2, 2026-08-21) — the Companion session is still valid; calling
       *  this re-attempts requesting a fresh handoff grant and opening it. */
      handoffRetry?: () => void;
    } // E
  | { kind: "working"; step: string }
  | { kind: "error"; message: string };

/** Exported (2026-08-02) so a host — e.g. SmartWalletDrawer's PASSPORT_CONNECTED
 *  surface — can render the real connected facts `onConnected` now carries,
 *  never a guessed or fabricated summary. */
export interface PassportFacts {
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

/**
 * Classifies a `startAuthentication()` failure using `@simplewebauthn/browser`'s
 * own `WebAuthnError`/`WebAuthnErrorCode` (publicly exported from the
 * package) rather than hand-matching raw `DOMException.name` strings. See
 * this file's header (2026-08-02 section) for the full trace: the WebAuthn
 * spec itself makes "no passkey enrolled" and "user declined the prompt"
 * genuinely indistinguishable — both collapse into `NotAllowedError` /
 * `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY` on purpose, so a page cannot probe
 * who has a credential enrolled. This function names that ambiguity
 * honestly (`no-credential-or-cancelled`) instead of pretending to resolve
 * it, and every branch ends in the same required, specific fallback rather
 * than a generic "please try again".
 */
type PasskeyFailureReason =
  | "ceremony-aborted"
  | "rp-id-mismatch"
  | "authenticator-error"
  | "no-credential-or-cancelled"
  | "unclassified";

function classifyPasskeyStartError(err: unknown): { reason: PasskeyFailureReason; message: string } {
  if (err instanceof WebAuthnError) {
    switch (err.code) {
      case "ERROR_CEREMONY_ABORTED":
        return { reason: "ceremony-aborted", message: "Passkey sign-in was interrupted. Please try again." };
      case "ERROR_INVALID_DOMAIN":
      case "ERROR_INVALID_RP_ID":
        // The site's own RP ID/origin configuration does not match what the
        // browser expects — a deployment defect, not something retrying
        // fixes. Never claim this is the citizen's fault.
        return {
          reason: "rp-id-mismatch",
          message: "Passkey sign-in isn't configured correctly for this address. Use your wallet password instead.",
        };
      case "ERROR_AUTHENTICATOR_GENERAL_ERROR":
        return {
          reason: "authenticator-error",
          message: "Your device could not complete the passkey prompt. Use your wallet password instead.",
        };
      case "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY":
      default:
        return {
          reason: "no-credential-or-cancelled",
          message: "No passkey is available here. Use your wallet password instead.",
        };
    }
  }
  return {
    reason: "unclassified",
    message: "Passkey sign-in was not completed. Use your wallet password instead.",
  };
}

export interface PassportConnectPanelProps {
  /**
   * Called after a session exists, so the host can re-resolve identity.
   * Carries the same `PassportFacts` this panel already displays in its own
   * "Connected" state (2026-08-02 addition) — never a second, independently
   * fetched summary; a host that wants to show "Citizen Passport" details
   * (e.g. SmartWalletDrawer's PASSPORT_CONNECTED surface) reads them from
   * here rather than re-deriving them.
   */
  onConnected?: (passport?: PassportFacts) => void;
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
   * Local wallet profiles known on THIS device, read once on mount, so the
   * idle screen can decide which shape the wallet-password affordance takes:
   * an inline field (exactly one profile — no username needed, per the
   * required hierarchy), the existing multi-profile picker (2+), or nothing
   * at all (0 — "Using a new device?" is the correct path there).
   */
  const [knownProfiles, setKnownProfiles] = useState<LocalWalletProfile[]>([]);
  useEffect(() => {
    setKnownProfiles(listLocalWalletProfiles());
  }, []);

  const [walletPasswordValue, setWalletPasswordValue] = useState("");
  const [walletPasswordBusy, setWalletPasswordBusy] = useState(false);
  const [walletPasswordError, setWalletPasswordError] = useState<string | null>(null);
  /**
   * Which local wallet the password will be tried against. A password alone
   * cannot tell the application WHICH encrypted envelope to decrypt, so when
   * a device holds several the citizen picks one first — by persona label or
   * shortened address. That selector is anonymous by construction: it names
   * only device-local labels, never an email (operator ruling, 2026-08-02).
   */
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const selectedProfile =
    knownProfiles.find((p) => p.personaId === selectedProfileId) ?? knownProfiles[0] ?? null;

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
        // A verified wallet signature just proved holder control — record it
        // independently of the session it grants (sessionService.ts's WALLET
        // ACCESS STATE section).
        recordStrongAuthentication();
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

      // The wallet signature that produced this response just proved holder
      // control of the metaMe wallet — record it here (the one place every
      // successful wallet-password proof passes through) independently of
      // the persona choice/session that follows.
      recordStrongAuthentication();

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
   * The inline "Wallet password" field on the ordinary sign-in surface
   * (required hierarchy, this file's header). Same password the citizen
   * established in `PersonaSetupWizard`'s "Secure Your Wallet" step, verified
   * by the SAME `sessionService.unlockWallet` every other wallet-unlock
   * surface (`UnlockModal`, the wallet-profile picker above) already calls —
   * no second password, no parallel verification path. A wrong password
   * stays on the idle screen with an inline error; it never falls through to
   * the panel's generic error state.
   */
  const unlockSingleKnownProfile = useCallback(
    async (profile: LocalWalletProfile, password: string) => {
      setWalletPasswordError(null);
      setWalletPasswordBusy(true);
      try {
        const result = await unlockWallet(profile.personaId, profile.encryptedPrivateKey, password);
        if (!result.success) {
          setWalletPasswordError("That password did not unlock this wallet.");
          return;
        }
        touchLocalWalletProfile(profile.personaId);
        setWalletPasswordValue("");
        await runProofForProfile(profile);
      } finally {
        setWalletPasswordBusy(false);
      }
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
      grant: { tokenHash: string; passport: PassportFacts },
      transactionToken: string | null,
    ) => {
      logRuntimeEvent("PassportConnectPanel:completeSessionFromGrant:start", { world, hasTransactionToken: Boolean(transactionToken) });
      // Exchange for the Companion's OWN session (this iframe's storage
      // partition). Supabase owns single-use and expiry; we never hand-roll.
      //
      // type: "email" — NOT "magiclink". Supabase Auth's /verify endpoint
      // resolves a `generateLink({ type: 'magiclink' })` token_hash under
      // the unified 'email' OTP type; 'magiclink' is a generateLink()-only
      // type and is rejected here. Confirmed against Supabase's current
      // passwordless-email-login docs (the canonical /auth/confirm example
      // uses type: 'email' for exactly this token_hash exchange).
      const { error } = await getSupabaseBrowserClient().auth.verifyOtp({
        token_hash: grant.tokenHash,
        type: "email",
      });
      if (error) {
        // Safe diagnostic: status/code/name only — never the token_hash.
        console.warn("[PassportConnect] companion session exchange failed:", {
          status: error.status,
          code: error.code,
          name: error.name,
        });
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
      //
      // SEQUENTIAL, NOT SIMULTANEOUS (P0.2, 2026-08-21). The handoff grant
      // used to arrive pre-minted alongside `tokenHash` — the exact defect
      // that made `tokenHash` dead on arrival (see passportSession.ts's
      // header). It is now requested HERE, after the line above has already
      // proven a real Companion session exists, from the authenticated
      // /handoff-grant endpoint. A failure to mint it must never invalidate
      // the Companion session already established: the citizen stays
      // "connected" here with a retry affordance instead of an error state.
      if (world === "companion") {
        const attemptHandoff = async (): Promise<void> => {
          // POSITIVE CONFIRMATION the Companion session is real (operator
          // requirement) — a network call to Supabase, not a local-storage
          // read, so a session that verifyOtp reported as established but
          // that never actually persisted cannot silently skip straight to
          // requesting a second grant.
          const { data: userData, error: userErr } = await getSupabaseBrowserClient().auth.getUser();
          const { data: sessionData } = await getSupabaseBrowserClient().auth.getSession();
          const accessToken = sessionData.session?.access_token;
          if (userErr || !userData?.user || !accessToken) {
            setState({
              kind: "connected",
              passport: grant.passport,
              handoffRetry: () => void attemptHandoff(),
            });
            onConnected?.(grant.passport);
            return;
          }

          let handoffTokenHash: string | null = null;
          try {
            const res = await fetch("/api/passport-connect/handoff-grant", {
              method: "POST",
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const body = await res.json().catch(() => null);
            handoffTokenHash = res.ok && body?.ok && typeof body?.tokenHash === "string" ? body.tokenHash : null;
          } catch {
            handoffTokenHash = null;
          }
          if (!handoffTokenHash) {
            // The Companion session is unaffected — never treat a handoff
            // failure as invalidating the successful Passport authentication.
            setState({
              kind: "connected",
              passport: grant.passport,
              handoffRetry: () => void attemptHandoff(),
            });
            onConnected?.(grant.passport);
            return;
          }

          // `persona_tx` is always present in the URL, but empty for the
          // passkey path (transactionToken null — no persona-choice step ran).
          // `/passport-connect/complete` already treats an empty persona_tx as
          // "nothing to redeem" (`if (personaTx)` is falsy for ""), so this
          // needs no change there — it degrades to the app's own ordinary
          // active-persona resolution, exactly as documented above.
          const handoffUrl = `/passport-connect/complete?token_hash=${encodeURIComponent(handoffTokenHash)}&persona_tx=${encodeURIComponent(transactionToken ?? "")}&next=${encodeURIComponent("/metame/runtime")}`;

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
          // `fetch`/`await` at least three times (finalize/auth-verify →
          // verifyOtp → the handoff-grant request), long enough that several
          // browsers no longer treat a plain `window.open` as tied to the
          // user's original gesture and silently block it. A blocked popup
          // returns `null` (or an already-closed `Window`) with NO thrown
          // error, so trusting `connected` unconditionally here would be
          // exactly the "No Simulated Completion" defect CLAUDE.md forbids:
          // claiming a crossing that did not happen. Detect it and offer a
          // manual, one-click fallback (a real user gesture, so it is never
          // blocked) instead of a silent dead end.
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
            onConnected?.(grant.passport);
            return;
          }

          setState({ kind: "connected", passport: grant.passport });
          onConnected?.(grant.passport);
        };

        await attemptHandoff();
        return;
      }

      setState({ kind: "connected", passport: grant.passport }); // E
      onConnected?.(grant.passport);
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
        { tokenHash: fin.tokenHash, passport: fin.passport as PassportFacts },
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
        message: "Passkeys aren't supported in this browser. Use your wallet password instead.",
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
        // The server itself could not issue a challenge (infra, not the
        // citizen's device) — see beginPasskeyAuthentication's own failure
        // mode ('unavailable'), distinct from every ceremony-side failure
        // classified below.
        setState({
          kind: "error",
          message: "Passkey sign-in is unavailable right now. Use your wallet password instead.",
        });
        return;
      }

      setState({ kind: "working", step: "Waiting for your passkey…" });
      let assertion: AuthenticationResponseJSON;
      try {
        assertion = await startAuthentication({ optionsJSON: opt.options });
      } catch (err) {
        setState({ kind: "error", message: classifyPasskeyStartError(err).message });
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
        // Mirrors /api/passport/passkey/auth-verify's own disclosed reasons
        // exactly (see that route's header): 'challenge_rejected' describes
        // the caller's own expired/spent request; 'unavailable' is server
        // infra; everything else (credential_unknown / verification_failed /
        // no_constitutional_access) is deliberately collapsed server-side so
        // this file cannot un-collapse it either — see this file's header
        // note on probing.
        const message =
          ver?.error === "challenge_rejected"
            ? "That passkey attempt expired. Please try again."
            : ver?.error === "unavailable"
              ? "Passkey sign-in is unavailable right now. Use your wallet password instead."
              : "This passkey did not resolve to an active Passport. Use your wallet password instead.";
        setState({ kind: "error", message });
        return;
      }

      // A passkey assertion IS a cryptographic holder-control proof —
      // record it independently of the session it opens (see
      // sessionService.ts's WALLET ACCESS STATE section). This never implies
      // walletUnlocked: no wallet profile was looked up or decrypted here.
      recordStrongAuthentication();

      await completeSessionFromGrant(
        { tokenHash: ver.tokenHash, passport: ver.passport as PassportFacts },
        null,
      );
    } catch {
      setState({ kind: "error", message: "Passkey sign-in failed. Use your wallet password instead." });
    }
  }, [audience, completeSessionFromGrant]);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-5 py-6 text-center">
      <div className="rounded-full border border-slate-800 bg-slate-900/40 p-3">
        <ShieldCheck className="h-6 w-6 text-emerald-400" aria-hidden="true" />
      </div>

      {state.kind === "idle" ? (
        <>
          <div className="text-sm font-medium text-slate-100">Sign in with your Passport</div>
          <p className="max-w-[22rem] text-xs text-slate-400">
            Your Passport is held in your metaMe wallet. Continue with a passkey, or unlock with
            the wallet password you set when you created it.
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
          {/* REQUIRED ORDINARY SIGN-IN HIERARCHY (operator ruling, 2026-08-02
              — see this file's header): passkey, then wallet password, then
              the conventional account fallback. Recovery is intentionally
              NOT in this block — it is the separate, exceptional affordance
              below. */}
          <div className="mt-1 flex w-full max-w-[22rem] flex-col gap-2">
            <button
              type="button"
              onClick={() => void connectWithPasskey()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 shadow-lg transition-all hover:bg-slate-900/60"
            >
              <Fingerprint className="h-4 w-4" aria-hidden="true" />
              Continue with passkey
            </button>

            {/* RECOGNIZED DEVICE — wallet selector (only when there is a
                choice to make) + wallet password. THERE IS NO EMAIL FIELD
                ANYWHERE IN THIS BLOCK, and there must never be one: the local
                wallet profile identifies the wallet, the password unlocks it.
                An anonymous citizen who never supplied an email signs in
                entirely through this path (operator ruling, 2026-08-02).
                Zero local profiles hides the block — a password cannot locate
                a wallet that is not on this device; "Using a new device?" is
                the honest path there. */}
            {selectedProfile ? (
              <form
                className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/20 p-3 text-left"
                onSubmit={(e) => {
                  e.preventDefault();
                  void unlockSingleKnownProfile(selectedProfile, walletPasswordValue);
                }}
              >
                {knownProfiles.length > 1 ? (
                  <>
                    <label htmlFor="metame-wallet-select" className="text-[11px] uppercase tracking-wide text-slate-500">
                      Wallet
                    </label>
                    <select
                      id="metame-wallet-select"
                      value={selectedProfile.personaId}
                      onChange={(e) => {
                        setSelectedProfileId(e.target.value);
                        setWalletPasswordError(null);
                      }}
                      className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-100"
                    >
                      {knownProfiles.map((p) => (
                        <option key={p.personaId} value={p.personaId}>
                          {p.displayLabel} — {p.address.slice(0, 6)}…{p.address.slice(-4)}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <WalletIcon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span className="truncate text-slate-400">
                      {selectedProfile.displayLabel} — {selectedProfile.address.slice(0, 6)}…
                      {selectedProfile.address.slice(-4)}
                    </span>
                  </div>
                )}
                <label htmlFor="metame-wallet-password" className="text-[11px] uppercase tracking-wide text-slate-500">
                  Wallet password
                </label>
                <input
                  id="metame-wallet-password"
                  type="password"
                  value={walletPasswordValue}
                  onChange={(e) => {
                    setWalletPasswordValue(e.target.value);
                    if (walletPasswordError) setWalletPasswordError(null);
                  }}
                  autoComplete="current-password"
                  className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-100"
                />
                {walletPasswordError ? <p className="text-[11px] text-amber-300">{walletPasswordError}</p> : null}
                <button
                  type="submit"
                  disabled={walletPasswordBusy || !walletPasswordValue}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 transition-all hover:bg-slate-900/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <WalletIcon className="h-4 w-4" aria-hidden="true" />
                  {walletPasswordBusy ? "Unlocking…" : "Unlock and continue"}
                </button>
              </form>
            ) : null}

            <button
              type="button"
              onClick={() => setState({ kind: "username-password" })}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/20 px-4 py-2 text-sm text-slate-300 transition-all hover:bg-slate-900/40"
            >
              <UserCircle2 className="h-4 w-4" aria-hidden="true" />
              Use username and password
            </button>
            <button
              type="button"
              onClick={() => setState({ kind: "username-password", initialMode: "forgot" })}
              className="text-[11px] text-slate-500 underline decoration-slate-700 underline-offset-2 transition-colors hover:text-slate-400"
            >
              Forgot wallet password?
            </button>
          </div>
          {/* Recovery is a SEPARATE, exceptional journey — always last,
              reachable, never defaulted into (see NoLocalWalletState below). */}
          <div className="mt-1 flex flex-col items-center gap-1">
            <div className="text-[11px] text-slate-500">Using a new device?</div>
            <button
              type="button"
              onClick={() => setState({ kind: "no-local-wallet" })}
              className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-[11px] text-slate-400 transition-colors hover:bg-slate-900/60 hover:text-slate-300"
            >
              Recovery options
            </button>
          </div>
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

      {/* Conventional account fallback (required hierarchy, 2026-08-02):
          Supabase email/password sign-in, and — via `initialMode: "forgot"`
          — the honest "Recover account access" flow. This is a genuinely
          SEPARATE credential from the wallet password (see this file's
          header password-identity audit); it establishes an application
          session but never implies `walletUnlocked`. */}
      {state.kind === "username-password" ? (
        <UsernamePasswordForm
          initialMode={state.initialMode}
          onCancel={() => setState({ kind: "idle" })}
          onSignedIn={() => {
            const emptyFacts: PassportFacts = {
              passportClass: null,
              citizenStatus: null,
              participantStatus: null,
              passportGrade: null,
              expiresAt: null,
            };
            setState({ kind: "connected", passport: emptyFacts });
            logRuntimeEvent("PassportConnectPanel:onConnected", { source: "username-password" });
            onConnected?.(emptyFacts);
          }}
        />
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
          {state.handoffRetry ? (
            <>
              <p className="max-w-[22rem] text-xs text-amber-300">
                This site hasn&apos;t signed in yet — your Passport session here is still valid.
              </p>
              <button
                type="button"
                onClick={() => state.handoffRetry?.()}
                className="mt-1 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 transition-all hover:bg-slate-900/60"
              >
                Retry finishing sign-in
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

/**
 * The conventional account route (required hierarchy, 2026-08-02 — see this
 * file's header). Plain Supabase email/password sign-in via the SAME client
 * `useSupabaseSessionPersonas.ts` uses (`getSupabaseBrowserClient()`) — no
 * parallel Supabase wrapper. This form never touches `keyService` or
 * `sessionService`: signing in here proves an ACCOUNT credential, never
 * wallet control, so it must never imply `walletUnlocked`.
 *
 * `initialMode="forgot"` lets the idle screen's "Forgot password?" shortcut
 * land directly on the recovery sub-view without first showing the sign-in
 * fields — this form is where the email address is actually collected, since
 * the panel itself is pre-session and has no email to offer beforehand.
 *
 * The recovery flow is explicitly labeled "Recover account access", never
 * "Recover wallet" (operator ruling): Supabase's `resetPasswordForEmail` /
 * `auth.updateUser` can only ever change the Supabase account password. It
 * has no path to rewrap or recover `encryptedPrivateKey` — that blob is
 * derived from the wallet password via local PBKDF2 and exists nowhere in
 * plaintext, including server-side — so resetting this credential changes
 * nothing about wallet access. See `app/auth/reset-password/page.tsx` for
 * the completion leg of this flow.
 */
function UsernamePasswordForm({
  initialMode = "signin",
  onSignedIn,
  onCancel,
}: {
  initialMode?: "signin" | "forgot";
  onSignedIn: () => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"signin" | "forgot" | "forgot-sent">(initialMode);
  /** "Persona or recovery email" — NEVER labelled just "email" (ruling). */
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [personaRouteUnavailable, setPersonaRouteUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);

  const looksLikeEmail = identifier.includes("@");

  const submitSignIn = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setPersonaRouteUnavailable(false);

      // PERSONA-HANDLE SIGN-IN IS NOT BUILT (custody audit, 2026-08-02 —
      // codexes/packs/agentiq/updates/2026-08-02_wallet-custody-and-password-identity-audit.md).
      // Its whole purpose is pseudonymous CROSS-DEVICE restoration, and the
      // audit found classification B: the encrypted envelope really is stored
      // server-side (personas.evm_key), but NO route serialises it back to a
      // client and no persona-handle lookup exists at all. Restoration is
      // therefore not merely unwired — the retrieval half needs a custody
      // design (an unauthenticated envelope fetch keyed on a guessable
      // persona would be an offline brute-force oracle), which is an operator
      // decision, not an inline one.
      //
      // So this says so plainly rather than returning the generic
      // "could not complete sign-in". That generic message is correct for a
      // real credential mismatch — where it prevents enumeration — but using
      // it HERE would disguise an unbuilt capability as the citizen's error
      // and send them round a loop that cannot succeed. That is exactly the
      // faked flow the ruling forbids.
      if (!looksLikeEmail) {
        setPersonaRouteUnavailable(true);
        return;
      }

      setBusy(true);
      try {
        const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({
          email: identifier,
          password,
        });
        if (signInError) {
          // Generic by design — never disclose whether the account exists.
          setError("We could not complete sign-in with those details.");
          return;
        }
        onSignedIn();
      } finally {
        setBusy(false);
      }
    },
    [identifier, looksLikeEmail, password, onSignedIn],
  );

  const submitForgotPassword = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!looksLikeEmail) {
        // Recovery is an EMAIL channel. A persona handle cannot receive one,
        // and a wallet with no recovery email has no email recovery at all —
        // say that instead of implying a message is on its way.
        setError(
          "Password recovery needs a recovery email that was previously added to this persona. " +
            "Without one, use your passkey or unlock the wallet on a device that already holds it.",
        );
        return;
      }
      setBusy(true);
      try {
        const { error: resetError } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(identifier, {
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/auth/reset-password` : undefined,
        });
        if (resetError) {
          setError("We could not start recovery with those details.");
          return;
        }
        setMode("forgot-sent");
      } finally {
        setBusy(false);
      }
    },
    [identifier, looksLikeEmail],
  );

  if (mode === "forgot-sent") {
    return (
      <div className="flex w-full max-w-[22rem] flex-col gap-2 text-left">
        <div className="text-sm font-medium text-slate-100">Check your email</div>
        {/* Deliberately conditional-free and non-committal: saying "if an
            account exists" discloses nothing either way (no enumeration). */}
        <p className="text-xs text-slate-400">
          If an account exists for {identifier}, a link to recover account access is on its way.
        </p>
        <p className="text-[11px] text-slate-500">
          This restores sign-in to your account only. It does not recover your metaMe wallet — the
          wallet password is a separate, locally-held credential this email cannot reset.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="mt-1 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 transition-all hover:bg-slate-900/60"
        >
          Back
        </button>
      </div>
    );
  }

  if (mode === "forgot") {
    return (
      <form onSubmit={submitForgotPassword} className="flex w-full max-w-[22rem] flex-col gap-2 text-left">
        <div className="text-sm font-medium text-slate-100">Recover account access</div>
        <p className="text-xs text-slate-400">
          We&apos;ll email a link to reset your account sign-in password. This does not recover your
          metaMe wallet, which is encrypted with a separate, locally-held password.
        </p>
        {/* CONDITIONAL BY CONSTRUCTION (operator ruling, 2026-08-02): email
            recovery is only ever available where a recovery email was added.
            A wallet created anonymously has none, and the interface must not
            imply every citizen has one — so this states the precondition up
            front rather than letting someone submit into a dead end. */}
        <p className="text-[11px] text-slate-500">
          Password recovery requires a recovery email previously added to this persona. Without one,
          use your passkey or unlock the wallet on a device that already holds it.
        </p>
        {error ? <p className="text-xs text-amber-300">{error}</p> : null}
        <label htmlFor="metame-recovery-identifier" className="text-[11px] uppercase tracking-wide text-slate-500">
          Recovery email
        </label>
        <input
          id="metame-recovery-identifier"
          type="text"
          inputMode="email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="email"
          className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-100"
        />
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("signin")}
            disabled={busy}
            className="flex-1 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 transition-all hover:bg-slate-900/60 disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={busy || !identifier}
            className="flex-1 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 transition-all hover:bg-slate-900/60 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send recovery email"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitSignIn} className="flex w-full max-w-[22rem] flex-col gap-2 text-left">
      <div className="text-sm font-medium text-slate-100">Use username and password</div>
      {/* THIS COPY IS AUDITED, NOT ASSUMED (2026-08-02 custody + password
          audit). The wallet-encryption password and the Supabase account
          password really ARE two independent credentials today, and the
          separation is load-bearing rather than accidental: the wallet
          password's whole security property is that no server ever receives
          it, which is what makes storing `personas.evm_key` safe. The desired
          "one user-established password" model is reachable by DERIVING both
          from one typed secret client-side — not by making them equal — and
          that migration is scoped, not done. Until it is, saying they are the
          same would be false. See the audit doc for the full trace. */}
      <p className="text-xs text-slate-400">
        This is your account sign-in — today a separate credential from your metaMe wallet password.
      </p>
      {error ? <p className="text-xs text-amber-300">{error}</p> : null}
      {/* The persona route exists in the product model but NOT in the
          implementation — the encrypted wallet envelope is stored server-side
          yet no retrieval path exists (custody audit classification B). Say
          that plainly; never disguise it as a wrong password. */}
      {personaRouteUnavailable ? (
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/10 px-3 py-2">
          <p className="text-xs text-amber-200/90">
            Signing in with a persona name isn&apos;t available yet — restoring a wallet onto a new
            device is a capability we haven&apos;t built.
          </p>
          <p className="mt-1 text-[11px] text-amber-200/70">
            You can still get in with your passkey, or with your wallet password on a device that
            already holds this wallet. If you added a recovery email, enter that here instead.
          </p>
        </div>
      ) : null}
      <label htmlFor="metame-account-identifier" className="text-[11px] uppercase tracking-wide text-slate-500">
        Persona or recovery email
      </label>
      <input
        id="metame-account-identifier"
        // Deliberately `text`, not `email` — an email-typed input would let
        // the browser reject a persona handle before this form can explain
        // itself, and would signal that only an email is acceptable.
        type="text"
        value={identifier}
        onChange={(e) => {
          setIdentifier(e.target.value);
          if (personaRouteUnavailable) setPersonaRouteUnavailable(false);
        }}
        autoComplete="username"
        className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-100"
      />
      <label htmlFor="metame-account-password" className="text-[11px] uppercase tracking-wide text-slate-500">
        Password
      </label>
      <input
        id="metame-account-password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-100"
      />
      <button
        type="button"
        onClick={() => setMode("forgot")}
        className="self-start text-[11px] text-slate-500 underline decoration-slate-700 underline-offset-2 transition-colors hover:text-slate-400"
      >
        Forgot password?
      </button>
      <p className="text-[11px] text-slate-500">
        You must have added a recovery email to this persona to reset your password.
      </p>
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
          disabled={busy || !identifier || !password}
          className="flex-1 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 transition-all hover:bg-slate-900/60 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </form>
  );
}

export default PassportConnectPanel;
