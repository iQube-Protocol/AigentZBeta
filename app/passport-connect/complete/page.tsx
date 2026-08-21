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
 * THE PERSONA MAKES THE SAME CROSSING (§A.11.2 follow-up, operator
 * 2026-07-28: "now actions aren't working — red check mark and not pulling
 * over or getting right overlay"). Establishing the session here was only
 * half the crossing. The citizen's EXPLICITLY CHOSEN persona was pinned to
 * `localStorage.currentPersonaId` by the Companion panel — inside the
 * iframe's partition, invisible here. So the top-level app had a valid
 * session and no chosen persona, `personaFetch` sent no `x-persona-id`, and
 * `getActivePersona` fell to its step-4 "first owned persona, sorted"
 * default — the exact fallback ruling 2 exists to abolish. Worse, the
 * runtime's own bootstrap then LATCHED that fallback into localStorage, and
 * the extension observer (which scrapes this same key off the top-level tab)
 * either paired the wrong persona or refused to pair at all, killing every
 * "Pull Across" with a red ✗.
 *
 * So this page now redeems the persona activation for the APPLICATION world
 * and writes the pin here, where the application actually reads it.
 *
 * SECURITY SHAPE:
 *  - The token in the URL is a Supabase single-use hashed OTP token — the same
 *    class of value every Supabase magic-link email carries in its URL. It is
 *    consumed on first exchange and expires on Supabase's clock.
 *  - `persona_tx` is likewise an opaque, random, single-use handle that
 *    carries NO identity on its face, and redeeming it additionally requires
 *    a valid Bearer session whose auth user matches the row. **No T0
 *    identifier — no raw personaId — is ever placed in a URL**; the persona
 *    id is returned only over an authenticated response body, server-side.
 *  - The URL is scrubbed (history.replaceState) BEFORE the exchange, so the
 *    tokens never survive into history/bookmarks even if the exchange hangs.
 *  - `next` is confined to a same-origin path: it must start with exactly one
 *    "/" — anything else (absolute URLs, protocol-relative "//", schemes)
 *    falls back to the runtime home. No open redirect.
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShieldCheck, Loader2, AlertTriangle } from "lucide-react";

import { getSupabaseBrowserClient } from "@/utils/supabaseBrowser";
import { personaFetch } from "@/utils/personaSpine";

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
    const personaTx = searchParams?.get("persona_tx") ?? null;
    const next = safeNextPath(searchParams?.get("next") ?? null);

    // Scrub the single-use tokens out of the address bar and history FIRST —
    // before the exchange, so they cannot linger if anything below stalls.
    try {
      window.history.replaceState(null, "", "/passport-connect/complete");
    } catch {
      // History API unavailable — the tokens are still single-use and short-lived.
    }

    if (!tokenHash) {
      setState("error");
      return;
    }

    (async () => {
      // type: "email" — NOT "magiclink". See PassportConnectPanel's
      // companion exchange for the confirmed root cause: Supabase Auth's
      // /verify endpoint resolves a generateLink({ type: 'magiclink' })
      // token_hash under the unified 'email' OTP type; 'magiclink' is a
      // generateLink()-only type and 400s here.
      const { error } = await getSupabaseBrowserClient().auth.verifyOtp({
        token_hash: tokenHash,
        type: "email",
      });
      if (error) {
        // Safe diagnostic: status/code/name only — never the token_hash.
        console.warn("[PassportConnect] application session exchange failed:", {
          status: error.status,
          code: error.code,
          name: error.name,
        });
        setState("error");
        return;
      }

      // THE PERSONA CROSSING. Runs AFTER verifyOtp — the redemption is
      // Bearer-gated, so it needs the session that call just established in
      // THIS (top-level) storage world. `world=application` redeems this
      // world's own single-use activation marker; the Companion iframe
      // redeemed its own separately, so neither starves the other.
      //
      // The write is UNCONDITIONAL and overwrites any existing value: the
      // citizen's deliberate selection outranks whatever ambient fallback the
      // runtime may already have latched here (MetaMeRuntimeClient persists
      // its "first owned persona" guess, and its own guard would otherwise
      // keep that wrong value forever). Both storages are written because
      // personaFetch reads either.
      //
      // Best-effort: a failure here must never strand a citizen who already
      // holds a valid session — it degrades to exactly the pre-fix behaviour,
      // never to a sign-in wall.
      if (personaTx) {
        try {
          const res = await personaFetch(
            `/api/passport-connect/resolved-persona?world=application&transactionToken=${encodeURIComponent(personaTx)}`,
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
