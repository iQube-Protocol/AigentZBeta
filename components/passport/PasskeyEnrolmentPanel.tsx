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
function classifyEnrolmentError(err: unknown): { alreadyEnrolled: boolean; message: string } {
  if (err instanceof WebAuthnError) {
    switch (err.code) {
      case "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED":
        return {
          alreadyEnrolled: true,
          message: "This device already has a passkey for your Passport — you can sign in with it now.",
        };
      case "ERROR_CEREMONY_ABORTED":
        return { alreadyEnrolled: false, message: "Passkey setup was interrupted. You can try again." };
      case "ERROR_INVALID_DOMAIN":
      case "ERROR_INVALID_RP_ID":
        return {
          alreadyEnrolled: false,
          message: "Passkeys aren't configured correctly for this address, so one can't be created here.",
        };
      case "ERROR_AUTHENTICATOR_GENERAL_ERROR":
        return { alreadyEnrolled: false, message: "Your device could not complete the passkey prompt." };
      default:
        // The spec deliberately collapses "declined" and several other cases
        // into one error — say what is true rather than inventing a cause.
        return { alreadyEnrolled: false, message: "No passkey was created. You can try again whenever you like." };
    }
  }
  return { alreadyEnrolled: false, message: "Passkey setup did not complete." };
}

export interface PasskeyEnrolmentPanelProps {
  /** Bound into the enrolment challenge. Defaults to the application audience. */
  audience?: string;
  /** Notifies the host after a credential is successfully registered. */
  onEnrolled?: () => void;
}

export function PasskeyEnrolmentPanel({
  audience = "metame-application",
  onEnrolled,
}: PasskeyEnrolmentPanelProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  // Support is a browser fact — resolve it after mount so the server render
  // and the first client render agree (CLAUDE.md's no-SSR/CSR-mismatch rule).
  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
  }, []);

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
        // "already registered" is a success state for the citizen, not a
        // failure — do not paint it red or invite a pointless retry.
        setIsError(!classified.alreadyEnrolled);
        setEnrolled(classified.alreadyEnrolled);
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

      setEnrolled(true);
      setMessage("Passkey added. You can now use it to sign in.");
      onEnrolled?.();
    } finally {
      setBusy(false);
    }
  }, [audience, onEnrolled]);

  // A control that cannot act must not render (MS-9): a browser without
  // WebAuthn can never complete this, so offer nothing rather than a button
  // that always fails.
  if (supported === false) return null;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-left">
      <div className="flex items-center gap-2">
        <Fingerprint className={`h-4 w-4 ${enrolled ? "text-emerald-400" : "text-slate-400"}`} aria-hidden="true" />
        <span className="text-sm font-medium text-slate-100">
          {enrolled ? "Passkey active" : "Add a passkey"}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
        {enrolled
          ? "This device can now sign in with Face ID, Touch ID, Windows Hello or a security key."
          : "Sign in on this device with Face ID, Touch ID, Windows Hello or a security key — without typing your wallet password each time. Optional: your wallet password keeps working either way."}
      </p>
      {message ? (
        <p
          className={`mt-2 flex items-start gap-1.5 text-[11px] ${isError ? "text-amber-300" : "text-emerald-300"}`}
        >
          {isError ? (
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          {message}
        </p>
      ) : null}
      {!enrolled ? (
        <button
          type="button"
          onClick={() => void enrol()}
          disabled={busy || supported === null}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-2 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Fingerprint className="h-3.5 w-3.5" />}
          {busy ? "Waiting for your device…" : "Add a passkey"}
        </button>
      ) : null}
    </div>
  );
}

export default PasskeyEnrolmentPanel;
