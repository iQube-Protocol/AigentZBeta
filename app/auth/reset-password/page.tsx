/**
 * /auth/reset-password — completes the Supabase account-password recovery
 * flow started from `UsernamePasswordForm`'s "Forgot password?" (see
 * `components/companion/PassportConnectPanel.tsx`'s header, 2026-08-02
 * section).
 *
 * THIS RECOVERS ACCOUNT ACCESS, NEVER THE METAME WALLET (operator ruling).
 * Supabase's password-reset flow can only ever change the Supabase account
 * password; it has no path to rewrap or recover `encryptedPrivateKey`, which
 * is derived from a separate, locally-held wallet password via PBKDF2 and
 * exists nowhere in plaintext, including server-side. Every string on this
 * page says "account access" — never "wallet" or "Passport" — so a citizen
 * who lost their wallet password does not mistake this for a fix.
 *
 * Supabase's email link redirects here with the recovery tokens in the URL
 * hash and fires a `PASSWORD_RECOVERY` auth event once the client SDK parses
 * them; this page listens for that event before allowing a new password to
 * be submitted, per Supabase's own documented recovery flow.
 */

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";

import { getSupabaseBrowserClient } from "@/utils/supabaseBrowser";

type PageState = "waiting" | "ready" | "submitting" | "done" | "error";

export default function ResetPasswordPage() {
  const [state, setState] = useState<PageState>("waiting");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setState("ready");
      }
    });
    // The event can fire before this listener attaches if the SDK already
    // parsed the recovery tokens from the URL hash on load — fall back to
    // checking for an existing session so the form is never stuck waiting.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setState((current) => (current === "waiting" ? "ready" : current));
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setState("submitting");
    const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({ password });
    if (updateError) {
      setError("Could not update your account password. Please request a new recovery email.");
      setState("ready");
      return;
    }
    setState("done");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-5 py-6 text-center">
      <div className="rounded-full border border-slate-800 bg-slate-900/40 p-3">
        <ShieldCheck className="h-6 w-6 text-emerald-400" aria-hidden="true" />
      </div>

      <div className="text-sm font-medium text-slate-100">Recover account access</div>
      <p className="max-w-[22rem] text-[11px] text-slate-500">
        This resets your account sign-in password only. It does not recover your metaMe wallet —
        the wallet password is a separate, locally-held credential this page cannot reset.
      </p>

      {state === "waiting" ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-slate-300" aria-hidden="true" />
          <p className="max-w-[22rem] text-xs text-slate-400">Confirming your recovery link…</p>
        </>
      ) : null}

      {state === "ready" || state === "submitting" ? (
        <form onSubmit={submit} className="flex w-full max-w-[22rem] flex-col gap-2 text-left">
          {error ? <p className="text-xs text-amber-300">{error}</p> : null}
          <label className="text-[11px] uppercase tracking-wide text-slate-500">New account password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-100"
          />
          <label className="text-[11px] uppercase tracking-wide text-slate-500">Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-100"
          />
          <button
            type="submit"
            disabled={state === "submitting" || !password || !confirmPassword}
            className="mt-1 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 transition-all hover:bg-slate-900/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state === "submitting" ? "Updating…" : "Update account password"}
          </button>
        </form>
      ) : null}

      {state === "done" ? (
        <>
          <div className="text-sm font-medium text-emerald-300">Account password updated</div>
          <p className="max-w-[22rem] text-xs text-slate-400">
            You can now sign in with your new account password. Your metaMe wallet password is
            unchanged.
          </p>
        </>
      ) : null}

      {state === "error" ? (
        <>
          <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <p className="max-w-[22rem] text-xs text-amber-300">
            This recovery link is invalid or has expired. Please request a new one.
          </p>
        </>
      ) : null}
    </div>
  );
}
