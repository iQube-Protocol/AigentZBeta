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
 * WIDTH (2026-07-23, operator-directed): this page is the extension's
 * "Manage permissions" surface, meant to sit as a narrow docked overlay
 * beside whatever page the operator is browsing (mirroring metame.live's
 * own narrow-docked wallet treatment, an operator-supplied reference
 * screenshot) — not stretch full-bleed like a standalone page. The
 * Companion rail and the wallet are both pinned to the SAME fixed width
 * (`w-[23.25rem]`, `SmartWalletDrawer`'s own `embeddedWidth="fixed"` class —
 * reused rather than inventing a new width unit) and the whole two-column
 * shell is right-anchored (outer flex container `justify-end` around an
 * inner `w-fit` wrapper) so it never stretches to fill a wide viewport.
 * Mirrors the canonical narrow embed pattern already established at
 * `app/(embed)/triad/embed/wallet/page.tsx`.
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
      {/* Narrow docked shell — Companion rail + wallet pinned to the SAME
          fixed width (SmartWalletDrawer's own w-[23.25rem] class) and
          right-anchored, so the whole thing reads as a compact overlay
          beside the operator's current page rather than a full-bleed
          standalone page. */}
      <div className="flex h-full w-fit min-h-0">
      {/* Companion rail — identity chip + Phase 1 Timeline (read-only) */}
      <div className="flex w-[23.25rem] shrink-0 flex-col border-r border-slate-800 bg-slate-900/40">
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

      {/* Embedded wallet — canonical embedded-mode mount (never overlay).
          `embeddedWidth="fixed"` matches the rail's own w-[23.25rem] so the
          two panels read as one compact, equal-width docked strip. */}
      <div className="min-h-0 w-[23.25rem] shrink-0">
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
