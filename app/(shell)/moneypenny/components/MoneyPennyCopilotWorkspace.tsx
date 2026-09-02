/**
 * MoneyPennyCopilotWorkspace — C1 (2026-09-02, SPEC-MPY-002 shared-shell
 * directive): "persistent copilot left, chips/capsules and working
 * surfaces right," reusing the SAME split-pane pattern DevOn
 * (`DevCommandCenterTab.tsx`) and Agent Me (`AigentMeWelcomeSplitTab.tsx`)
 * already use — `SmartTriadCopilotLayer` (`variant="panel"`) as the LEFT
 * pane, never a fork or a second copilot implementation. (Confirmed by
 * direct investigation: `CodexCopilotLayer.tsx`, referenced by CLAUDE.md's
 * "Wallet-Over-Cartridge Overlay" section, is a SEPARATE, cartridge-wide
 * floating chat bubble — not the component DevOn/Agent Me use for their
 * persistent split-pane. `SmartTriadCopilotLayer` is.)
 *
 * The RIGHT pane is the EXISTING `MoneyPennyShell` (capability rail +
 * whichever of the 14 panels is active) — UNCHANGED, not forked, not
 * rebuilt as a new capsule/layout-registry system. This is what "preserve
 * the existing MoneyPenny capabilities behind that shell, with
 * compatibility routes for current entry points" means concretely: every
 * existing `moneypenny-codex` tab / `buildCodexUrl('moneypenny', {tab})`
 * deep link still resolves to the exact same panel component it always
 * did (see MoneyPennyPanelTab.tsx, the single dispatcher this workspace
 * now wraps) — only the copilot now flanks it on the left.
 *
 * Financial-profile <-> Operate connection: because MoneyPennyPanelTab.tsx
 * is the ONE dispatch point every moneypenny-codex entry point already
 * goes through (including the fs-operate stage's "Open MoneyPenny" link,
 * FinancialSovereigntyOperateStage.tsx's buildCodexUrl('moneypenny', ...)),
 * wrapping it here gives every entry point — Operate included — the same
 * copilot-flanked workspace for free, no per-entry-point change needed.
 *
 * Ground context <-> financial profile: when the active panel is
 * 'financial-profile', this component fetches the persona's current
 * FinancialProfileQube summary (the SAME GET /api/moneypenny/
 * financial-profile route FinancialProfilePanel.tsx itself reads) and
 * forwards a small, T1-safe summary (never raw aggregates/PII beyond what
 * FinancialProfilePanel already renders visibly) as `groundContext` — so a
 * message sent AFTER editing/computing the profile in the right pane
 * carries the fresh state to the copilot. Refetches on mount and whenever
 * the tab regains focus (`visibilitychange`) — a lightweight, real proxy
 * for "the operator just came back to look" without invasive prop
 * plumbing into FinancialProfilePanel.tsx itself (unchanged, per "preserve
 * the existing MoneyPenny capabilities").
 *
 * Standalone `/moneypenny` route (`MoneyPennyCartridge.tsx`, the flat
 * ten-tab interface) is NOT touched — it stays its own separate,
 * deliberately-untouched shell (per MoneyPennyShell.tsx's own header
 * comment), out of scope for this codex-tab-only slice.
 *
 * Copilot-to-capsule loop (C-02, added 2026-09-02 during reconciliation
 * against the authoritative Cartridge spec — MoneyPenny_Cartridge_Spec_v1.md):
 * `quickPrompts` + `onSuggestedLayouts` extend the SAME registered
 * `ChipTargetId`/`SuggestedLayoutHint` system DevOn/Agent Me use
 * (`app/api/codex/chat/route.ts`), with financial layout ids added there —
 * never a parallel suggestion system. A suggestion only lights a banner the
 * operator clicks (Companion Menu invariant MS-5: a deliberate act
 * outranks an ambient observation); the click itself navigates through
 * `tryOpenInMountedCartridge`, the SAME seam `MoneyPennyCapabilityRail.tsx`
 * already uses, so the codex tab framework stays the single owner of which
 * panel is active (MS-2).
 *
 * Full-screen trading takeover (C-01, added 2026-09-02): provides
 * `MoneyPennyFullScreenContext` so a panel (today: `HFTConsole.tsx`'s
 * existing disclosed simulation — reused, not replaced) can request an
 * in-frame expansion. The copilot pane and narrow-view toggle are hidden
 * via CSS (never unmounted, matching the SAME pattern the C-01 narrow-width
 * toggle already established), so conversation history and task state
 * survive the takeover; Escape or the exit control restores the prior
 * layout exactly. Environment and acting-agent name are threaded through
 * the context so they "remain accessible" during the takeover per C-01,
 * not merely restored afterward.
 *
 * Return navigation (entry-continuity verification, 2026-09-02): every
 * `buildCodexUrl` caller can pass `from`/`fromTab` — the platform's
 * existing, canonical "Source slug — used as ?from= for breadcrumb
 * back-links" mechanism (utils/codex-nav.ts's own doc comment) — and this
 * component renders a real breadcrumb back-link from them when present.
 * `FinancialSovereigntyOperateStage.tsx`'s existing "Open MoneyPenny" link
 * does NOT set `from` — it is a Journey Spine STAGE, not a codex/cartridge,
 * so it has no real codex slug to offer a breadcrumb link to (inventing
 * one would violate this repo's No-Guessing rule). For that case, and any
 * other entry that doesn't set `from`, a generic browser-history "Back"
 * falls back to `window.history.back()` — correct regardless of hosting
 * context (embed iframe or full page) with no source-slug knowledge
 * required. Verified this turn: Agent Me currently has NO wired entry
 * point into this workspace at all (`MoneyPennyFocusLayout.tsx` is an
 * unrelated Guided-Journey disposition-recording ceremony capsule, not
 * navigation) — not built in this pass; see this session's own report for
 * why (AigentMeWelcomeSplitTab.tsx/SpecialistsLayout.tsx are both
 * CLAUDE.md PARAMOUNT-flagged fragile files with documented regression
 * history, not a file to extend without a dedicated, focused slice).
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Minimize2 } from 'lucide-react';
import { SmartTriadCopilotLayer, type SuggestedLayoutHint } from '@/components/smarttriad/copilot/SmartTriadCopilotLayer';
import { MoneyPennyShell } from './MoneyPennyShell';
import { tryOpenInMountedCartridge, getCartridge } from '@/services/cartridge/CartridgePresenceRegistry';
import { buildCodexUrl } from '@/utils/codex-nav';
import { MONEYPENNY_CAPABILITY_GROUPS } from './moneypennyCapabilities';
import { MoneyPennyFullScreenProvider, type MoneyPennyFullScreenValue } from './MoneyPennyFullScreenContext';
import { fetchFinancialProfileSummary, type FinancialProfileSummary } from '@/services/moneypenny/financialProfileSummary';
import {
  computeContextVersionKey,
  isResponseContextStale,
  type MoneyPennyContextVersion,
  type MoneyPennyEnvironment,
} from '@/services/moneypenny/contextVersioning';
import type { MoneyPennyPanelKey } from '@/app/triad/components/codex/tabs/MoneyPennyPanelTab';

const MONEYPENNY_CODEX_ID = 'moneypenny-codex';
// Entry continuity (2026-09-02) — the metaMe codex's real MoneyPenny mirror
// tab (data/codex-configs.ts's `metame-moneypenny-orchestration` config,
// slug 'moneypenny-orchestration') and its 'aigentMe' sibling tab (slug
// 'aigent-me'). When this workspace is reached through that mirror (from
// SpecialistsLayout's "Open MoneyPenny workspace" button, added this pass),
// `metame-codex` is still registered in the CartridgePresenceRegistry —
// checked below to offer a precise, same-codex "Back to aigentMe" tab
// switch in priority over the generic ?from=/browser-history fallback.
const METAME_CODEX_ID = 'metame-codex';
const AIGENTME_TAB_SLUG = 'aigent-me';

/**
 * The subset of MoneyPennyPanelKey values registered as SuggestedLayoutHint
 * ids (see route.ts's ChipTargetId + LAYOUT_TAG_IDS/LAYOUT_KEYWORDS, and
 * SmartTriadCopilotLayer's SuggestedLayoutHint.layoutId). Derived from the
 * SAME capability-group source of truth the rail uses (moneypennyCapabilities.ts)
 * rather than hand-duplicating labels — 'chat' and null-panel items are
 * excluded since they are not registered layout ids.
 */
const SUGGESTABLE_PANEL_LABELS: Partial<Record<MoneyPennyPanelKey, string>> = Object.fromEntries(
  MONEYPENNY_CAPABILITY_GROUPS.flatMap((g) => g.items)
    .filter((item): item is typeof item & { panel: MoneyPennyPanelKey } => item.panel !== null && item.panel !== 'chat')
    .map((item) => [item.panel, item.label]),
);

const MONEYPENNY_QUICK_PROMPTS = [
  { id: 'mpy-financial-profile', label: 'Review my financial profile', prompt: 'Can you help me review my financial profile — what statements or manual entry do I need?' },
  { id: 'mpy-risk-envelope', label: 'Check my risk envelope', prompt: 'What does my current risk envelope and trading limits look like?' },
  { id: 'mpy-portfolio', label: 'Show my portfolio', prompt: 'Give me an overview of my portfolio and recent performance.' },
  { id: 'mpy-market-console', label: 'Open the market console', prompt: 'Show me quotes, spread and liquidity in the market console.' },
];

function readStoredPersonaId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem('currentPersonaId') ?? undefined;
  } catch {
    return undefined;
  }
}

export interface MoneyPennyCopilotWorkspaceProps {
  activePanel: MoneyPennyPanelKey;
  children: React.ReactNode;
}

export function MoneyPennyCopilotWorkspace({ activePanel, children }: MoneyPennyCopilotWorkspaceProps) {
  const [personaId, setPersonaId] = useState<string | undefined>(undefined);
  // Return navigation (entry-continuity, 2026-09-02) — see this file's own
  // header comment for the two supported paths (slug breadcrumb vs.
  // generic browser-history fallback).
  const searchParams = useSearchParams();
  const fromSlug = searchParams.get('from');
  const fromTab = searchParams.get('fromTab');
  const [financialProfileGround, setFinancialProfileGround] = useState<FinancialProfileSummary | null>(null);
  const groundContextRef = useRef<Record<string, unknown> | null>(null);
  // C-02 copilot-to-capsule loop: a suggested panel from the copilot's
  // [layout:<id>|<substance>] tag or keyword sweep. Deliberately NOT
  // auto-navigated — per this codebase's own Companion Menu invariant MS-5
  // ("a deliberate act outranks an ambient observation"), a suggestion only
  // lights an affordance the operator clicks; navigation itself goes
  // through the SAME tryOpenInMountedCartridge seam the capability rail
  // already uses, so the codex tab framework stays the single owner of
  // "which panel is active" (MS-2 — no second, parallel state authority).
  const [suggestedPanel, setSuggestedPanel] = useState<MoneyPennyPanelKey | null>(null);
  // C-01 narrow-width Conversation/Workspace toggle. Both panes stay
  // mounted at every width — this only controls which is VISIBLE below
  // the `lg` breakpoint (see the render below) — so switching views never
  // loses conversation history or task/panel state.
  const [narrowView, setNarrowView] = useState<'conversation' | 'workspace'>('conversation');
  // C-01 full-screen trading/analysis takeover. Both panes stay mounted —
  // same visibility-only-toggle pattern as narrowView above — so the
  // takeover never loses conversation history or task state, and Escape
  // restores exactly the layout (pane ratio, narrowView) that was active
  // before entering.
  const [isFullScreen, setIsFullScreen] = useState(false);

  // SC-04 — execution environment is real state (never hardcoded), so
  // C-11/C-12's future simulation/live UI plugs directly into this same
  // version tuple. No toggle is exposed yet: no simulation/live control
  // exists anywhere in MoneyPenny today (C-11/C-12 NOT STARTED per the
  // acceptance crosswalk), and building one here would be speculative,
  // out-of-scope UI for a versioning slice. Defaults to the safe value.
  const [environment] = useState<MoneyPennyEnvironment>('simulation');
  // Bumped each time the financial-profile ground snapshot is successfully
  // refetched with new data — a profile revision invalidates an in-flight
  // request's response even when panel/persona/environment are unchanged.
  const profileRevisionRef = useRef(0);
  // SC-04 monotonic context generation (2026-09-02 hardening). Bumped on
  // EVERY context-relevant event — a new request dispatch, a panel change,
  // a persona change, an environment change, a profile revision — and
  // NEVER decreases or repeats a prior value. This is what makes two tasks
  // on the same panel distinguishable (each dispatch gets its own
  // generation) and what closes the A -> B -> A hole a bare value-equality
  // tuple has (leaving A and returning to A both bump it, so a stale
  // response captured on the FIRST visit can never match the CURRENT
  // generation after a round trip, even though panel/persona/environment/
  // profileRevision may otherwise read identically to before).
  const generationRef = useRef(0);
  // The context version captured (via onRequestContext, below) for
  // whichever request is currently in flight — compared against the
  // CURRENT version when its response arrives.
  const pendingRequestVersionRef = useRef<string | null>(null);

  useEffect(() => {
    setPersonaId(readStoredPersonaId());
  }, []);

  // Context-relevant changes bump the generation — see generationRef's own
  // comment. Deliberately separate effects (not one with all three deps)
  // so each axis's change is independently attributable if ever debugged.
  useEffect(() => { generationRef.current += 1; }, [activePanel]);
  useEffect(() => { generationRef.current += 1; }, [personaId]);
  useEffect(() => { generationRef.current += 1; }, [environment]);

  // The operator already navigated (via the rail, a deep link, or this
  // suggestion itself) — clear any stale suggestion for the panel just left.
  useEffect(() => {
    setSuggestedPanel((prev) => (prev === activePanel ? null : prev));
  }, [activePanel]);

  // C-01 full-screen takeover: Escape restores the earlier layout exactly
  // (isFullScreen back to false; pane ratio, narrowView and conversation
  // are untouched since neither pane was ever unmounted).
  useEffect(() => {
    if (!isFullScreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullScreen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isFullScreen]);

  const fullScreenContextValue: MoneyPennyFullScreenValue = useMemo(
    () => ({
      isFullScreen,
      enterFullScreen: () => setIsFullScreen(true),
      exitFullScreen: () => setIsFullScreen(false),
      environment,
      agentName: 'MoneyPenny',
    }),
    [isFullScreen, environment],
  );

  const handleRequestContext = useCallback(() => {
    // SC-04 task identity — a NEW request dispatch is itself a
    // context-relevant event: it must be distinguishable from any earlier
    // task on the same panel, even one still in flight. Bump FIRST, then
    // capture the fresh POST-bump generation as this request's own
    // identity — capturing the stale PRE-bump value here would make every
    // response look artificially stale against itself, since
    // computeCurrentVersionKey() at response-time always reads the
    // POST-bump generation onward. Recomputed from current closure state
    // rather than read back from the groundContext payload, since the
    // groundContext embedded at render time necessarily used the PRE-bump
    // generation (render happens before any send).
    generationRef.current += 1;
    pendingRequestVersionRef.current = computeContextVersionKey({
      generation: generationRef.current,
      panel: activePanel,
      personaId,
      environment,
      profileRevision: profileRevisionRef.current,
    });
  }, [activePanel, personaId, environment]);

  /** The version key for "right now" — read fresh at call time, never memoized/stale. */
  const computeCurrentVersionKey = useCallback((): string => {
    const currentVersion: MoneyPennyContextVersion = {
      generation: generationRef.current,
      panel: activePanel,
      personaId,
      environment,
      profileRevision: profileRevisionRef.current,
    };
    return computeContextVersionKey(currentVersion);
  }, [activePanel, personaId, environment]);

  // SC-04 — protects conversation output, not just the suggestion banner.
  // Passed to SmartTriadCopilotLayer as shouldSuppressResponse: called
  // right before it would append the assistant's reply to the visible
  // conversation. Compares against the SAME pendingRequestVersionRef
  // handleSuggestedLayouts uses (populated by handleRequestContext, which
  // fires earlier in the same turn) rather than the sentGroundContext
  // parameter — that parameter reflects the PRE-dispatch-bump generation
  // computed at render time, one generation behind the POST-bump value
  // this component's own ref (and every other staleness check this turn)
  // actually uses; re-deriving from the ref keeps every check in this
  // component consistent with itself. A stale reply's TEXT is withheld —
  // never silently shown as if it answered the CURRENT context.
  const shouldSuppressResponse = useCallback(() => {
    return isResponseContextStale(pendingRequestVersionRef.current, computeCurrentVersionKey());
  }, [computeCurrentVersionKey]);

  const handleSuggestedLayouts = useCallback((hints: SuggestedLayoutHint[]) => {
    // SC-04: a response whose request context no longer matches the
    // current task/agent/environment/profile-revision is discarded
    // outright — it must not populate state or present an actionable
    // suggestion. Existing valid state (an already-shown suggestion for
    // the CURRENT context) is left untouched, never overwritten.
    if (isResponseContextStale(pendingRequestVersionRef.current, computeCurrentVersionKey())) return;
    const hit = hints.find(
      (h) => h.layoutId in SUGGESTABLE_PANEL_LABELS && h.layoutId !== activePanel,
    );
    setSuggestedPanel(hit ? (hit.layoutId as MoneyPennyPanelKey) : null);
  }, [activePanel, computeCurrentVersionKey]);

  const navigateToSuggestedPanel = useCallback(() => {
    if (!suggestedPanel) return;
    tryOpenInMountedCartridge({ cartridgeId: MONEYPENNY_CODEX_ID, tab: suggestedPanel });
    setSuggestedPanel(null);
  }, [suggestedPanel]);

  // Return navigation — three paths, tried in order of precision:
  // 1. Reached through the metame-codex MoneyPenny mirror (Agent Me's
  //    "Open MoneyPenny workspace" button) — metame-codex is still
  //    registered in the SAME in-page CartridgePresenceRegistry, so an
  //    exact same-codex tab switch back to 'aigent-me' is both correct
  //    and state-preserving (no page navigation at all).
  // 2. A real codex slug in ?from= gets a proper breadcrumb link
  //    (buildCodexUrl, the platform's canonical cross-codex mechanism).
  // 3. Plain browser history — correct regardless of hosting context,
  //    needs no source-slug knowledge.
  const isMetameMirrorContext = typeof window !== 'undefined' && getCartridge(METAME_CODEX_ID) !== null;
  const navigateBack = useCallback(() => {
    if (typeof window !== 'undefined' && getCartridge(METAME_CODEX_ID) !== null) {
      tryOpenInMountedCartridge({ cartridgeId: METAME_CODEX_ID, tab: AIGENTME_TAB_SLUG });
    } else if (fromSlug) {
      window.location.assign(buildCodexUrl(fromSlug, { tab: fromTab ?? undefined, personaId }));
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    }
  }, [fromSlug, fromTab, personaId]);

  const refetchFinancialProfileGround = useCallback(async () => {
    const summary = await fetchFinancialProfileSummary();
    if (!summary) return;
    // SC-04 — a revision to the profile invalidates any in-flight
    // request's response, even when panel/persona/environment are
    // unchanged (it may have reasoned over the now-superseded snapshot).
    profileRevisionRef.current += 1;
    generationRef.current += 1;
    setFinancialProfileGround(summary);
  }, []);

  useEffect(() => {
    if (activePanel !== 'financial-profile') return;
    void refetchFinancialProfileGround();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refetchFinancialProfileGround();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [activePanel, refetchFinancialProfileGround]);

  const groundContext: Record<string, unknown> = {
    cartridge: 'moneypenny',
    activePanel,
    // SC-04 — the version this specific request's context represents.
    // Echoed back via onRequestContext at send-time, then compared
    // against the CURRENT version when the response arrives. Read
    // BEFORE handleRequestContext's own generation bump for this same
    // dispatch — see that handler's comment; the two captures agree
    // because both read groundContextRef.current, which is reassigned
    // fresh on every render including the one following this bump.
    contextVersion: computeCurrentVersionKey(),
    ...(activePanel === 'financial-profile' && financialProfileGround ? { financialProfile: financialProfileGround } : {}),
  };
  groundContextRef.current = groundContext;

  const canNavigateBack =
    isMetameMirrorContext || Boolean(fromSlug) || (typeof window !== 'undefined' && window.history.length > 1);

  return (
    <MoneyPennyFullScreenProvider value={fullScreenContextValue}>
    <div className="flex h-[calc(100vh-96px)] flex-col overflow-hidden bg-slate-950">
      {/* Return navigation (entry-continuity, 2026-09-02) — see this file's
          header comment. Hidden during full-screen (same as the narrow
          toggle) since the takeover bar owns that space instead. */}
      {!isFullScreen && canNavigateBack && (
        <div className="flex shrink-0 items-center border-b border-slate-800 bg-slate-900/40 px-3 py-1.5">
          <button
            type="button"
            onClick={navigateBack}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-3 w-3" />
            {isMetameMirrorContext ? 'Back to aigentMe' : fromSlug ? `Back to ${fromSlug}` : 'Back'}
          </button>
        </div>
      )}
      {/* Narrow-width Conversation/Workspace toggle (C-01). Both panes stay
          mounted below `lg` — only visibility toggles via CSS — so
          SmartTriadCopilotLayer's conversation history and MoneyPennyShell's
          task/panel state survive switching views, never remounted. Hidden
          during a full-screen takeover — narrowView itself is untouched
          underneath, restored the instant isFullScreen goes false. */}
      {!isFullScreen && (
        <div className="flex shrink-0 items-center gap-1 border-b border-slate-800 bg-slate-900/60 p-1 lg:hidden">
          <button
            type="button"
            onClick={() => setNarrowView('conversation')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              narrowView === 'conversation' ? 'bg-emerald-500/10 text-emerald-300' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            Conversation
          </button>
          <button
            type="button"
            onClick={() => setNarrowView('workspace')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              narrowView === 'workspace' ? 'bg-emerald-500/10 text-emerald-300' : 'text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            Workspace
          </button>
        </div>
      )}
      {/* C-01 full-screen takeover bar — operational controls, environment
          and acting agent remain accessible per the spec, even though the
          copilot pane itself is hidden (never unmounted) during takeover. */}
      {isFullScreen && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/60 px-4 py-2">
          <span className="text-sm text-slate-300">
            <span className="font-medium text-emerald-300">{fullScreenContextValue.agentName}</span>
            {' · '}
            <span className="capitalize text-slate-400">{fullScreenContextValue.environment}</span>
          </span>
          <button
            type="button"
            onClick={() => setIsFullScreen(false)}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800/60"
          >
            <Minimize2 className="h-3 w-3" />
            Exit full screen
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden lg:flex-row">
        <div
          className={
            isFullScreen
              ? 'hidden'
              : `h-full min-h-0 w-full flex-col lg:flex lg:w-[38%] ${narrowView === 'conversation' ? 'flex' : 'hidden'}`
          }
        >
          <SmartTriadCopilotLayer
            isOpen
            variant="panel"
            promptPlaceholder="Ask MoneyPenny — spending, a goal, your risk envelope…"
            agent={{ id: 'aigent-moneypenny', name: 'MoneyPenny' }}
            agentSubtitle="Financial Services Runtime"
            personaId={personaId}
            groundContext={groundContext}
            quickPrompts={MONEYPENNY_QUICK_PROMPTS}
            onRequestContext={handleRequestContext}
            shouldSuppressResponse={shouldSuppressResponse}
            onSuggestedLayouts={handleSuggestedLayouts}
            onClose={() => undefined}
          />
        </div>
        <div
          className={
            isFullScreen
              ? 'h-full min-h-0 w-full overflow-y-auto'
              : `h-full min-h-0 w-full overflow-y-auto lg:block lg:w-[62%] ${narrowView === 'workspace' ? 'block' : 'hidden'}`
          }
        >
          {suggestedPanel && (
            <div className="mx-6 mt-4 flex items-center justify-between gap-3 rounded-lg border border-emerald-800/60 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              <span>MoneyPenny suggests: open {SUGGESTABLE_PANEL_LABELS[suggestedPanel]}</span>
              <button
                type="button"
                onClick={navigateToSuggestedPanel}
                className="flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-100 hover:bg-emerald-500/30"
              >
                Open <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
          <MoneyPennyShell activePanel={activePanel}>{children}</MoneyPennyShell>
        </div>
      </div>
    </div>
    </MoneyPennyFullScreenProvider>
  );
}

export default MoneyPennyCopilotWorkspace;
