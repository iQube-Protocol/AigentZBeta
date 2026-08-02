'use client';

/**
 * Which mounted component is responsible for honouring a wallet-surface request.
 *
 * ── The defect this settles (operator, 2026-08-02) ─────────────────────────
 *
 * Two components can hear a request in the same document, and only one of them
 * can actually show a wallet:
 *
 *   CodexPanelDynamic  — owns the OVERLAY SmartWalletDrawer, the one the
 *                        "Welcome, <persona>" badge opens. Proven to render on
 *                        top of a cartridge; this is the path the operator
 *                        found after the earlier round of wallet-in-cartridge
 *                        failures, and the reason it works is that the drawer
 *                        is mounted by the cartridge shell itself rather than
 *                        nested inside another overlay's stacking context.
 *
 *   CodexCopilotLayer  — owns an EMBEDDED wallet inside its own panel. That
 *                        panel is `variant="floating"` and usually CLOSED, so
 *                        flipping its internal `walletPanelOpen` renders
 *                        nothing at all.
 *
 * The first guard tried to distinguish them by whether the copilot was
 * suppressed. On the Journey tab it is not suppressed — it is merely closed —
 * so the copilot claimed every request and silently did nothing. Same symptom
 * as the two earlier rounds (module bus, unmounted drawer), same root shape:
 * the receiver was not where I assumed.
 *
 * ── The rule ───────────────────────────────────────────────────────────────
 *
 * Responsibility is DECLARED by mounting, not inferred from flags. A component
 * that owns a wallet it can actually open declares itself the host; anything
 * nested inside it defers. `useIsWalletSurfaceHostClaimed()` returns true when
 * an ancestor has claimed it — the copilot checks this and stands down rather
 * than competing (MS-2: one owner per surface).
 *
 * Outside a claim (the standalone Companion embed, where the copilot IS the
 * only wallet), the copilot still subscribes and is still correct.
 */

import React, { createContext, useContext } from 'react';

const WalletSurfaceHostClaimed = createContext(false);

/** Wraps a subtree whose ANCESTOR will honour wallet-surface requests. */
export const WalletSurfaceHostProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <WalletSurfaceHostClaimed.Provider value={true}>{children}</WalletSurfaceHostClaimed.Provider>
);

/**
 * True when an ancestor already honours wallet-surface requests.
 *
 * A nested listener that returns true here must NOT subscribe: two reactions
 * to one click either open two wallets or — the case that actually happened —
 * let the one that cannot render win.
 */
export function useIsWalletSurfaceHostClaimed(): boolean {
  return useContext(WalletSurfaceHostClaimed);
}
