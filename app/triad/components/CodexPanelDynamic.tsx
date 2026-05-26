/**
 * Dynamic CodexPanel Component
 * 
 * Supports multiple codexes loaded from the registry API.
 * Renders tabs dynamically based on codex configuration.
 */

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCodexConfig, getEnabledTabs } from "@/app/hooks/useCodexConfig";
import { useCartridgePresence } from "@/app/hooks/useCartridgePresence";
import { CodexTab, TabGroup } from "@/types/codex";
import type { DeviceType } from "@/app/types/knytLiquidUI";
import { Loader2, AlertCircle, X, Coins, Zap, Sun, Moon, UserCircle2, ArrowRightLeft } from "lucide-react";
import dynamic from "next/dynamic";
const CodexCopilotLayer = dynamic(
  () => import("@/app/components/codex/CodexCopilotLayer").then(m => ({ default: m.CodexCopilotLayer })),
  { ssr: false }
);
import { SmartTriadProvider } from "@/app/components/content/SmartTriadProvider";
import { SmartTriadSurfaces } from "@/app/components/content/SmartTriadSurfaces";
import { personaFetch } from "@/utils/personaSpine";
import { useActivations } from "@/services/activations/ActivationsContext";
import { useCartridgeAdminGrants } from "@/app/hooks/useCartridgeAdminGrants";
import { useActivePersona } from "@/app/hooks/useActivePersona";
import { TabRenderer } from "./codex/TabRenderer";
import { SubHeaderSlotContext } from "./codex/SubHeaderSlot";
import { getIconComponent } from "./codex/iconMap";
import { getCachedOrFetch } from "./codex/cache";
import { usePersonaSafe } from "@/app/contexts/PersonaContext";
import { useCartridgePersonaGuard } from "@/app/hooks/useCartridgePersonaGuard";


interface CodexPanelDynamicProps {
  codexId: string;              // 'knyt-codex', 'qripto-codex', 'aigentiq-codex' (Agentiq Cartridge)
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  initialTab?: string;
  hiddenTabs?: string[];
  personaId?: string;
  isAdmin?: boolean;            // Explicit admin override — hides adminOnly tabs from non-admins
  isPartner?: boolean;          // Partner identity — shows partnerOnly tabs, hides adminOnly tabs
  isInvestor?: boolean;         // Investor identity — shows investorOnly tabs (IAM service resolves this)
  partnerId?: string;           // avl_partner_contacts.id — passed to partner tab components
  useDefaults?: boolean;        // Use hardcoded configs vs database
  previewDevice?: DeviceType;
  onClose?: () => void;         // Direct close callback (inline rendering)
  /** Rendering shell context — controls where cross-cartridge links navigate.
   *  "embed" (default): standalone thin-client embed, no platform chrome.
   *  "viewer": inside AgentiQ platform shell (multi-cartridge viewer). */
  shell?: 'embed' | 'viewer';
}

type IssueOption = {
  slug: string;
  label: string;
  count?: number;
};


/** Compact badge shown in the AgentiQ side menu area — Q¢ only (platform-wide rail). */
export function AgentiQEconomyBadge() {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/8 px-2.5 py-0.5">
      <Zap className="h-3 w-3 flex-shrink-0 text-indigo-400" />
      <span className="text-[10px] font-semibold text-indigo-400">Q¢ Platform Rail</span>
    </div>
  );
}

const TAB_DESCRIPTION_OVERRIDES: Record<string, Record<string, string>> = {
  'knyt-codex': {
    codex: 'Featured KNYT drops, character cards, and lore snapshots.',
    scrolls: 'Episodes and collectible preorder drops from the metaKnyts saga.',
    characters: 'Meet the heroes and villains of the metaKnyts universe.',
    lore: 'Background lore documents and world-building context.',
    digiterra: 'Digital-realm stories, clips, and character-linked moments.',
    terra: 'Cross-realm feeds for Terra and metaTerra updates.',
    order: 'Order progression, tasks, and status context.',
  },
};

const TAB_TITLE_OVERRIDES: Record<string, Record<string, string>> = {
  'knyt-codex': {
    characters: 'KNYT Cards',
    'store-episodes': 'Episodes & Graphic Novel',
    'store-characters': 'KNYT Character Cards',
    'store-investor': 'Investor Bundles',
  },
};

export default function CodexPanelDynamic({
  codexId,
  theme = 'dark',
  density = 'wide',
  initialTab,
  hiddenTabs = [],
  personaId,
  isAdmin: isAdminProp,
  isPartner: isPartnerProp,
  isInvestor = false,
  partnerId,
  useDefaults = true,
  previewDevice,
  onClose,
  shell = 'embed',
}: CodexPanelDynamicProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: codex, isLoading, error } = useCodexConfig({ codexId, useDefaults });

  // Resolve personaId: explicit prop wins; fall back to global PersonaContext
  const { activePersonaId: ctxPersonaId, setActivePersonaId } = usePersonaSafe();
  const resolvedPersonaId = personaId || ctxPersonaId || undefined;

  // When SmartWalletDrawer reports a persona switch, update the global context
  const handlePersonaChange = React.useCallback(
    (newPersonaId: string) => {
      setActivePersonaId(newPersonaId);
    },
    [setActivePersonaId]
  );

  // Cross-persona guard: show a prompt when active persona ≠ cartridge default
  const {
    mismatch: personaMismatch,
    suggestedLabel: suggestedPersonaLabel,
    activeLabel: activePersonaLabel,
    acceptSwitch: acceptPersonaSwitch,
    dismiss: dismissPersonaGuard,
  } = useCartridgePersonaGuard(codexId);
  // Canonical T1 surface for the header Welcome badge — gives us the
  // user-chosen displayLabel or their own FIO handle, never a UUID
  // fallback like personaDisplayNames does when the registry hasn't
  // populated yet.
  const { surface: activePersonaSurface } = useActivePersona();
  type SurfaceWithFio = typeof activePersonaSurface & { ownFioHandle?: string };
  const headerPersonaLabel =
    activePersonaSurface?.displayLabel ??
    (activePersonaSurface as SurfaceWithFio | null)?.ownFioHandle ??
    null;
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(theme === 'light' ? 'light' : 'dark');
  const [marketaCopilotOpen, setMarketaCopilotOpen] = useState(false);
  const [knytCopilotOpen, setKnytCopilotOpen] = useState(false);
  const [metameCopilotOpen, setMetameCopilotOpen] = useState(false);
  const normalizedInitialTab = (initialTab || '').trim().toLowerCase();
  const lastAppliedInitialTabRef = useRef<string>("");

  const queryHiddenTabs = useMemo(() => {
    const raw = (searchParams?.get("hiddenTabs") || searchParams?.get("hidden_tabs") || "").trim();
    if (!raw) return [] as string[];
    return raw
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }, [searchParams]);

  const hiddenTabSet = useMemo(() => {
    const next = new Set<string>();
    for (const tab of [...hiddenTabs, ...queryHiddenTabs]) {
      const slug = tab.trim().toLowerCase();
      if (slug) next.add(slug);
    }
    return next;
  }, [hiddenTabs, queryHiddenTabs]);
  
  // isAdminProp is the authoritative source when provided by the caller (e.g. platform shell
  // already resolved admin status from Supabase/AA-API). Falls back to false so adminOnly
  // tabs stay hidden when no explicit admin signal is received.
  const isAdmin = isAdminProp === true;
  const isPartner = isPartnerProp === true;

  // Auto-resolve partner identity for the Marketa cartridge when personaId is an email.
  // Follows the same pattern as the admin-check in useCodexEmbedAuthBridge.
  const [resolvedIsPartner, setResolvedIsPartner] = useState(false);
  const [resolvedPartnerId, setResolvedPartnerId] = useState<string | undefined>();

  useEffect(() => {
    if (codexId !== 'marketa-codex') return;
    if (!personaId?.includes('@')) return;
    if (isAdmin) return; // admins see all tabs regardless

    let cancelled = false;
    fetch(`/api/avl/partners/by-email?email=${encodeURIComponent(personaId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok && d.partner?.id) {
          setResolvedIsPartner(true);
          setResolvedPartnerId(d.partner.id);
        }
      })
      .catch(() => { /* non-fatal — partner tabs simply stay hidden */ });
    return () => { cancelled = true; };
  }, [codexId, personaId, isAdmin]);

  const effectiveIsPartner = isPartner || resolvedIsPartner;
  const effectivePartnerId = partnerId || resolvedPartnerId;

  // Active activations — driven by the canonical ActivationsProvider that
  // wraps the embed/shell layouts. Single source of truth — the Activations
  // panel mutates via the same context, so optimistic updates propagate
  // through React's render cycle (no window events, no fetch race).
  const { activeIds: activeActivations } = useActivations();

  // Per-cartridge admin grants — fail-CLOSED while loading so the
  // adminOfCartridge tabs (e.g. mirrored KNYT Admin inside metaMe's
  // Order group) stay hidden during the brief fetch window for
  // non-admin personas.
  const cartridgeAdminGrants = useCartridgeAdminGrants();

  const enabledTabs = useMemo(
    () => getEnabledTabs(codex, isAdmin, effectiveIsPartner, isInvestor, activeActivations, cartridgeAdminGrants).filter((tab) => !hiddenTabSet.has(tab.slug.toLowerCase())),
    [codex, isAdmin, effectiveIsPartner, isInvestor, activeActivations, cartridgeAdminGrants, hiddenTabSet]
  );
  
  const [activeTabSlug, setActiveTabSlug] = useState<string>(
    normalizedInitialTab || enabledTabs[0]?.slug || 'codex'
  );

  useEffect(() => {
    if (!normalizedInitialTab) return;
    if (lastAppliedInitialTabRef.current === normalizedInitialTab) return;
    if (enabledTabs.length > 0 && !enabledTabs.some((tab) => tab.slug === normalizedInitialTab)) {
      lastAppliedInitialTabRef.current = normalizedInitialTab;
      return;
    }
    setActiveTabSlug(normalizedInitialTab);
    lastAppliedInitialTabRef.current = normalizedInitialTab;
  }, [normalizedInitialTab, enabledTabs]);

  useEffect(() => {
    if (!enabledTabs.length) return;
    const exists = enabledTabs.some((tab) => tab.slug === activeTabSlug);
    if (exists) return;
    if (normalizedInitialTab && enabledTabs.some((tab) => tab.slug === normalizedInitialTab)) {
      setActiveTabSlug(normalizedInitialTab);
      return;
    }
    setActiveTabSlug(enabledTabs[0].slug);
  }, [enabledTabs, activeTabSlug, normalizedInitialTab]);

  const isQriptopian = codexId === 'qripto-codex';
  const [issueSlug, setIssueSlug] = useState<string>(() => {
    if (!isQriptopian) return 'issue-1';
    return 'issue-1';
  });
  const [issueOptions, setIssueOptions] = useState<IssueOption[]>([]);
  const [issueOptionsLoading, setIssueOptionsLoading] = useState(false);

  useEffect(() => {
    if (!isQriptopian) return;
    if (typeof window === 'undefined') return;
    const next = new URLSearchParams(window.location.search).get('issue') || 'issue-1';
    setIssueSlug(next);
  }, [isQriptopian]);

  const toIssueLabel = (slug: string) => {
    const match = slug.match(/issue-(\d{1,2})/i);
    if (!match) return slug;
    return `#${match[1]}`;
  };

  const fallbackIssueOptions = useMemo<IssueOption[]>(() => {
    if (!issueSlug) return [{ slug: 'issue-1', label: '#1' }];
    return [{ slug: issueSlug, label: toIssueLabel(issueSlug) }];
  }, [issueSlug]);

  useEffect(() => {
    if (!isQriptopian) return;
    let cancelled = false;

    const fetchIssues = async () => {
      setIssueOptionsLoading(true);
      try {
        const options = await getCachedOrFetch<IssueOption[]>(
          "codex:issues:qripto",
          async () => {
            const res = await fetch('/api/content/issues?scope=codex');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return Array.isArray(data?.issues) ? data.issues : [];
          },
          15 * 60 * 1000
        );
        if (!cancelled && options.length > 0) {
          setIssueOptions(options);
        }
      } catch {
        if (!cancelled) setIssueOptions([]);
      } finally {
        if (!cancelled) setIssueOptionsLoading(false);
      }
    };

    fetchIssues();
    return () => {
      cancelled = true;
    };
  }, [isQriptopian]);

  useEffect(() => {
    if (!isQriptopian) return;
    if (issueOptions.length === 0) return;
    if (issueOptions.some((opt) => opt.slug === issueSlug)) return;
    const next = issueOptions[0]?.slug;
    if (!next || next === issueSlug) return;
    setIssueSlug(next);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('issue', next);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [issueOptions, issueSlug, isQriptopian, pathname, router]);

  // SubHeaderSlot ref state — declared above conditional returns so hook order
  // stays stable across loading / error / no-tabs / ready renders.
  const [subHeaderSlotEl, setSubHeaderSlotEl] = useState<HTMLDivElement | null>(null);

  // Third-tier (sub-sub-tab) active slug, keyed by parent tab slug. Resets
  // when the user navigates to a different parent tab.
  const [activeSubSubTabSlug, setActiveSubSubTabSlug] = useState<string | null>(null);

  const activeTab = useMemo(
    () => enabledTabs.find(tab => tab.slug === activeTabSlug) || enabledTabs[0],
    [enabledTabs, activeTabSlug]
  );

  // Resolve the third-tier active tab when the parent has subTabs.
  // Defense in depth — the same gates that apply to top-level tabs in
  // getEnabledTabs are mirrored here so a mis-configured parent tab
  // can't accidentally surface gated sub-tabs.
  const activeSubTabs = useMemo(
    () => (activeTab?.subTabs ?? []).filter((t) => {
      if (!t.enabled) return false;
      if (t.adminOnly && !isAdmin) return false;
      if (t.adminOfCartridge) {
        if (!cartridgeAdminGrants.isGlobalAdmin && !cartridgeAdminGrants.cartridgeSlugs.has(t.adminOfCartridge)) {
          return false;
        }
      }
      return true;
    }),
    [activeTab, isAdmin, cartridgeAdminGrants]
  );
  const activeSubSubTab = useMemo(() => {
    if (activeSubTabs.length === 0) return null;
    return (
      activeSubTabs.find((t) => t.slug === activeSubSubTabSlug) ||
      activeSubTabs[0]
    );
  }, [activeSubTabs, activeSubSubTabSlug]);

  // When the parent active tab changes, reset the third-tier slug so the
  // next parent opens at its first subTab.
  useEffect(() => {
    setActiveSubSubTabSlug(null);
  }, [activeTabSlug]);

  // Publish this codex into the CartridgePresenceRegistry so the wallet
  // + cross-cartridge callers can switch tabs in place (instead of a full
  // page reload via buildCodexUrl) and so the thin-client shell can
  // render close chrome via the metame:cartridge-* postMessage protocol.
  // Wired at the codex shell level (not per-cartridge top-level *Tab
  // component) so all 10 cartridges are covered by a single hook call,
  // and so the setter that switches the user-visible top-level codex tab
  // (Codex / Store / Terra / Order / Living Canon / …) is the one we
  // expose, not a cartridge-internal sub-state.
  //
  // onClose: shell-driven close intent. Navigate the iframe to the empty
  // /triad/embed/codex-closed route — that page renders nothing visible
  // and emits the canonical metame:cartridge-closed broadcast so the
  // shell receives an unambiguous acknowledgment. The shell can also
  // remove the iframe from its DOM for a hard teardown; this navigation
  // is the soft "show nothing" fallback so the user sees the cartridge
  // close even if the shell only sends the message and doesn't unmount.
  // Spec: docs/architecture/cartridge-presence-registry.md
  useCartridgePresence({
    cartridgeId: codexId,
    displayLabel: codex?.name?.replace(/\s+codex$/i, '').trim() || codex?.name || codexId,
    tab: activeTabSlug,
    onSetTab: setActiveTabSlug,
    onClose: () => {
      if (typeof window === 'undefined') return;
      window.location.replace(`/triad/embed/codex-closed?cartridgeId=${encodeURIComponent(codexId)}`);
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex flex-col h-full w-full ${resolvedTheme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
            <p className="text-slate-400">Loading {codexId}...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state — only render if we truly have no codex data. With static
  // initialData fallback in useCodexConfig, a transient fetch abort/timeout
  // still leaves `codex` populated; in that case we render normally.
  if (!codex) {
    return (
      <div className={`flex flex-col h-full w-full ${resolvedTheme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="w-8 h-8 mx-auto text-red-400" />
            <p className="text-red-400">Failed to load codex</p>
            <p className="text-sm text-slate-500">{error?.message || 'Unknown error'}</p>
          </div>
        </div>
      </div>
    );
  }

  // No tabs available
  if (enabledTabs.length === 0) {
    return (
      <div className={`flex flex-col h-full w-full ${resolvedTheme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="w-8 h-8 mx-auto text-amber-400" />
            <p className="text-amber-400">No tabs available</p>
          </div>
        </div>
      </div>
    );
  }

  const displayCodexName = codex.name.replace(/\s+codex$/i, '').trim() || codex.name;
  const activeTabTitle = activeTab
    ? TAB_TITLE_OVERRIDES[codexId]?.[activeTab.slug] || activeTab.label
    : '';
  const ActiveTabIcon = getIconComponent(activeTab?.metadata?.icon || 'Circle');
  const activeTabDescription = activeTab
    ? TAB_DESCRIPTION_OVERRIDES[codexId]?.[activeTab.slug] ||
      activeTab.metadata?.description ||
      codex.metadata.description ||
      ''
    : '';
  const tabBadgeText = (tab: CodexTab) => {
    const rawBadge = typeof tab.metadata?.badge === 'string' ? tab.metadata.badge : '';
    if (codexId === 'knyt-codex' && tab.slug === 'scrolls') {
      return '14';
    }
    if (codexId === 'knyt-codex' && tab.slug === 'characters') {
      const numeric = rawBadge.match(/\d+/)?.[0];
      return numeric || '';
    }
    return rawBadge;
  };

  const closeParam = (searchParams?.get("closable") || "").trim().toLowerCase();
  const closeEnabledByQuery = ["1", "true", "on", "yes"].includes(closeParam);
  const closeDisabledByQuery = ["0", "false", "off", "no"].includes(closeParam);
  const isEmbeddedContext = typeof window !== "undefined" && window.parent !== window;
  const showCloseLayerButton = !closeDisabledByQuery && (closeEnabledByQuery || isEmbeddedContext || !!onClose);

  const handleCloseLayer = () => {
    const handledInline = Boolean(onClose);
    if (onClose) {
      onClose();
    }

    if (typeof window === "undefined") return;

    const closePayload = {
      type: "METAME_CODEX_CLOSE_LAYER",
      source: "codex-embed",
      close_target: "codex-panel",
      runtime_source: "codex",
      codex_id: codexId,
      codexId,
      codex_slug: codexId.replace(/-codex$/i, ""),
      codexSlug: codexId.replace(/-codex$/i, ""),
      tab_slug: activeTabSlug,
    };

    const shouldBroadcast = closeEnabledByQuery || isEmbeddedContext || !handledInline;
    if (shouldBroadcast) {
      try {
        const bc = new BroadcastChannel("metame_codex_close");
        bc.postMessage(closePayload);
        bc.close();
      } catch (e) {}
    }

    if (shouldBroadcast && window.parent && window.parent !== window) {
      window.parent.postMessage(closePayload, "*");
      window.parent.postMessage("METAME_CODEX_CLOSE_LAYER", "*");
      // Also send bridge-format NAVIGATE that the shell handler understands
      window.parent.postMessage({
        type: "NAVIGATE",
        msg_id: "codex-close-" + Date.now(),
        timestamp: new Date().toISOString(),
        source: "runtime",
        payload: { path: "/", action: "close_codex", codex_id: codexId },
      }, "*");
    }
    if (shouldBroadcast && window.top && window.top !== window && window.top !== window.parent) {
      window.top.postMessage(closePayload, "*");
      window.top.postMessage("METAME_CODEX_CLOSE_LAYER", "*");
      window.top.postMessage({
        type: "NAVIGATE",
        msg_id: "codex-close-" + Date.now(),
        timestamp: new Date().toISOString(),
        source: "runtime",
        payload: { path: "/", action: "close_codex", codex_id: codexId },
      }, "*");
    }
    if (handledInline) return;

    // Self-clear path — when there's no inline onClose handler, the
    // iframe must tear down its own view; relying on the parent shell
    // to honour the broadcast above is unreliable (the Lovable shell's
    // METAME_CODEX_CLOSE_LAYER listener is opt-in).
    //
    // Two scenarios reach this point with handledInline=false:
    //   A. Wallet URL-navigated to /triad/embed/codex/<slug> inside
    //      the Lovable thin-client iframe — `window.parent !== window`.
    //      Navigate to /triad/embed/codex-closed so the user sees the
    //      cartridge clear; the shell may still remove the iframe
    //      based on the broadcast.
    //   B. Top-level page (not embedded) — history.back() if possible.
    if (typeof window === "undefined") return;
    const isEmbedded = (window.parent && window.parent !== window) || (window.top && window.top !== window);
    if (isEmbedded) {
      // Soft-close: navigate iframe to the empty route, forwarding any
      // `returnTo` the launcher attached so the user lands back on
      // their previous view instead of a blank screen. The route also
      // re-broadcasts metame:cartridge-closed for the shell to confirm
      // the teardown (per CartridgePresenceRegistry contract).
      const returnTo = searchParams?.get("returnTo");
      let closedUrl = `/triad/embed/codex-closed?cartridgeId=${encodeURIComponent(codexId)}`;
      if (returnTo) closedUrl += `&returnTo=${encodeURIComponent(returnTo)}`;
      window.location.replace(closedUrl);
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    }
  };

  // When only one tab is available, the tab shell manages its own navigation chrome.
  const singleTabMode = enabledTabs.length <= 1;

  return (
    <SmartTriadProvider personaId={resolvedPersonaId}>
      <div className={`flex flex-col h-full w-full ${resolvedTheme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
        {!singleTabMode && (() => {
          const accentColor = codex.metadata.color || 'indigo';
          // ── Build top-level nav items (groups + standalone tabs) ──
          const groups: TabGroup[] = codex.tabGroups ?? [];
          // Visible groups: admin-gated groups hidden when not admin,
          // activation-gated groups hidden when activation isn't active.
          const visibleGroups = groups.filter(g => {
            if (g.adminOnly && !isAdmin) return false;
            if (g.activationId && !activeActivations.has(g.activationId)) return false;
            return true;
          });
          // Standalone tabs: enabled tabs with no group, sorted by order
          const standaloneTabs = enabledTabs.filter(t => !t.group);
          // Active leaf tab's group (if any)
          const activeGroup = enabledTabs.find(t => t.slug === activeTabSlug)?.group ?? null;
          // Active group definition (for label display in right sub-header)
          const activeGroupDef = activeGroup ? (groups.find(g => g.id === activeGroup) ?? null) : null;
          // Sub-tabs for the active group
          const activeGroupSubTabs = activeGroup
            ? enabledTabs.filter(t => t.group === activeGroup)
            : [];

          // Build ordered list of top-level items: groups and standalone tabs sorted by order
          type TopItem =
            | { kind: 'group'; group: TabGroup }
            | { kind: 'tab'; tab: CodexTab };
          const topItems: TopItem[] = [
            ...visibleGroups.map(g => ({ kind: 'group' as const, group: g, order: g.order })),
            ...standaloneTabs.map(t => ({ kind: 'tab' as const, tab: t, order: t.order })),
          ].sort((a, b) => a.order - b.order);

          const handleGroupClick = (groupId: string) => {
            const firstSub = enabledTabs.find(t => t.group === groupId);
            if (firstSub) setActiveTabSlug(firstSub.slug);
          };

          const isDark = resolvedTheme === 'dark';
          return (
            <>
              {/* Primary tab bar */}
              <div className={`flex-shrink-0 border-b px-4 ${isDark ? 'border-slate-700/50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-4">
                    <h2
                      className="text-xl font-bold flex items-center gap-2 whitespace-nowrap"
                      title={codex.metadata.description || undefined}
                    >
                      {codex.metadata.icon && React.createElement(
                        getIconComponent(codex.metadata.icon),
                        { className: `w-5 h-5 ${codex.id === 'metame-codex' ? 'text-rose-400' : `text-${accentColor}-400`}` }
                      )}
                      {displayCodexName}
                    </h2>
                    <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
                      {topItems.map((item) => {
                        if (item.kind === 'group') {
                          const { group } = item;
                          const isActiveGroup = activeGroup === group.id;
                          const Icon = getIconComponent(group.icon || 'Circle');
                          return (
                            <button
                              key={`group-${group.id}`}
                              onClick={() => handleGroupClick(group.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap rounded-lg ${
                                isActiveGroup
                                  ? `bg-${accentColor}-500/10 ring-1 ring-${accentColor}-500/30 ${isDark ? `text-${accentColor}-300` : `text-${accentColor}-600`}`
                                  : isDark ? 'text-slate-400 hover:text-slate-300 hover:bg-white/4' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                              }`}
                            >
                              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                              {density === 'wide' && group.label}
                            </button>
                          );
                        }
                        // standalone tab
                        const { tab } = item;
                        const Icon = getIconComponent(tab.metadata?.icon || 'Circle');
                        const isActive = tab.slug === activeTabSlug;
                        const badge = tabBadgeText(tab);
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTabSlug(tab.slug)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap rounded-lg ${
                              isActive
                                ? `bg-${accentColor}-500/10 ring-1 ring-${accentColor}-500/30 ${isDark ? `text-${accentColor}-300` : `text-${accentColor}-600`}`
                                : isDark ? 'text-slate-400 hover:text-slate-300 hover:bg-white/4' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                            {density === 'wide' && tab.label}
                            {badge && (
                              <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                                {badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Welcome <persona> — pinned to the cartridge header row,
                        always visible above all tabs (including iOS / mobile),
                        sits immediately to the left of the theme toggle.
                        Reads from the canonical T1 surface (displayLabel or
                        ownFioHandle) so we never render a UUID fallback.
                        Hidden when no active persona is resolved.
                        On narrow screens the label truncates with an ellipsis
                        so a long FIO handle can't push the theme toggle off. */}
                    {headerPersonaLabel && (
                      <div
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] md:text-xs font-medium max-w-[55vw] md:max-w-none ${
                          isDark
                            ? `border-${accentColor}-500/30 bg-${accentColor}-500/10 text-${accentColor}-200`
                            : `border-${accentColor}-300 bg-${accentColor}-50 text-${accentColor}-700`
                        }`}
                        title={`Active persona: ${headerPersonaLabel}`}
                      >
                        <span className="truncate">Welcome, {headerPersonaLabel}</span>
                      </div>
                    )}
                    {/* Theme toggle */}
                    <button
                      type="button"
                      onClick={() => setResolvedTheme(r => r === 'dark' ? 'light' : 'dark')}
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
                        isDark
                          ? 'border-slate-600/80 bg-slate-900/70 text-slate-300 hover:border-slate-400 hover:text-white'
                          : 'border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-800'
                      }`}
                      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                      aria-label="Toggle theme"
                    >
                      {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    </button>
                    {codexId === 'aigentiq-codex' && <AgentiQEconomyBadge />}
                    {isQriptopian && (
                      <select
                        value={issueSlug}
                        onChange={(e) => {
                          const next = e.target.value;
                          setIssueSlug(next);
                          const params = new URLSearchParams(window.location.search);
                          params.set('issue', next);
                          router.replace(`${pathname}?${params.toString()}`);
                        }}
                        disabled={issueOptionsLoading && issueOptions.length === 0}
                        className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-sm text-slate-200"
                      >
                        {(issueOptions.length > 0 ? issueOptions : fallbackIssueOptions).map((opt) => (
                          <option key={opt.slug} value={opt.slug}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {showCloseLayerButton ? (
                      <button
                        type="button"
                        onClick={handleCloseLayer}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-600/80 bg-slate-900/70 text-slate-300 transition-colors hover:border-slate-400 hover:text-white"
                        title="Close codex layer"
                        aria-label="Close codex layer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Single combined sub-header: sub-tabs on left, context badges + colored icon + title + description on right.
                  Mobile: sub-tabs become a horizontal scroll carousel (flex-1 + overflow-x-auto + no-scrollbar)
                  so the row can't push the page beyond the viewport. The right-cluster title hides on mobile
                  (it duplicates the active sub-tab label anyway) so the carousel gets all available space. */}
              <div className={`flex-shrink-0 border-b px-4 py-1.5 flex items-center gap-3 min-w-0 ${isDark ? 'border-white/[0.06] bg-white/[0.02] backdrop-blur-sm' : 'border-slate-200 bg-slate-50'}`}>
                {activeGroup && activeGroupSubTabs.length > 1 ? (
                  <div className="flex gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
                    {activeGroupSubTabs.map((tab) => {
                      const isActive = tab.slug === activeTabSlug;
                      const Icon = getIconComponent(tab.metadata?.icon || 'Circle');
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTabSlug(tab.slug)}
                          className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium transition-all whitespace-nowrap rounded-md flex-shrink-0 ${
                            isActive
                              ? `bg-${accentColor}-500/10 ring-1 ring-${accentColor}-500/25 ${isDark ? `text-${accentColor}-300` : `text-${accentColor}-600`}`
                              : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/4' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className="w-3 h-3 flex-shrink-0" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                ) : activeSubTabs.length > 0 ? (
                  /* Single-tab group with subTabs (e.g. Order of Metayé) —
                     render the sub-sub-tabs here on the same row as the
                     breadcrumb instead of in a separate row below, so the
                     layout matches multi-sibling groups like aigentMe. */
                  <div className="flex gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
                    {activeSubTabs.map((sub) => {
                      const isActive = (activeSubSubTab?.slug ?? activeSubTabs[0].slug) === sub.slug;
                      const Icon = getIconComponent(sub.metadata?.icon || 'Circle');
                      return (
                        <button
                          key={sub.id}
                          onClick={() => setActiveSubSubTabSlug(sub.slug)}
                          className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium transition-all whitespace-nowrap rounded-md flex-shrink-0 ${
                            isActive
                              ? `bg-${accentColor}-500/10 ring-1 ring-${accentColor}-500/25 ${isDark ? `text-${accentColor}-300` : `text-${accentColor}-600`}`
                              : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/4' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                          }`}
                          title={sub.metadata?.description}
                        >
                          <Icon className="w-3 h-3 flex-shrink-0" />
                          {sub.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div ref={setSubHeaderSlotEl} className="flex gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar items-center" />
                )}
                {/* Right cluster: context badges + colored icon + title + description, all justified right */}
                <div className="ml-auto flex items-center gap-2 min-w-0 flex-shrink-0">
                  {codexId === 'knyt-codex' && (activeTabSlug === 'order' || activeTabSlug === 'treasury') && (
                    <>
                      <div className="flex items-center gap-1 rounded-md border border-indigo-500/25 bg-indigo-500/8 px-2 py-0.5 flex-shrink-0">
                        <Zap className="h-3 w-3 flex-shrink-0 text-indigo-400" />
                        <span className="text-[10px] font-semibold text-indigo-400">Q¢</span>
                      </div>
                      <div className="flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/8 px-2 py-0.5 flex-shrink-0">
                        <Coins className="h-3 w-3 flex-shrink-0 text-amber-400" />
                        <span className="text-[10px] font-semibold text-amber-400">$KNYT</span>
                      </div>
                    </>
                  )}
                  {codexId === 'knyt-codex' && activeTabSlug === 'terra' && (
                    <div className="flex items-center gap-1 rounded-md border border-green-500/25 bg-green-500/8 px-2 py-0.5 flex-shrink-0">
                      <span className="text-[10px] font-semibold text-green-400">metaKNYT · Qriptopian Signal</span>
                    </div>
                  )}
                  <ActiveTabIcon className={`h-3.5 w-3.5 flex-shrink-0 text-${activeTab?.metadata?.color || accentColor}-400`} />
                  {activeGroupDef && (
                    <span className={`hidden md:inline text-xs font-medium text-${accentColor}-400/70 whitespace-nowrap`}>
                      {activeGroupDef.label}
                    </span>
                  )}
                  {activeGroupDef && <span className="hidden md:inline text-xs text-slate-600">·</span>}
                  <span className="hidden md:inline text-xs font-semibold text-white whitespace-nowrap">{activeTabTitle}</span>
                  {activeTabDescription && (
                    <span className="hidden sm:block truncate text-xs text-slate-500 max-w-52" title={activeTabDescription}>
                      {activeTabDescription}
                    </span>
                  )}
                </div>
              </div>

              {/*
                Tier-3 sub-sub-tab row — rendered as a SEPARATE row below
                the tier-2 nav when BOTH conditions hold:
                  - the active group has multiple sibling tabs (tier-2 is
                    rendering the siblings in the bar above), AND
                  - the active tab has its own subTabs (tier-3).
                Prior behaviour collapsed tier-3 into the tier-2 slot via
                an `else if` — that only fired for single-tab groups, so
                multi-tab groups whose active tab also had subTabs (e.g.
                AgentiQ OS Home → its 3rd-tier sub-tabs) silently dropped
                the third row after the ed2ad425 refactor. This second
                row restores the missing tier without disturbing the
                single-tab-group inline path above.
              */}
              {activeGroup && activeGroupSubTabs.length > 1 && activeSubTabs.length > 0 && (
                <div className={`flex-shrink-0 border-b px-4 py-1 flex items-center gap-1 min-w-0 overflow-x-auto no-scrollbar ${isDark ? 'border-white/[0.04] bg-white/[0.01]' : 'border-slate-100 bg-slate-50/60'}`}>
                  {activeSubTabs.map((sub) => {
                    const isActive = (activeSubSubTab?.slug ?? activeSubTabs[0].slug) === sub.slug;
                    const Icon = getIconComponent(sub.metadata?.icon || 'Circle');
                    return (
                      <button
                        key={sub.id}
                        onClick={() => setActiveSubSubTabSlug(sub.slug)}
                        className={`flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-medium transition-all whitespace-nowrap rounded-md flex-shrink-0 ${
                          isActive
                            ? `bg-${accentColor}-500/10 ring-1 ring-${accentColor}-500/25 ${isDark ? `text-${accentColor}-300` : `text-${accentColor}-600`}`
                            : isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/4' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                        }`}
                        title={sub.metadata?.description}
                      >
                        <Icon className="w-3 h-3 flex-shrink-0" />
                        {sub.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          );
        })()}



        {/* Cross-persona guard banner */}
        {personaMismatch && (
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/25 text-amber-300 text-xs">
            <UserCircle2 className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span className="flex-1 min-w-0">
              Active persona <span className="font-semibold">{activePersonaLabel}</span> differs from your preferred persona for this cartridge
              {suggestedPersonaLabel && (
                <> (<span className="font-semibold">{suggestedPersonaLabel}</span>)</>
              )}.
            </span>
            <button
              onClick={acceptPersonaSwitch}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 font-medium transition-colors shrink-0"
            >
              <ArrowRightLeft className="w-3 h-3" />
              Switch
            </button>
            <button
              onClick={dismissPersonaGuard}
              className="p-0.5 rounded hover:bg-white/10 text-amber-400/60 hover:text-amber-300 transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Sub-sub-tabs row removed — sub-tabs now render inline on the
              sub-header row above (next to the breadcrumb) to match the
              aigentMe layout convention. The render path is conditional on
              `activeGroup && activeGroupSubTabs.length > 1` (siblings) or
              `activeSubTabs.length > 0` (single-tab group with subTabs). */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {activeTab && (
              <SubHeaderSlotContext.Provider value={subHeaderSlotEl}>
                <TabRenderer
                  tab={activeSubSubTab ?? activeTab}
                  codexId={codexId}
                  theme={resolvedTheme}
                  density={density}
                  personaId={resolvedPersonaId}
                  isAdmin={isAdmin}
                  isPartner={effectiveIsPartner}
                  isInvestor={isInvestor}
                  partnerId={effectivePartnerId}
                  issueSlug={isQriptopian ? issueSlug : undefined}
                  previewDevice={previewDevice}
                  shell={shell}
                />
              </SubHeaderSlotContext.Provider>
            )}
          </div>
        </div>
      </div>

      <SmartTriadSurfaces personaId={resolvedPersonaId} onPersonaChange={handlePersonaChange} cartridgeSlug={codexId} />

      {codexId === 'marketa-codex' && (
        <CodexCopilotLayer
          isOpen={marketaCopilotOpen}
          onClose={() => setMarketaCopilotOpen(false)}
          onOpen={() => setMarketaCopilotOpen(true)}
          variant="floating"
          accentColor="rose"
          agent={{ id: 'aigent-marketa', name: 'Marketa' }}
          personaId={resolvedPersonaId ?? 'aigent-marketa'}
          enableInferenceRendering
          promptPlaceholder="Ask Marketa about campaigns, partners, or content..."
          initialMessage="I'm Marketa — your venture studio copilot. Ask me about the active campaigns, partner activation, content packs, or what to do next."
          quickPrompts={['Campaign status', 'Next email to fire', 'Partner pipeline', 'Write a social post', 'Propose a content pack']}
        />
      )}
      {codexId === 'knyt-codex' && activeTabSlug.startsWith('store-') && (
        <CodexCopilotLayer
          isOpen={knytCopilotOpen}
          onClose={() => setKnytCopilotOpen(false)}
          onOpen={() => setKnytCopilotOpen(true)}
          variant="floating"
          accentColor="amber"
          agent={{ id: 'aigent-kn0w1', name: 'KNYT Copilot' }}
          personaId={resolvedPersonaId ?? undefined}
          enableInferenceRendering
          contextId={`knyt-${activeTabSlug}`}
          promptPlaceholder="Ask about episodes, characters, bundles..."
          quickPrompts={['What episodes are available?', 'Show me bundle deals', 'KNYT Cards explained', 'Investor pricing']}
        />
      )}

      {/* Aigent Me — copilot on every metaMe cartridge tab.
          Emerald branding per the locked decision; persona = 'aigent-me' so
          the chat route picks up the Aigent Me system prompt from
          app/data/personas.ts. */}
      {codexId === 'metame-codex' && (
        <CodexCopilotLayer
          isOpen={metameCopilotOpen}
          onClose={() => setMetameCopilotOpen(false)}
          onOpen={() => setMetameCopilotOpen(true)}
          variant="floating"
          accentColor="emerald"
          agent={{ id: 'aigent-me', name: 'aigentMe' }}
          personaId={resolvedPersonaId ?? 'aigent-me'}
          enableInferenceRendering
          contextId={`metame-${activeTabSlug}`}
          promptPlaceholder="Ask aigentMe about your ExperienceModel, briefs, or next move..."
          initialMessage="I'm aigentMe — your sovereign chief of staff inside metaMe. I know your active ExperienceModel, your goals, the cartridges you're moving forward, and which specialists I can coordinate. Ask me anything."
          quickPrompts={['Brief me', 'Move this forward', 'Review venture progress', 'Ask Marketa', 'Ask Quill', 'Ask Kn0w1', 'Ask Nakamoto']}
        />
      )}
    </SmartTriadProvider>
  );
}
