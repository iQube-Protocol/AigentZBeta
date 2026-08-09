"use client";

/**
 * usePassportSignInGate — gate an act on an active Passport, and resume the
 * SAME intent once sign-in completes.
 *
 * Built on the same request/returnTarget/completion protocol Register uses
 * for PRINCIPAL_WALLET_PROVISIONING (see RegisterAgentPanel.tsx) and the
 * PASSPORT_SIGN_IN surface SmartWalletDrawer already renders internally
 * (persona menu, auto-open-on-visit). Neither existed for a surface OUTSIDE
 * the wallet's own host to request Passport sign-in specifically and learn
 * when it resolved — this hook is that missing glue, generalized rather than
 * hardcoded to one caller (inv.engineering.036/037).
 *
 * Usage: a caller with a "resume this intent" value of its own (e.g. the
 * myCanvas entry a KNYTS Bridge visitor was about to Remix) calls
 * `requestSignIn()` and stashes that value itself; `onSignedIn` fires once
 * per completed request. Callers do not need to re-derive personaId here —
 * the existing `aa-persona-change-v1` broadcast (see useActivePersona /
 * useCodexEmbedAuthBridge) already updates any personaId prop reactively
 * once Passport sign-in completes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  requestWalletSurface,
  subscribeWalletSurfaceAck,
  subscribeWalletSurfaceCompletion,
} from "@/services/wallet/walletSurfaceRequest";

export interface UsePassportSignInGateOptions {
  /** Which surface is asking — shown in ack/completion tracing. */
  origin: string;
  /** Identifier the requester recognizes on completion, e.g.
   *  'campaign:knyts-bridge-crossing:remix'. Unique per logical gate so
   *  concurrent gates on the same page don't cross-fire each other's
   *  completions. */
  returnTarget: string;
  /** Label shown on the wallet's "Continue to …" button. */
  returnLabel: string;
  /** Fires once when Passport sign-in completes for THIS returnTarget. */
  onSignedIn: () => void;
}

export interface UsePassportSignInGateResult {
  /** Ask the wallet host to open Passport sign-in. */
  requestSignIn: () => void;
  /** True once the ack-wait window has elapsed with no host answering —
   *  a fact to surface ("no wallet host reachable here"), never a guess. */
  handoffUnanswered: boolean;
}

const ACK_TIMEOUT_MS = 1500;

export function usePassportSignInGate(
  options: UsePassportSignInGateOptions,
): UsePassportSignInGateResult {
  const { origin, returnTarget, returnLabel, onSignedIn } = options;
  const [handoffUnanswered, setHandoffUnanswered] = useState(false);
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awaitingAckTokenRef = useRef<number | null>(null);

  useEffect(
    () =>
      subscribeWalletSurfaceAck((ack) => {
        if (awaitingAckTokenRef.current !== ack.token) return;
        awaitingAckTokenRef.current = null;
        if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
        setHandoffUnanswered(false);
      }),
    [],
  );

  useEffect(
    () =>
      subscribeWalletSurfaceCompletion((completion) => {
        if (completion.surface !== 'PASSPORT_SIGN_IN') return;
        if (completion.returnTarget !== returnTarget) return;
        if (completion.outcome !== 'ACTION_COMPLETED') return;
        onSignedIn();
      }),
    [returnTarget, onSignedIn],
  );

  const requestSignIn = useCallback(() => {
    setHandoffUnanswered(false);
    const token = requestWalletSurface({
      surface: 'PASSPORT_SIGN_IN',
      origin,
      returnTarget,
      returnLabel,
    });
    awaitingAckTokenRef.current = token;
    if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
    ackTimerRef.current = setTimeout(() => {
      if (awaitingAckTokenRef.current !== token) return;
      awaitingAckTokenRef.current = null;
      setHandoffUnanswered(true);
    }, ACK_TIMEOUT_MS);
  }, [origin, returnTarget, returnLabel]);

  useEffect(() => {
    return () => {
      if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
    };
  }, []);

  return { requestSignIn, handoffUnanswered };
}
