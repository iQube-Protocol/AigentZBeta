/**
 * PassportConnectPanel — the Companion's Connect surface.
 *
 * PRD-PAG-001 **Amendment A** §A.7 + the operator's Connect state machine,
 * increment 6 (chartered 2026-07-26).
 *
 * ── WHAT CONNECT MEANS HERE ────────────────────────────────────────────────
 *
 * This is Passport-NATIVE access: the citizen does not sign into anything
 * first. They prove control of the wallet holding their Passport, and a session
 * follows. There is no username, no password, and no account to create — the
 * internal principal is resolved behind the proof (§A.3.2).
 *
 * ── RULING A.7: PREFERRED, NEVER EXCLUSIVE ─────────────────────────────────
 *
 * The Companion is the preferred connector, but the PROTOCOL must not depend on
 * it. Everything here talks to `/api/passport-connect/*` over plain HTTP and
 * uses the injected EIP-1193 provider — no `chrome.*`, no extension bridge, no
 * Companion-only capability. Any other wallet or web connector can drive the
 * same two routes. If a future edit makes this component the only thing that
 * can authenticate, that is an infraction of the ruling.
 *
 * ── HOLDER CONTROL IS NOT OPTIONAL ─────────────────────────────────────────
 *
 * "A Passport is present in the wallet" is never sufficient — a readable
 * credential is not a bearer token. The citizen always performs one local
 * approval ceremony (the wallet's own signing prompt, biometric or otherwise),
 * and the server always verifies a single-use, origin-bound challenge. What is
 * optional is separately enrolled 2FA; the cryptographic proof is not.
 */

"use client";

import { useCallback, useState } from "react";
import { ShieldCheck, Wallet as WalletIcon, Loader2, AlertTriangle } from "lucide-react";

import { getSupabaseBrowserClient } from "@/utils/supabaseBrowser";

/**
 * The operator's state machine. `no-wallet` (A) is not an initial state — it is
 * only entered once we have LOOKED and found no provider, so a citizen with a
 * wallet never sees a "connect a wallet" prompt they don't need.
 */
type ConnectState =
  | { kind: "idle" }
  | { kind: "no-wallet" } // A
  | { kind: "no-passport" } // B
  | { kind: "confirm"; passport: PassportFacts } // C
  | { kind: "choose"; addresses: string[] } // D
  | { kind: "connected"; passport: PassportFacts } // E
  | { kind: "working"; step: string }
  | { kind: "error"; message: string };

interface PassportFacts {
  passportClass: string | null;
  citizenStatus: string | null;
  participantStatus: string | null;
  passportGrade: string | null;
  expiresAt: string | null;
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

export interface PassportConnectPanelProps {
  /** Called after a session exists, so the host can re-resolve identity. */
  onConnected?: () => void;
}

export function PassportConnectPanel({ onConnected }: PassportConnectPanelProps) {
  const [state, setState] = useState<ConnectState>({ kind: "idle" });

  /**
   * The whole ceremony. Written as one flow rather than a step machine because
   * every step's failure is terminal for the attempt: a spent challenge cannot
   * be retried, so there is no partial state worth resuming.
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
        // behind the choice.
        const address = chosenAddress ?? (accounts.length === 1 ? accounts[0] : null);
        if (!address) {
          setState({ kind: "choose", addresses: accounts });
          return;
        }

        setState({ kind: "working", step: "Requesting a challenge…" });
        const chRes = await fetch("/api/passport-connect/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audience: AUDIENCE, walletAddress: address }),
        });
        const ch = await chRes.json().catch(() => null);
        if (!chRes.ok || !ch?.ok) {
          setState({
            kind: "error",
            message: "Could not start a connection. Please try again in a moment.",
          });
          return;
        }

        // The local approval ceremony. This is the holder-control proof — as
        // low-friction as the wallet allows, but never skipped.
        setState({ kind: "working", step: "Approve in your wallet to continue…" });
        let signature: string;
        try {
          signature = (await eth.request({
            method: "personal_sign",
            params: [ch.message, address],
          })) as string;
        } catch {
          // Cancellation is not an error condition — nothing was created.
          setState({ kind: "idle" });
          return;
        }

        setState({ kind: "working", step: "Verifying your Passport…" });
        const prRes = await fetch("/api/passport-connect/proof", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nonce: ch.nonce,
            message: ch.message,
            signature,
            audience: AUDIENCE,
          }),
        });
        const pr = await prRes.json().catch(() => null);

        if (prRes.status === 403) {
          setState({ kind: "no-passport" }); // B
          return;
        }
        if (!prRes.ok || !pr?.ok || !pr?.tokenHash) {
          setState({
            kind: "error",
            message:
              pr?.error === "expired" || pr?.error === "already_consumed"
                ? "That approval expired. Please try connecting again."
                : "Connection failed. No session was created.",
          });
          return;
        }

        // Exchange for the application session. Supabase owns the token's
        // single-use and expiry semantics; we never hand-roll a session.
        setState({ kind: "working", step: "Opening your session…" });
        const { error } = await getSupabaseBrowserClient().auth.verifyOtp({
          token_hash: pr.tokenHash,
          type: "magiclink",
        });
        if (error) {
          setState({ kind: "error", message: "Your Passport verified, but the session could not open." });
          return;
        }

        setState({ kind: "connected", passport: pr.passport as PassportFacts }); // E
        onConnected?.();
      } catch {
        setState({ kind: "error", message: "Connection failed. No session was created." });
      }
    },
    [onConnected],
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

      {/* B — wallet connected, no eligible Passport */}
      {state.kind === "no-passport" ? (
        <>
          <div className="text-sm font-medium text-slate-100">
            No active Passport was found for this wallet.
          </div>
          <p className="max-w-[22rem] text-xs text-slate-400">
            A wallet connection on its own is not constitutional access. Obtain or restore a
            Passport, or sign in another way.
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

      {/* D — several accounts; the citizen chooses. Never chosen for them. */}
      {state.kind === "choose" ? (
        <>
          <div className="text-sm font-medium text-slate-100">Which wallet should connect?</div>
          <p className="max-w-[22rem] text-xs text-slate-400">
            More than one is available. Choose the one holding the Passport you want to use.
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

      {/* E — connected */}
      {state.kind === "connected" ? (
        <>
          <div className="text-sm font-medium text-emerald-300">Connected</div>
          <p className="max-w-[22rem] text-xs text-slate-400">
            Your Passport established this session.
            {state.passport?.passportClass ? ` Class: ${state.passport.passportClass}.` : ""}
          </p>
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
