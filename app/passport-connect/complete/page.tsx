/**
 * /passport-connect/complete — the application half of the Companion handshake.
 *
 * PRD-PAG-001 Amendment A, "Companion and application handshake" (operator:
 * "close this gap and close this out", 2026-07-26).
 *
 * THE PARTITION GAP THIS CLOSES. The Companion is an iframe inside the
 * extension side panel, and browsers partition third-party iframe storage —
 * so the session a citizen established by connecting their Passport in the
 * Companion never reached the top-level application tabs, which went on
 * demanding a username/password the whole flow exists to abolish. The
 * Companion now opens THIS page in the left-hand browser with a second
 * single-use grant; the exchange below runs in the top-level storage world,
 * which is where the application actually lives.
 *
 * SECURITY SHAPE:
 *  - The token in the URL is a Supabase single-use hashed OTP token — the same
 *    class of value every Supabase magic-link email carries in its URL. It is
 *    consumed on first exchange and expires on Supabase's clock.
 *  - The URL is scrubbed (history.replaceState) BEFORE the exchange, so the
 *    token never survives into history/bookmarks even if the exchange hangs.
 *  - `next` is confined to a same-origin path: it must start with exactly one
 *    "/" — anything else (absolute URLs, protocol-relative "//", schemes)
 *    falls back to the runtime home. No open redirect.
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, Loader2, AlertTriangle } from "lucide-react";

import { getSupabaseBrowserClient } from "@/utils/supabaseBrowser";

const DEFAULT_NEXT = "/metame/runtime";

/** Same-origin relative paths only — one leading slash, no scheme, no "//" host trick. */
export function safeNextPath(raw: string | null): string {
  if (!raw) return DEFAULT_NEXT;
  if (!raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_NEXT;
  if (raw.includes("://") || raw.includes("\\")) return DEFAULT_NEXT;
  return raw;
}

function CompleteInner() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<"working" | "done" | "error">("working");

  useEffect(() => {
    const tokenHash = searchParams?.get("token_hash") ?? null;
    const next = safeNextPath(searchParams?.get("next") ?? null);

    // Scrub the single-use token out of the address bar and history FIRST —
    // before the exchange, so it cannot linger if anything below stalls.
    try {
      window.history.replaceState(null, "", "/passport-connect/complete");
    } catch {
      // History API unavailable — the token is still single-use and short-lived.
    }

    if (!tokenHash) {
      setState("error");
      return;
    }

    (async () => {
      const { error } = await getSupabaseBrowserClient().auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });
      if (error) {
        setState("error");
        return;
      }
      setState("done");
      window.location.replace(next);
    })();
    // Run exactly once — searchParams identity churn must not re-consume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-slate-100">
      <div className="rounded-full border border-slate-800 bg-slate-900/40 p-3">
        <ShieldCheck className="h-6 w-6 text-emerald-400" aria-hidden="true" />
      </div>
      {state === "working" ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-slate-300" aria-hidden="true" />
          <div className="text-sm">Opening your Passport session…</div>
        </>
      ) : null}
      {state === "done" ? (
        <div className="text-sm text-emerald-300">Connected — taking you in.</div>
      ) : null}
      {state === "error" ? (
        <>
          <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <div className="max-w-sm text-sm text-amber-300">
            This connection link was already used or has expired. Open the Companion and select
            Connect again — no session was created here.
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function PassportConnectCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-300">
          Loading…
        </div>
      }
    >
      <CompleteInner />
    </Suspense>
  );
}
