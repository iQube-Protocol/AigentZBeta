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
 * COMPANION 1.1 (SCOPE-MMC-004, 2026-07-26) — RECONSTITUTED AROUND AGENT ME.
 * The Companion is now a HOST for Agent Me rather than a surface with its own
 * conversational interface (§3: "Agent Me is the Companion"). Three changes,
 * all reorganisation — no new capability (§6.1):
 *   1. `CodexCopilotLayer variant="embedded"` mounts AS the Agent Me runtime,
 *      full width, and is the DEFAULT surface (§4.1, C1). It is the existing
 *      copilot — no second chat implementation exists or may exist.
 *   2. The top segmented control becomes CANONICAL BOTTOM NAVIGATION derived
 *      from `services/companion/companionNavigation.ts` (§4.3, D-3): one
 *      shared vocabulary, presentation adapting by surface density. Wallet is
 *      now a peer mode beside Agent Me, not a separate application.
 *   3. `Avatar` is NOT a parallel surface. It selects Agent Me and enters the
 *      copilot's own avatar mode (D-8) — voice, text and avatar share one
 *      session, with no avatar-specific memory, model or context.
 * The pre-1.1 `companion` rail (identity chip, Timeline, Observer
 * permissions) has no slot in the ratified six-item vocabulary. Its content is
 * PRESERVED and still reachable from the header's identity chip so nothing is
 * lost (§14.6); where it belongs permanently is SCOPE-MMC-004 D-9.
 *
 * WIDTH + SURFACE TOGGLE (2026-07-23, operator-directed, twice-revised):
 * this page is the extension's "Manage permissions" surface, opened as a
 * floating popup window dedicated solely to it (see
 * `extension/companion-observer/popup.js`'s `openOrFocusCompanionWindow`) —
 * not a full-bleed standalone page, and never sharing a viewport with
 * anything else. History of the two revisions:
 *   1. Originally two side-by-side fixed-width panels (Companion rail +
 *      wallet) — at that combined width the wallet was visibly cropped in
 *      the popup window.
 *   2. Revised to a SINGLE `w-[23.25rem]` surface that TOGGLES between the
 *      wallet and the Companion rail (identity chip + Timeline + Observer
 *      permissions) via a small segmented control at the top — never both
 *      at once. But the fixed rem width didn't exactly match the popup
 *      window's actual content-area size (a small buffer intentionally
 *      added to the window's requested width, to avoid clipping, showed up
 *      as a visible gap instead once content and window stopped matching
 *      pixel-for-pixel).
 * Now: the outer container and `SmartWalletDrawer` (`embeddedWidth="fill"`)
 * both simply fill whatever width the host window actually provides —
 * correct by construction regardless of platform-specific window-chrome
 * insets, since this page never needs to share space with anything wider.
 * The toggle-between-modes idea itself mirrors the pattern `SmartWalletDrawer`
 * already uses internally for its own Copilot/MoneyPenny modes — same idea,
 * one level up.
 */

"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

import { useCodexEmbedAuthBridge } from "../codex/_lib/useCodexEmbedAuthBridge";
import { resolveCompanionContext } from "@/services/companion/runtime";
import {
  parseCompanionSurfaceKind,
  type CompanionRuntimeContext,
} from "@/types/companion";
import { ObserverGrantPanel } from "@/components/companion/ObserverGrantPanel";
import { CompanionSearchPanel } from "@/components/companion/CompanionSearchPanel";
import { CompanionOverlayPanel } from "@/components/companion/CompanionOverlayPanel";
import { CaptureInboxPanel } from "@/components/companion/CaptureInboxPanel";
import { UserRound, Wallet as WalletIcon, MessageCircle, Search, LayoutGrid, Layers } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import {
  resolveQuickLinks,
  quickLinkHref,
  quickLinkTarget,
  type QuickLinkAccessContext,
} from "@/services/companion/quickLinks";
import {
  COMPANION_NAV_ITEMS,
  COMPANION_NAV_LABEL,
  COMPANION_NAV_ICON,
  COMPANION_NAV_ITEM_TO_SURFACE,
  COMPANION_PRIMARY_NAV_ITEM,
  COMPANION_NAV_DENSITY_CLASS,
  copilotModeForNavItem,
  migratedNavItems,
  navDensityForSurface,
  type CompanionNavItemId,
} from "@/services/companion/companionNavigation";

// Named export, not default — `dynamic` needs the component picked out.
const CodexCopilotLayer = dynamic(
  () =>
    import("@/app/components/codex/CodexCopilotLayer").then(
      (m) => m.CodexCopilotLayer
    ),
  { ssr: false }
);

const SmartWalletDrawer = dynamic(
  () => import("@/app/components/content/SmartWalletDrawer"),
  { ssr: false }
);

/**
 * Resolves the nav vocabulary's icon NAMES to components (D-10). The mapping
 * lives in `companionNavigation.ts` as names so that module stays React-free
 * and node-side canaries can import it; this record is the one place those
 * names become components.
 */
const NAV_ICON_COMPONENT: Record<string, typeof UserRound> = {
  UserRound,
  Wallet: WalletIcon,
  MessageCircle,
  Search,
  LayoutGrid,
  Layers,
};

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

  // Runtime registration (SPEC-MMC-003 §3.6): which Companion surface is
  // hosting this embed. The extension's side panel passes
  // `?surface=extension-sidebar` (see extension/companion-observer/
  // sidepanel.js) — before this, the page hardcoded 'web-embed' even when
  // mounted inside the extension, so the runtime could not tell the two
  // apart. Validated against the canonical COMPANION_SURFACE_KINDS list;
  // absent or unrecognised falls back to 'web-embed', the value this page
  // always used.
  const surface =
    parseCompanionSurfaceKind(readFirst(searchParams, ["surface"])) ?? "web-embed";

  const { personaId } = useCodexEmbedAuthBridge({
    initialPersonaId: queryPersonaId,
    initialAuthProfileId: queryAuthProfileId,
  });

  const [ctx, setCtx] = useState<CompanionRuntimeContext | null>(null);
  const [walletOpen, setWalletOpen] = useState(true);
  // Companion 1.1 (§4.1, C1): AGENT ME is the default. The Companion is a host
  // for Agent Me, so the citizen lands in the conversation, not beside it.
  // (Wallet was the pre-1.1 default because it was the sign-in surface; it is
  // now a peer mode one tap away, and sign-in is still reachable from every
  // gated surface's prompt.)
  const [activeNavItem, setActiveNavItem] = useState<CompanionNavItemId>(
    COMPANION_PRIMARY_NAV_ITEM
  );
  // The pre-1.1 rail has no slot in the ratified six-item vocabulary (D-9).
  // Its content is preserved and opened from the identity chip, so §14.6's
  // "no capability lost" holds while the placement question stays open.
  const [railOpen, setRailOpen] = useState(false);

  const activeSurface = COMPANION_NAV_ITEM_TO_SURFACE[activeNavItem];
  const density = navDensityForSurface(surface);
  const densityClass = COMPANION_NAV_DENSITY_CLASS[density];

  useEffect(() => {
    let cancelled = false;
    resolveCompanionContext({
      surface,
      personaIdHint: personaId,
    }).then((resolved) => {
      if (!cancelled) setCtx(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [personaId, surface]);

  // Quick Link access context (C3). Read from the spine's own T1 surface via
  // `personaFetch` with the SAME personaIdHint every other panel uses — one
  // transport, one resolved persona (§8.2). `null` until it resolves, which
  // the gate treats as "offer ungated links only" rather than as "no
  // privileges": fail closed while unknown.
  const [access, setAccess] = useState<QuickLinkAccessContext | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!personaId) {
      setAccess(null);
      return;
    }
    (async () => {
      try {
        const res = await personaFetch("/api/wallet/active-persona", {
          cache: "no-store",
          personaIdHint: personaId,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setAccess({
          isAdmin: Boolean(data?.cartridgeFlags?.isAdmin),
          isPartner: Boolean(data?.cartridgeFlags?.isPartner),
          adminCartridges: Array.isArray(data?.cartridgeFlags?.adminCartridges)
            ? data.cartridgeFlags.adminCartridges.filter(
                (slug: unknown): slug is string => typeof slug === "string"
              )
            : [],
        });
      } catch {
        // Leave `access` null — the gate offers ungated links only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [personaId]);

  const quickLinks = useMemo(
    () => resolveQuickLinks({ access, limit: 6 }),
    [access]
  );

  /** The copilot's own carousel shape. Labels are the visible affordance. */
  const quickLinkPrompts = useMemo(
    () =>
      quickLinks.map((link) => ({
        id: link.id,
        label: link.label,
        prompt: link.label,
        skipInference: true,
      })),
    [quickLinks]
  );

  /**
   * Selecting a Quick Link opens it in the BROWSER, never in the Companion.
   * Matched back by label through a map rather than a scan, so two links that
   * happened to share a label could not silently open the wrong destination.
   */
  const quickLinkByLabel = useMemo(
    () => new Map(quickLinks.map((link) => [link.label, link])),
    [quickLinks]
  );
  const openQuickLink = useCallback(
    (prompt: string) => {
      const link = quickLinkByLabel.get(prompt);
      if (!link) return;
      window.open(quickLinkHref(link, personaId), quickLinkTarget(), "noreferrer");
    },
    [quickLinkByLabel, personaId]
  );

  /**
   * MIGRATION OF THE REMAINING BUTTONS INTO THE COPILOT MENU (operator,
   * 2026-07-26). §3.2: the Copilot is the shell, so surface switches belong in
   * its own menu row rather than a strip beneath it. Avatar, Agent Me and
   * Wallet are already there natively, so only the rest migrate — derived,
   * never listed, so the split cannot drift from the vocabulary.
   *
   * The bottom row is deliberately KEPT for now, per the operator: "you can
   * keep them in both rows if you want until we test they are working in the
   * copilot menu before retiring the bottom row." Retiring it is a separate,
   * evidence-led step — not something to do speculatively in the same change
   * that introduces the replacement.
   */
  const copilotNavExtras = useMemo(
    () => (
      <>
        {migratedNavItems().map((item) => {
          const label = COMPANION_NAV_LABEL[item];
          const Icon = NAV_ICON_COMPONENT[COMPANION_NAV_ICON[item]];
          const isActive = !railOpen && activeNavItem === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => {
                setRailOpen(false);
                setActiveNavItem(item);
              }}
              title={label}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-lg p-1.5 ring-1 ring-white/10 transition-colors ${
                isActive
                  ? "bg-slate-800 text-slate-100"
                  : "text-slate-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : label}
            </button>
          );
        })}
      </>
    ),
    [activeNavItem, railOpen]
  );

  const identity = ctx?.identity ?? null;

  return (
    <div className="flex h-screen min-h-0 bg-slate-950 text-slate-100">
      {/* Single surface, fills whatever width the host window actually is —
          this page is now ALWAYS hosted in a popup window dedicated solely
          to it (extension/companion-observer/popup.js's
          openOrFocusCompanionWindow), never sharing a viewport with
          anything wider, so there's no reason to clamp to a fixed rem width
          and hope it happens to match the window's real content-area size
          (it didn't — a small buffer added to the popup window's requested
          width, to avoid clipping, showed up as a visible gap instead once
          the window and this fixed width stopped matching exactly). Filling
          the container completely removes that class of mismatch entirely,
          regardless of platform-specific window-chrome insets. */}
      <div className="flex h-full min-h-0 w-full flex-col bg-slate-900/40">
        {/* Identity chip — persistent header. Opens the pre-1.1 rail
            (Timeline + Observer permissions), whose permanent home under the
            six-item vocabulary is D-9. */}
        <button
          type="button"
          onClick={() => setRailOpen((open) => !open)}
          className="flex shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-900/60 px-3 py-2 text-left transition-colors hover:bg-slate-900"
        >
          <span
            className={`h-2 w-2 rounded-full ${identity ? "bg-emerald-400" : "bg-slate-600"}`}
          />
          <span className="truncate text-xs text-slate-300">
            {ctx === null
              ? "Resolving…"
              : identity
                ? identity.displayLabel || "Active persona"
                : "Signed out"}
          </span>
          <span className="ml-auto text-[10px] text-slate-500">
            {railOpen ? "Hide activity" : "Activity"}
          </span>
        </button>

        {railOpen ? (
          /* Pre-1.1 rail, preserved verbatim (§14.6): Timeline + Observer
             permissions. Reached from the identity chip because the ratified
             six-item vocabulary has no slot for it — D-9 decides its home. */
          <div className="flex min-h-0 flex-1 flex-col">
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
        ) : activeSurface === "wallet" ? (
          /* Embedded wallet — canonical embedded-mode mount (never overlay). */
          <div className="min-h-0 flex-1">
            {walletOpen ? (
              <SmartWalletDrawer
                open={true}
                onClose={() => setWalletOpen(false)}
                variant="embedded"
                embeddedWidth="fill"
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
        ) : activeSurface === "search" ? (
          /* Universal Search — PRD-MMC-IMPL-002 Increment 1. Mounts only
             when identity is resolved, mirroring the Companion rail's own
             `identity && personaId ?` gate below: an unauthenticated
             visitor sees a sign-in prompt, fails closed like every other
             part of this shell. */
          identity && personaId ? (
            <CompanionSearchPanel personaIdHint={personaId} />
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-xs text-slate-500">
              Sign in to search across research, the registry, and the
              capability graph.
            </div>
          )
        ) : activeSurface === "overlay" ? (
          /* Constitutional Overlay — PRD-MMC-IMPL-002 Increment 2. Mounts
             only when identity is resolved, mirroring every other gated
             surface in this shell. */
          identity && personaId ? (
            <CompanionOverlayPanel personaIdHint={personaId} />
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-xs text-slate-500">
              Sign in to see the Constitutional Overlay for this page.
            </div>
          )
        ) : activeSurface === "workspace" ? (
          /* Workspace — Movement I (Capture), PRD-MMC-IMPL-003. This is the
             fifth companion surface: the Constitutional Flow's landing point
             INSIDE the extension itself, not a link out to the full app's
             myCluster nav (operator correction, 2026-07-24 — the whole point
             of Constitutional Flow is that the extension IS where captured
             material from the legacy internet gets reviewed and organized,
             never a detour to a different app surface). Named "Workspace"
             to match SPEC-MMC-001's own terminology throughout ("Workspace
             is the membrane every incoming object passes through", §4/§6)
             and PRD-MMC-IMPL-003's "Workspace Inbox" naming -- corrected
             same day after this surface first shipped under a different,
             invented label.
             Mounts the SAME CaptureInboxPanel MyWorkspaceTab's Inbox sub-tab
             uses (composition, not duplication) — an assigned capture still
             shows up in myLedger too, both are views over the same server
             state. Mounts only when identity is resolved, mirroring every
             other gated surface here. */
          identity && personaId ? (
            <CaptureInboxPanel personaIdHint={personaId} />
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-xs text-slate-500">
              Sign in to see what you've pulled across from the web.
            </div>
          )
        ) : (
          /* AGENT ME — the primary occupant (§4.1, C1). This is the EXISTING
             `CodexCopilotLayer`, mounted embedded at the Companion's full
             width. No second chat implementation exists here, and none may:
             §4.1's "no duplicate chat implementations" is what makes the
             single constitutional relationship true rather than merely
             claimed.

             `initialCopilotMode` selects between the copilot's OWN two modes.
             The Avatar nav item routes here with mode 'avatar' — the avatar is
             another renderer of this same session, never a second Agent Me
             (D-8). */
          <div className="min-h-0 flex-1">
            <CodexCopilotLayer
              isOpen={true}
              onClose={() => undefined}
              variant="embedded"
              className="h-full w-full"
              initialCopilotMode={copilotModeForNavItem(activeNavItem)}
              /* QUICK LINKS as Class 2 Context Actions (§3.2.4/§3.2.5).
                 Rendered through the copilot's OWN `quickPrompts` carousel —
                 the single row above the composer that is already the standard
                 here — rather than a bespoke strip in Companion chrome. That
                 was the C3 mistake: global chrome for something that is a
                 conversational affordance.

                 `skipInference` keeps them out of the model path: selecting one
                 is a navigation act, not a question. `onPrompt` then DRIVES THE
                 BROWSER — the destination opens in the left-hand workspace and
                 the Companion stays put on the right. */
              quickPrompts={quickLinkPrompts}
              onPrompt={openQuickLink}
              /* The wallet reached FROM THE COPILOT must be the same
                 pane-width wallet the Companion's own Wallet item mounts
                 (`embeddedWidth="fill"`, `allowWideLayout={false}`). Before
                 this, the copilot's wallet was hardcoded to the cartridge-
                 sized column, so the same capability rendered at two
                 different widths depending on which route reached it —
                 operator report, 2026-07-26. */
              walletEmbeddedWidth="fill"
              walletAllowWideLayout={false}
              navExtras={copilotNavExtras}
              agent={{ id: "aigent-me", name: "Agent Me" }}
              personaId={personaId}
            />
          </div>
        )}

        {/* CANONICAL BOTTOM NAVIGATION (§4.3, D-3).
            Rendered FROM the shared vocabulary — never a local list, so the
            item set cannot drift between Runtime, Companion and partner
            surfaces. Only `densityClass` varies by host: spacing, never
            content, order or naming. */}
        <nav
          aria-label="Companion navigation"
          className={`flex shrink-0 items-center justify-between border-t border-slate-800 bg-slate-900/60 ${densityClass.bar}`}
        >
          {COMPANION_NAV_ITEMS.map((item) => {
            const isActive = !railOpen && activeNavItem === item;
            const label = COMPANION_NAV_LABEL[item];
            const Icon = NAV_ICON_COMPONENT[COMPANION_NAV_ICON[item]];
            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setRailOpen(false);
                  setActiveNavItem(item);
                }}
                aria-current={isActive ? "page" : undefined}
                /* D-10: icon + tooltip. `title` gives the hover tooltip and
                   `aria-label` the accessible name — an icon-only control with
                   neither is unusable with a screen reader, and §4.3's "never
                   has to relearn navigation" only holds if the words behind
                   the icons stay stable. */
                title={label}
                aria-label={label}
                className={`flex flex-1 items-center justify-center rounded-md transition-colors ${densityClass.item} ${
                  isActive
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : label}
              </button>
            );
          })}
        </nav>
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
