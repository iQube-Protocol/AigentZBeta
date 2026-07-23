/**
 * metaMe Companion — first presentation surface (web-embed).
 * PRD-MMC-001 (RATIFIED 2026-07-22) Phase 0/1 shell.
 *
 * Route: /triad/embed/companion
 * Query params: personaId | pst-era params, authProfileId, theme — mirrors
 * the codex embed route's identity propagation (CLAUDE.md "Inter-Cartridge
 * Navigation"): URL param first, `useCodexEmbedAuthBridge` fallback.
 *
 * IMPLEMENTATION CHOICE (stated per the Phase 1 charter): this is the
 * MINIMAL COMPANION SHELL — a dedicated flex container mounting
 * `SmartWalletDrawer variant="embedded"` with the canonical embedded-mode
 * prop set (mirrored from `CodexCopilotLayer`'s walletPanelOpen branch:
 * variant/embeddedWidth/codexMode/personaId/agent) — NOT a full
 * CodexCopilotLayer mount, which carries cartridge-copilot weight Phase 1
 * does not need. There is no cartridge underneath this shell, so the
 * embedded mount lives in its own flex column exactly as the canonical
 * pattern requires (never a standalone overlay slide-over — CLAUDE.md
 * "Wallet-Over-Cartridge Overlay" anti-pattern).
 *
 * Alongside the wallet, the shell renders the Phase 1 Timeline — a READ
 * over existing receipts via `resolveCompanionContext()` — and the T1
 * identity chip. NO browser observation of any kind (PRD §6 Phase 1 / §4):
 * nothing here reads tabs, pages, selections, history, or clipboard.
 *
 * WIDTH + SURFACE TOGGLE (2026-07-23, operator-directed, revised): this page
 * is the extension's "Manage permissions" surface, opened as a narrow
 * floating popup window beside whatever page the operator is browsing (see
 * `extension/companion-observer/popup.js`'s `openOrFocusCompanionWindow`) —
 * not a full-bleed standalone page. Originally built as two side-by-side
 * fixed-width panels (Companion rail + wallet), but at that combined width
 * the wallet was visibly cropped in the popup window. Revised to a SINGLE
 * `w-[23.25rem]` surface (`SmartWalletDrawer`'s own `embeddedWidth="fixed"`
 * class, reused rather than inventing a new width unit) that TOGGLES between
 * the wallet and the Companion rail (identity chip + Timeline + Observer
 * permissions) via a small segmented control at the top — never both at
 * once. Mirrors the canonical narrow embed pattern already established at
 * `app/(embed)/triad/embed/wallet/page.tsx`, and the toggle-between-modes
 * pattern `SmartWalletDrawer` already uses internally for its own
 * Copilot/MoneyPenny modes — same idea, one level up.
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

import { useCodexEmbedAuthBridge } from "../codex/_lib/useCodexEmbedAuthBridge";
import { resolveCompanionContext } from "@/services/companion/runtime";
import type { CompanionRuntimeContext } from "@/types/companion";
import { ObserverGrantPanel } from "@/components/companion/ObserverGrantPanel";

const SmartWalletDrawer = dynamic(
  () => import("@/app/components/content/SmartWalletDrawer"),
  { ssr: false }
);

const readFirst = (searchParams: URLSearchParams | null, keys: string[]) => {
  if (!searchParams) return undefined;
  for (const key of keys) {
    const value = searchParams.get(key);
    if (value && value.trim().length > 0) return value.trim();
  }
  return undefined;
};

function CompanionShell() {
  const searchParams = useSearchParams();
  const queryPersonaId = readFirst(searchParams, ["personaId"]);
  const queryAuthProfileId = readFirst(searchParams, [
    "authProfileId",
    "auth_profile_id",
  ]);

  const { personaId } = useCodexEmbedAuthBridge({
    initialPersonaId: queryPersonaId,
    initialAuthProfileId: queryAuthProfileId,
  });

  const [ctx, setCtx] = useState<CompanionRuntimeContext | null>(null);
  const [walletOpen, setWalletOpen] = useState(true);
  const [activeSurface, setActiveSurface] = useState<"wallet" | "companion">("wallet");

  useEffect(() => {
    let cancelled = false;
    resolveCompanionContext({
      surface: "web-embed",
      personaIdHint: personaId,
    }).then((resolved) => {
      if (!cancelled) setCtx(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [personaId]);

  const identity = ctx?.identity ?? null;

  return (
    <div className="flex h-screen min-h-0 justify-end bg-slate-950 text-slate-100">
      {/* Single narrow surface, right-anchored — toggles between the wallet
          and the Companion rail rather than showing both side by side. */}
      <div className="flex h-full w-[23.25rem] min-h-0 shrink-0 flex-col border-l border-slate-800 bg-slate-900/40">
        {/* Surface toggle — always visible regardless of which surface is
            active, so there's a way back from either side. */}
        <div className="flex shrink-0 items-center gap-1 border-b border-slate-800 bg-slate-900/60 px-2 py-1.5">
          <button
            type="button"
            onClick={() => setActiveSurface("wallet")}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              activeSurface === "wallet"
                ? "bg-slate-800 text-slate-100"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            Wallet
          </button>
          <button
            type="button"
            onClick={() => setActiveSurface("companion")}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              activeSurface === "companion"
                ? "bg-slate-800 text-slate-100"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            Companion
          </button>
        </div>

        {activeSurface === "wallet" ? (
          /* Embedded wallet — canonical embedded-mode mount (never overlay). */
          <div className="min-h-0 flex-1">
            {walletOpen ? (
              <SmartWalletDrawer
                open={true}
                onClose={() => setWalletOpen(false)}
                variant="embedded"
                embeddedWidth="fixed"
                allowWideLayout={false}
                agent={{ id: "companion", name: "metaMe Companion" }}
                codexMode={true}
                personaId={personaId}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <button
                  type="button"
                  onClick={() => setWalletOpen(true)}
                  className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-2 text-sm text-slate-200 shadow-lg transition-all hover:bg-slate-900/60"
                >
                  Open Wallet
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Companion rail — identity chip + Phase 1 Timeline (read-only) +
             Observer permissions. */
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-slate-800 px-4 py-3">
              <div className="text-sm font-semibold text-slate-200">
                metaMe Companion
              </div>
              {ctx === null ? (
                <div className="mt-1 text-xs text-slate-500">Resolving…</div>
              ) : identity ? (
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="truncate text-xs text-slate-300">
                    {identity.displayLabel || "Active persona"}
                  </span>
                  <span className="rounded-sm border border-slate-800 bg-slate-900/40 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {identity.identifiability}
                  </span>
                </div>
              ) : (
                <div className="mt-1 text-xs text-slate-500">
                  Signed out — open the wallet to continue with your Passport.
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Timeline
              </div>
              {ctx && ctx.feed.length > 0 ? (
                <ul className="space-y-2">
                  {ctx.feed.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
                    >
                      <div className="text-xs text-slate-200">{item.title}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                        <span>{item.kind}</span>
                        {item.cartridge ? <span>· {item.cartridge}</span> : null}
                        <span>· {new Date(item.occurredAt).toLocaleString()}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-slate-500">
                  {identity
                    ? "No receipted activity yet."
                    : "Sign in to see your receipted activity."}
                </div>
              )}

              {/* Observer permissions — PRD-MMC-IMPL-001 Increment 4. Mounts
                  only when identity is resolved, mirroring the Timeline
                  section's own `identity ?` conditional above: an
                  unauthenticated visitor sees no grant UI, fails closed like
                  every other part of this shell. No browser observation
                  happens here — this manages consent GRANTS only (PRD-MMC-001
                  §4 Phase 2; no observation source exists yet, plan §0.2). */}
              <div className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Observer permissions
              </div>
              {identity && personaId ? (
                <ObserverGrantPanel personaIdHint={personaId} />
              ) : (
                <div className="text-xs text-slate-500">
                  Sign in to manage what the Observer may see.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CompanionEmbedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-950">
          <div className="text-slate-300">Loading Companion…</div>
        </div>
      }
    >
      <CompanionShell />
    </Suspense>
  );
}
