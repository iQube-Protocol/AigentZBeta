/**
 * /passport-connect — the TOP-LEVEL Passport-native Connect door.
 *
 * PRD-PAG-001 Amendment A, ruling A.7: "the Companion is the PREFERRED
 * connector, but the PROTOCOL must not depend on it… If a future edit makes
 * this component the only thing that can authenticate, that is an
 * infraction of the ruling."
 *
 * Until 2026-07-28 that infraction was the shipped state: PassportConnectPanel
 * mounted ONLY inside the Companion embed's connect gate, so the top-level
 * application's sole entrance remained email/password — the exact wall
 * Amendment A abolishes. Worse, the Companion mount is inside the extension
 * side panel's iframe, where injected wallet providers (MetaMask et al.) do
 * not reach, so the panel's `no-wallet` state (A) was the END of the road:
 * a citizen with a wallet one click away in the same browser could never
 * present it (operator, 2026-07-28: "there is no connect with passport
 * option… same sign in block"). CB-1 — a mechanism that cannot fire is
 * indistinguishable from one that does not exist.
 *
 * This page mounts the SAME panel — one implementation, per
 * inv.engineering.036 — in a top-level tab. `world="application"` tells the
 * panel it is already in the application's storage world: the session
 * (verifyOtp) and the persona pin land directly where the app reads them,
 * the persona activation is redeemed against the application-world marker,
 * and no handoff tab is opened. After connecting here, the extension's
 * "Connect to metaMe" can extract this session from the tab — completing the
 * fully passwordless chain: Passport → application session → Companion
 * pairing.
 *
 * ADDENDUM (operator ruling, 2026-08-01): the panel no longer signs through
 * `window.ethereum` at all — see PassportConnectPanel.tsx's own header for
 * the signing-surface repair. Signing is local WebCrypto over the metaMe
 * wallet's own key material, which does not require this page's top-level
 * mount to "reach" an injected provider. Both mount points still exist for
 * the reason above them (the storage-partition/handoff mechanics), which is
 * independent of `window.ethereum` and remains true. The one thing NOT yet
 * solved by this repair: the LOCAL WALLET PROFILE INDEX itself is also
 * per-origin storage, so a wallet profile saved while signed in here is not
 * automatically visible from inside the Companion's partitioned iframe —
 * tracked as "Pair another metaMe device" in the panel's `no-local-wallet`
 * state, not silently assumed solved by this page's existence.
 */

"use client";

import { PassportConnectPanel } from "@/components/companion/PassportConnectPanel";

const NEXT_AFTER_CONNECT = "/metame/runtime";

export default function PassportConnectPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/40 py-8">
        <PassportConnectPanel
          world="application"
          // Session + pin are already in this world when this fires; navigate
          // so every consumer re-resolves against the fresh session at once.
          onConnected={() => window.location.assign(NEXT_AFTER_CONNECT)}
        />
      </div>
    </div>
  );
}
