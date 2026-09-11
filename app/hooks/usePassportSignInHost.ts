"use client";

/**
 * usePassportSignInHost — host side of the PASSPORT_SIGN_IN wallet surface
 * request (see usePassportSignInGate.ts, the requester side, and
 * SmartWalletDrawer.tsx's own subscription for the canonical in-app host).
 *
 * A standalone public page (e.g. app/bridge/knyts/page.tsx) has no
 * SmartWalletDrawer mounted anywhere in its tree, so a requester's
 * broadcast would otherwise reach nobody. SmartWalletDrawer's own comment
 * anticipates exactly this: "There are several wallet mounts in this
 * codebase... Listening here means an OPEN wallet always honours a
 * request, whatever mounted it." This hook is that same small pattern
 * applied to a second, legitimate host — a bare page that can render
 * PassportConnectPanel inline, the same surface /invite/[code]/page.tsx
 * already uses directly for public Passport sign-in.
 */

import { useCallback, useEffect, useState } from "react";
import {
  acknowledgeWalletSurfaceRequest,
  announceWalletSurfaceCompletion,
  subscribeWalletSurfaceRequest,
} from "@/services/wallet/walletSurfaceRequest";

export interface UsePassportSignInHostResult {
  /** True while a PASSPORT_SIGN_IN request is pending host-side. */
  showPassportSignIn: boolean;
  /** Call from PassportConnectPanel's onConnected. */
  completeSignIn: () => void;
  /** Call from a "Back"/dismiss control. */
  dismissSignIn: () => void;
}

export function usePassportSignInHost(hostName: string): UsePassportSignInHostResult {
  const [pending, setPending] = useState<{ token: number; returnTarget?: string } | null>(null);

  useEffect(
    () =>
      subscribeWalletSurfaceRequest((request) => {
        if (request.surface !== 'PASSPORT_SIGN_IN') return;
        setPending({ token: request.token, returnTarget: request.returnTarget });
        acknowledgeWalletSurfaceRequest(request.token, hostName);
      }),
    [hostName],
  );

  const completeSignIn = useCallback(() => {
    if (pending?.returnTarget) {
      announceWalletSurfaceCompletion({
        surface: 'PASSPORT_SIGN_IN',
        outcome: 'ACTION_COMPLETED',
        returnTarget: pending.returnTarget,
      });
    }
    setPending(null);
  }, [pending]);

  const dismissSignIn = useCallback(() => setPending(null), []);

  return { showPassportSignIn: pending !== null, completeSignIn, dismissSignIn };
}
