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
import { PassportConnectPanel } from "@/components/companion/PassportConnectPanel";
import { UserRound, Wallet as WalletIcon, MessageCircle, Search, LayoutGrid, Layers, Activity, ShieldCheck } from "lucide-react";
import { personaFetch } from "@/utils/personaSpine";
import {
  resolveQuickLinks,
  quickLinkHref,
  quickLinkTarget,
  quickLinkContextNeedle,
  quickLinkSurfaceNeedle,
  quickLinkDomainNeedle,
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
  Activity,
  ShieldCheck,
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
  // D-9 RESOLVED: the activity rail is a nav ITEM now, not a chip-toggled
  // overlay, so its open state is just `activeNavItem === 'activity'`. Keeping
  // a separate `railOpen` flag beside it would be two sources of truth for one
  // question, and they would disagree the first time one was set without the
  // other — the Capsule/layout defect class CLAUDE.md warns about.

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
  /**
   * The header names WHO IS ACTING (operator, 2026-07-26): the citizen's
   * delegated aigentMe persona by default, their active persona when no
   * aigentMe is delegated, and the generic "Agent Me" only when neither
   * resolves. A generic label where a delegate exists hides the delegation —
   * the one fact the header exists to surface.
   */
  const [agentLabel, setAgentLabel] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!personaId) {
      setAccess(null);
      setAgentLabel(null);
      return;
    }
    (async () => {
      // Delegated aigentMe first — person-scoped, so it resolves whichever
      // owned persona sponsors it.
      try {
        const res = await personaFetch("/api/agents/aigentme", {
          cache: "no-store",
          personaIdHint: personaId,
        });
        if (res.ok) {
          const body = await res.json();
          const name = body?.agent?.display_name ?? body?.agent?.displayName;
          if (!cancelled && typeof name === "string" && name.trim()) {
            setAgentLabel(name.trim());
          }
        }
      } catch {
        // No delegate resolvable — the active-persona label below carries it.
      }
      try {
        const res = await personaFetch("/api/wallet/active-persona", {
          cache: "no-store",
          personaIdHint: personaId,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        // Fallback half of the label chain: only fills when no aigentMe won.
        if (typeof data?.displayLabel === "string" && data.displayLabel.trim()) {
          setAgentLabel((current) => current ?? data.displayLabel.trim());
        }
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

  /**
   * The observed page's shape, read from the SAME overlay route the Overlay
   * surface already renders — no new observation and no new permission. Null
   * whenever there is no live observation, no granted domain, or an
   * unrecognised one, which is the honest majority case.
   */
  const [observedShape, setObservedShape] = useState<string | null>(null);
  const [observedDomain, setObservedDomain] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!personaId) {
      setObservedShape(null);
      setObservedDomain(null);
      return;
    }
    (async () => {
      try {
        const res = await personaFetch("/api/companion/overlay", {
          cache: "no-store",
          personaIdHint: personaId,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setObservedShape(typeof data?.shape === "string" ? data.shape : null);
        // The host itself, for the operator-declared destination table. The
        // overlay route already returns it alongside the shape — no new
        // observation, no new permission (the domain is only present here when
        // the grant that produced it is still live).
        setObservedDomain(typeof data?.domain === "string" ? data.domain : null);
      } catch {
        // No observation available — quick links stay exactly as they are
        // without one. Context specialises the set; it never gates it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [personaId, activeNavItem]);

  const quickLinks = useMemo(
    () =>
      resolveQuickLinks({
        access,
        // Observer- AND surface-driven ranking (§6.1: shipped signals
        // informing a second surface). Gating still runs first and is
        // untouched — context can only reorder what the persona may already
        // see, never widen it.
        //
        // The observed page shape wins when it resolves, because it is the
        // stronger signal; the active surface carries the rest of the time.
        // Ranking on the shape ALONE was effectively inert: it abstains on
        // every unrecognised domain, which is nearly all of them.
        //
        // Precedence, strongest observation first: the asserted overlay SHAPE,
        // then the operator-declared destination for the observed HOST, then
        // the surface the citizen is on. The host table is what makes the
        // Overlay surface responsive on pages that have no Domain Profile —
        // `shapeForDomain` correctly abstains there, and abstention left the
        // strip frozen (operator, 2026-07-27).
        context:
          quickLinkContextNeedle(observedShape) ??
          quickLinkDomainNeedle(observedDomain) ??
          quickLinkSurfaceNeedle(activeSurface),
        limit: 6,
      }),
    [access, observedShape, observedDomain, activeSurface]
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
          const isActive = activeNavItem === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => {
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
    [activeNavItem]
  );

  /**
   * THE GATE IS NOW A DOOR (PRD-PAG-001 Amendment A, chartered 2026-07-26).
   *
   * Every gated surface used to end at "Sign in to …" — a conventional
   * sign-in wall standing between a citizen and the Passport that is supposed
   * to grant them access. That is the discontinuity Amendment A removes, so
   * the same surfaces now offer Passport-native Connect instead.
   *
   * One node for all of them: there is ONE way to establish a session here, and
   * five differently-worded prompts would only imply otherwise.
   */
  const connectGate = (
    <PassportConnectPanel
      // A session that did not exist a moment ago changes what every consumer
      // on this page resolves — the auth bridge, the spine reads, the copilot.
      // A reload is the honest way to let all of them re-resolve at once; a
      // partial refresh would leave some surfaces reading the old absence.
      onConnected={() => window.location.reload()}
    />
  );

  /** The submitted search query. Owned here because the COMPOSER collects it
   *  and the panel consumes it — neither can own it alone (D-12). */
  const [searchQuery, setSearchQuery] = useState("");

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
        {/* The Companion's own identity chip and bottom nav row are GONE
            (operator, 2026-07-26). Both were duplicates of controls the
            Copilot now owns: the persona moved into the copilot header beside
            the R/T dots (keeping its connected dot), and all seven nav items
            live in the copilot's menu row. Retiring them was gated on the
            copilot nav being reachable everywhere — which it is now that the
            copilot never unmounts, so §14.6 holds and nothing is stranded. */}
        {/* THE COPILOT IS THE SHELL, AND IT NEVER UNMOUNTS (§3.2, operator
            2026-07-26). Every surface renders into the copilot's `bodySlot`,
            so its menu row — the migrated navigation — persists exactly the way
            the Companion's own bar does. Before this, activating Search /
            Workspace / Overlay unmounted the copilot and took its nav with it,
            leaving no way back and forward between surfaces.

            Keeping it mounted also keeps the CONVERSATION alive across surface
            switches, so returning to Agent Me returns to the same session
            rather than a fresh one (D-8). */}
        <div className="min-h-0 flex-1">
          <CodexCopilotLayer
            isOpen={true}
            onClose={() => undefined}
            variant="embedded"
            className="h-full w-full"
            initialCopilotMode={copilotModeForNavItem(activeNavItem)}
            /* COPILOT → HOST half of the mode sync. The copilot's own footer
               toggles change its mode internally; without this echo the host's
               activeNavItem froze on whatever it last was, so after entering
               avatar via the toggle every nav click updated state into a
               surface the avatar branch never renders — the "menu breaks after
               avatar" report, third time (2026-07-26). One mode, two views,
               kept in agreement from both directions.

               CORRECTED 2026-07-27 (operator: "aigentMe link is not working to
               reload aigentMe copilot once moved off of it"). The chat branch
               used to return the CURRENT nav item unless it was `avatar`,
               written when avatar was the only way to be off the conversation.
               It is not: wallet, search, overlay, workspace, activity and
               permissions all render through `bodySlot`, which takes
               precedence over the copilot's own body. So from any of them,
               pressing Agent Me flipped the copilot's internal mode to chat
               while the host kept rendering the other surface on top — the
               button looked dead. `switchCopilotMode` fires ONLY from the two
               explicit footer toggles, never from `launchWallet` or any
               internal transition, so treating a chat emission as "take me
               back to the conversation" cannot yank the citizen off a surface
               they did not just leave. */
            onCopilotModeChange={(mode) => {
              setActiveNavItem((mode === "avatar" ? "avatar" : "agent-me"));
            }}
            /* QUICK LINKS as Class 2 Context Actions (§3.2.4/§3.2.5).
               Rendered through the copilot's OWN carousel — the single row
               above the composer that is already the standard here — rather
               than a bespoke strip in Companion chrome. That was the C3
               mistake: global chrome for something that is a conversational
               affordance.

               `skipInference` keeps them out of the model path: selecting one
               is a navigation act, not a question. `onPrompt` then DRIVES THE
               BROWSER — the destination opens in the left-hand workspace and
               the Companion stays put on the right. */
            quickPrompts={quickLinkPrompts}
            onPrompt={openQuickLink}
            /* Markdown / Mermaid rendering. `enableInferenceRendering` is
               opt-in and defaults to false, so without it assistant replies
               render as one raw string — the "solid blocks of text" the
               operator reported (2026-07-26). Every other copilot mount in the
               app passes it; the Companion was simply missing it. */
            enableInferenceRendering
            /* The wallet reached FROM THE COPILOT must be the same pane-width
               wallet the Companion's own Wallet item mounts. Before this, the
               copilot's wallet was hardcoded to the cartridge-sized column, so
               the same capability rendered at two different widths depending
               on which route reached it — operator report, 2026-07-26. */
            walletEmbeddedWidth="fill"
            walletAllowWideLayout={false}
            navExtras={copilotNavExtras}
            /* ONE answer to "which surface is showing". The copilot's own
               wallet button used to set only the copilot's internal panel
               state, which this host's `bodySlot` deliberately takes
               precedence over — so after visiting any other surface, pressing
               Wallet did nothing visible (operator, 2026-07-26: "wallet
               doesn't seem to work after the failing search button has been
               clicked"). Now the launch moves the host's surface too. */
            onWalletLaunch={() => setActiveNavItem("wallet")}
            /* The copilot IS the shell here, so its close chevron would be a
               dead control — the Companion's own chrome closes the panel. Only
               this host sets it; every other mount keeps the chevron, which is
               the only way to dismiss the copilot once opened. */
            hideCloseControl
            /* THE COMPOSER IS NOT UNIVERSAL CHROME. It belongs to Agent Me
               (where it is the prompt bar) and to Search (where it IS the
               search bar). On Wallet / Workspace / Overlay it would invite the
               citizen to type into something that will not answer. */
            hideComposer={activeSurface !== "agent-me" && activeSurface !== "search"}
            composerMode={activeSurface === "search" ? "search" : "chat"}
            onComposerSubmit={setSearchQuery}
            agent={{ id: "aigent-me", name: agentLabel ?? "Agent Me" }}
            personaId={personaId}
            bodySlot={activeSurface === "activity" ? (
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
                    : "Connect with your Passport to see your receipted activity."}
                </div>
              )}
            </div>
          </div>
        ) : activeSurface === "permissions" ? (
          /* Observer permissions — its OWN destination (operator, 2026-07-26).
             It used to render below the activity Timeline, so the control that
             decides what the Observer may see was reached by scrolling past a
             feed of what it had already seen. Consent is not an appendix to
             history. Same panel, same gate — only its home changed. */
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Observer permissions
              </div>
              {identity && personaId ? (
                <ObserverGrantPanel personaIdHint={personaId} />
              ) : (
                connectGate
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
            <CompanionSearchPanel personaIdHint={personaId} query={searchQuery} />
          ) : (
            connectGate
          )
        ) : activeSurface === "overlay" ? (
          /* Constitutional Overlay — PRD-MMC-IMPL-002 Increment 2. Mounts
             only when identity is resolved, mirroring every other gated
             surface in this shell. */
          identity && personaId ? (
            <CompanionOverlayPanel personaIdHint={personaId} />
          ) : (
            connectGate
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
            connectGate
          )
        ) : null}
          />
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
