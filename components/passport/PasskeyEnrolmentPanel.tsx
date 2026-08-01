"use client";

/**
 * PasskeyEnrolmentPanel — the missing half of the passkey ceremony.
 *
 * ── WHY THE PASSKEY PATH NEVER WORKED ──────────────────────────────────────
 *
 * `/api/passport/passkey/enrol-options` and `/api/passport/passkey/enrol-verify`
 * were built, ratified (PRD-PAG-001 Amendment A §A.6) and fully functional —
 * with the credential table, its migration, and `passkeyService.ts` all in
 * place — and had **zero client callers anywhere in the app**. Nothing ever
 * invoked them, so no citizen has ever been able to REGISTER a passkey.
 *
 * Every "Continue with passkey" attempt therefore ran a perfectly correct
 * authentication ceremony against an authenticator holding no credential for
 * this relying party. The browser surfaced that as `NotAllowedError` — the
 * same error a deliberate cancel produces — which is why it read as a flaky
 * or broken passkey rather than as "there is nothing to authenticate with".
 *
 * The sign-in side was never the bug. This panel is the fix: the enrolment
 * ceremony finally has a caller.
 *
 * ── WHAT THIS IS ───────────────────────────────────────────────────────────
 *
 * An AUTHENTICATED action — a passkey binds to an established principal, so
 * this only appears to a signed-in citizen. It adds a credential; it never
 * grants access, changes authority, or replaces the wallet. Enrolling is
 * optional: the wallet-password path remains a complete way in, and a citizen
 * who never enrols loses nothing (Amendment A §A.6: "additional passkey
 * enrolment is optional for ordinary access").
 *
 * Both routes resolve the caller through the spine
 * (`getCallerIdentityContext`), so every call here goes through `personaFetch`
 * — never raw `fetch` (CLAUDE.md's Identity & Access Spine rule).
 */

import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Loader2, Check, AlertTriangle } from "lucide-react";
import { startRegistration, browserSupportsWebAuthn, WebAuthnError } from "@simplewebauthn/browser";
import type { RegistrationResponseJSON } from "@simplewebauthn/browser";

import { personaFetch } from "@/utils/personaSpine";

/**
 * Classify an enrolment failure. Mirrors `classifyPasskeyStartError` in
 * `PassportConnectPanel.tsx` — same library, same discipline: use the
 * package's own `WebAuthnError` rather than matching `DOMException.name`
 * strings, and never end on a generic "try again" that names nothing.
 *
 * The one enrolment-specific case worth separating is
 * `ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED`: it is not a failure at all
 * from the citizen's point of view — this device already has a passkey — so
 * telling them to retry would be actively wrong.
 */
function classifyEnrolmentError(err: unknown): { authenticatorClaimsEnrolled: boolean; message: string } {
  if (err instanceof WebAuthnError) {
    switch (err.code) {
      case "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED":
        // NOT durable success. The AUTHENTICATOR believes it holds a
        // credential for this relying party; that says nothing about whether
        // the platform holds a matching ACTIVE record. The record may be
        // absent, revoked, or left by another environment or RP
        // configuration. The caller must confirm against the server before
        // showing "ready" (operator ruling, 2026-08-02).
        return {
          authenticatorClaimsEnrolled: true,
          message: "",
        };
      case "ERROR_CEREMONY_ABORTED":
        return { authenticatorClaimsEnrolled: false, message: "Passkey setup was interrupted. You can try again." };
      case "ERROR_INVALID_DOMAIN":
      case "ERROR_INVALID_RP_ID":
        return {
          authenticatorClaimsEnrolled: false,
          message: "Passkeys aren't configured correctly for this address, so one can't be created here.",
        };
      case "ERROR_AUTHENTICATOR_GENERAL_ERROR":
        return { authenticatorClaimsEnrolled: false, message: "Your device could not complete the passkey prompt." };
      default:
        // The spec deliberately collapses "declined" and several other cases
        // into one error — say what is true rather than inventing a cause.
        return { authenticatorClaimsEnrolled: false, message: "No passkey was created. You can try again whenever you like." };
    }
  }
  return { authenticatorClaimsEnrolled: false, message: "Passkey setup did not complete." };
}

export interface PasskeyEnrolmentPanelProps {
  /** Bound into the enrolment challenge. Defaults to the application audience. */
  audience?: string;
  /** Notifies the host after a credential is successfully registered. */
  onEnrolled?: () => void;
}

/**
 * The four states the connected-Passport surface must distinguish (operator
 * ruling, 2026-08-02) — plus `unknown`, because "we could not check" is a
 * real fifth situation and must never render as any of the other four.
 *
 *   'unknown'      — the credential reread has not resolved. Never rendered
 *                    as "no passkey": that would invite a needless re-enrol.
 *   'none'         — server confirms zero active credentials → Add a passkey
 *   'ready'        — server confirms an active credential → Passkey ready
 *   'needs-repair' — the AUTHENTICATOR says it is already registered but the
 *                    server holds no matching active record. Re-enrolling is
 *                    the fix; claiming "ready" here would promise a sign-in
 *                    that will fail.
 *   'unsupported'  — no WebAuthn in this browser → use the wallet password
 */
type PasskeyState = "unknown" | "none" | "ready" | "needs-repair" | "unsupported";

export function PasskeyEnrolmentPanel({
  audience = "metame-application",
  onEnrolled,
}: PasskeyEnrolmentPanelProps) {
  const [state, setState] = useState<PasskeyState>("unknown");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  /**
   * The DURABLE read. Enrolment is complete only when the server confirms an
   * active credential bound to the current principal — never when the
   * browser merely says the authenticator knows about one.
   *
   * Returns the confirmed count, or `null` for "could not check" so callers
   * can keep that distinct from zero.
   */
  const readCredentials = useCallback(async (): Promise<number | null> => {
    try {
      const res = await personaFetch("/api/passport/passkey/credentials", { cache: "no-store" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) return null;
      return typeof body.count === "number" ? body.count : null;
    } catch {
      return null;
    }
  }, []);

  // Support is a browser fact — resolve it after mount so the server render
  // and the first client render agree (CLAUDE.md's no-SSR/CSR-mismatch rule).
  // Then confirm durable state from the server, never from local assumption.
  useEffect(() => {
    if (!browserSupportsWebAuthn()) {
      setState("unsupported");
      return;
    }
    void (async () => {
      const count = await readCredentials();
      // `null` (could not check) deliberately leaves the state at 'unknown'.
      if (count === null) return;
      setState(count > 0 ? "ready" : "none");
    })();
  }, [readCredentials]);

  const enrol = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    setIsError(false);
    try {
      const optRes = await personaFetch("/api/passport/passkey/enrol-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience }),
      });
      const opt = await optRes.json().catch(() => null);
      if (!optRes.ok || !opt?.ok) {
        setIsError(true);
        setMessage(
          optRes.status === 401
            ? "Sign in first — a passkey is added to an account that already exists."
            : "Passkey setup is unavailable right now. Please try again in a moment.",
        );
        return;
      }

      let attestation: RegistrationResponseJSON;
      try {
        attestation = await startRegistration({ optionsJSON: opt.options });
      } catch (err) {
        const classified = classifyEnrolmentError(err);
        if (classified.authenticatorClaimsEnrolled) {
          // CONFIRM, don't believe. The authenticator's claim is checked
          // against the server's own record before anything is shown.
          const count = await readCredentials();
          if (count === null) {
            setIsError(false);
            setState("unknown");
            setMessage("Your device already has a passkey, but we could not confirm it just now.");
          } else if (count > 0) {
            setIsError(false);
            setState("ready");
            setMessage("This device already has a passkey for your Passport — you can sign in with it now.");
          } else {
            // Authenticator says yes, platform says no: a real mismatch.
            setIsError(true);
            setState("needs-repair");
            setMessage(
              "Your device holds a passkey we have no record of — it may be from another environment. " +
                "Remove it in your device's passkey settings, then add a new one here.",
            );
          }
          return;
        }
        setIsError(true);
        setMessage(classified.message);
        return;
      }

      const verRes = await personaFetch("/api/passport/passkey/enrol-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          response: attestation,
          friendlyName: typeof navigator !== "undefined" ? navigator.platform || null : null,
        }),
      });
      const ver = await verRes.json().catch(() => null);
      if (!verRes.ok || !ver?.ok) {
        setIsError(true);
        setMessage("Your device created a passkey, but it could not be registered. Please try again.");
        return;
      }

      // Even on a clean success, confirm from the server rather than
      // asserting it: enrolment is COMPLETE only when the reread agrees.
      const count = await readCredentials();
      if (count !== null && count > 0) {
        setState("ready");
        setIsError(false);
        setMessage("Passkey added. You can now use it to sign in.");
        onEnrolled?.();
      } else {
        setState("unknown");
        setIsError(false);
        setMessage("Passkey registered — we could not confirm the record just now, so check back shortly.");
      }
    } finally {
      setBusy(false);
    }
  }, [audience, onEnrolled, readCredentials]);

  // A control that cannot act must not render (MS-9): a browser without
  // WebAuthn can never complete this, so offer nothing rather than a button
  // that always fails.
  if (state === "unsupported") return null;

  const ready = state === "ready";
  const needsRepair = state === "needs-repair";

  const heading = ready ? "Passkey ready" : needsRepair ? "Passkey needs repair" : "Add a passkey";
  const body = ready
    ? "This device can sign in with Face ID, Touch ID, Windows Hello or a security key."
    : needsRepair
      ? "Your device holds a passkey the platform has no active record of, so signing in with it would fail."
      : "Sign in on this device with Face ID, Touch ID, Windows Hello or a security key — without typing your wallet password each time. Optional: your wallet password keeps working either way.";

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-left">
      <div className="flex items-center gap-2">
        <Fingerprint
          className={`h-4 w-4 ${ready ? "text-emerald-400" : needsRepair ? "text-amber-400" : "text-slate-400"}`}
          aria-hidden="true"
        />
        <span className="text-sm font-medium text-slate-100">{heading}</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{body}</p>
      {message ? (
        <p className={`mt-2 flex items-start gap-1.5 text-[11px] ${isError ? "text-amber-300" : "text-emerald-300"}`}>
          {isError ? (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          {message}
        </p>
      ) : null}
      {/* 'unknown' keeps the button available — an unconfirmed state must
          never lock the citizen out of enrolling — but never claims ready. */}
      {!ready ? (
        <button
          type="button"
          onClick={() => void enrol()}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Fingerprint className="h-3.5 w-3.5" />}
          {busy ? "Waiting for your device…" : needsRepair ? "Re-enrol passkey" : "Add a passkey"}
        </button>
      ) : null}
    </div>
  );
}

export default PasskeyEnrolmentPanel;
