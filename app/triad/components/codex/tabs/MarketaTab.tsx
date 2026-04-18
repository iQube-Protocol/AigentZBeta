'use client';

/**
 * MarketaTab — two-tier shell for the Marketa Venture Studio cartridge.
 *
 * Renders a self-contained surface with:
 *  - Light / dark toggle (persisted to localStorage)
 *  - Admin parent tab  → admin sub-tabs (invisible to partners)
 *  - Partners parent tab → partner sub-tabs (admins can preview)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sun, Moon, LayoutDashboard, Target, Users, ClipboardList,
  MessageSquare, Megaphone, Sparkles, Package, BarChart3,
  TrendingUp, FileEdit,
} from 'lucide-react';
import { CodexCopilotLayer } from '@/app/components/codex/CodexCopilotLayer';

import { MarketaCampaignDashboardTab } from '@/app/(shell)/marketa/components/MarketaCampaignDashboardTab';
import { MarketaCampaignOpsTab }       from '@/app/(shell)/marketa/components/MarketaCampaignOpsTab';
import { MarketaPartnersAdminTab }     from '@/app/(shell)/marketa/components/MarketaPartnersAdminTab';
import { MarketaApprovalQueueTab }     from '@/app/(shell)/marketa/components/MarketaApprovalQueueTab';
import { MarketaMyCampaignTab }        from '@/app/(shell)/marketa/components/MarketaMyCampaignTab';
import { MarketaProposeTab }           from '@/app/(shell)/marketa/components/MarketaProposeTab';
import { MarketaMyPacksTab }           from '@/app/(shell)/marketa/components/MarketaMyPacksTab';
import { MarketaMyReportsTab }         from '@/app/(shell)/marketa/components/MarketaMyReportsTab';
import MarketaQubeTalk                 from '@/app/(shell)/marketa/components/MarketaQubeTalk';
import { MarketaPublishTab }           from '@/app/(shell)/marketa/components/MarketaPublishTab';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  theme?:     'light' | 'dark';
  isAdmin?:   boolean;
  isPartner?: boolean;
  partnerId?: string;
  density?:   'narrow' | 'wide';
  personaId?: string;
}

type ParentId = 'admin' | 'partner';

interface SubTab {
  id:        string;
  label:     string;
  Icon:      React.ComponentType<{ className?: string }>;
  Component: React.ComponentType<any>;
}

// ── Sub-tab definitions ────────────────────────────────────────────────────────

const ADMIN_TABS: SubTab[] = [
  { id: 'dashboard',  label: 'Dashboard',     Icon: LayoutDashboard, Component: MarketaCampaignDashboardTab },
  { id: 'campaigns',  label: 'Campaign Ops',  Icon: Target,          Component: MarketaCampaignOpsTab },
  { id: 'partners',   label: 'Partners',      Icon: Users,           Component: MarketaPartnersAdminTab },
  { id: 'approvals',  label: 'Queue',         Icon: ClipboardList,   Component: MarketaApprovalQueueTab },
  { id: 'publish',    label: 'Publish',       Icon: FileEdit,        Component: MarketaPublishTab },
  { id: 'qt-admin',   label: 'QubeTalk',      Icon: MessageSquare,   Component: MarketaQubeTalk },
];

const PARTNER_TABS: SubTab[] = [
  { id: 'my-campaign', label: 'My Campaign', Icon: Megaphone,       Component: MarketaMyCampaignTab },
  { id: 'propose',     label: 'Propose',     Icon: Sparkles,        Component: MarketaProposeTab },
  { id: 'my-packs',    label: 'My Packs',    Icon: Package,         Component: MarketaMyPacksTab },
  { id: 'reports',     label: 'Reports',     Icon: BarChart3,       Component: MarketaMyReportsTab },
  { id: 'qt-partner',  label: 'QubeTalk',    Icon: MessageSquare,   Component: MarketaQubeTalk },
];

// ── Theme helpers ──────────────────────────────────────────────────────────────

function th(d: boolean) {
  return {
    shell:       d ? 'bg-slate-950 text-slate-100' : 'bg-[#f9f8f6] text-slate-900',
    topBar:      d ? 'bg-slate-950/95 border-b border-white/[0.06]' : 'bg-white border-b border-slate-200/80',
    subBar:      d ? 'border-b border-white/[0.06] bg-slate-950/60' : 'border-b border-slate-200/80 bg-white',
    content:     d ? 'bg-slate-950/30' : 'bg-[#f9f8f6]',
    // Parent pill
    parentActive: d
      ? 'ring-1 ring-rose-500/30 bg-rose-500/[0.08] text-rose-300'
      : 'ring-1 ring-rose-500/30 bg-rose-500/[0.06] text-rose-700',
    parentInactive: d
      ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/60',
    // Sub-tab
    subActive: d
      ? 'text-slate-100 border-b-2 border-rose-500/60'
      : 'text-slate-900 border-b-2 border-rose-600/70',
    subInactive: d
      ? 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent'
      : 'text-slate-400 hover:text-slate-700 border-b-2 border-transparent',
    // Theme toggle
    toggleBtn: d
      ? 'border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
      : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700',
    // No-access card
    emptyCard: d ? 'bg-slate-900/40 border border-white/[0.07]' : 'bg-white border border-slate-200',
    textMuted:  d ? 'text-slate-500' : 'text-slate-400',
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MarketaTab({ theme: themeProp = 'dark', isAdmin = false, isPartner = false, partnerId, density }: Props) {

  // Persist theme to localStorage
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return themeProp;
    return (localStorage.getItem('marketa-theme') as 'light' | 'dark') || themeProp;
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') localStorage.setItem('marketa-theme', next);
      return next;
    });
  }, []);

  const isDark = theme === 'dark';
  const s = th(isDark);

  const [copilotOpen, setCopilotOpen] = useState(false);

  const handleMarketaPrompt = useCallback(async (prompt: string): Promise<string> => {
    try {
      const res = await fetch('/api/codex/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, persona: 'aigent-marketa', domain: 'marketa' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.response || 'No response — try again.';
    } catch (err) {
      console.error('[MarketaTab] copilot error:', err);
      return 'Something went wrong. Please try again.';
    }
  }, []);

  // Determine which parent tabs are visible
  const showAdmin   = isAdmin;
  const showPartner = isPartner || isAdmin; // admin can preview partner view

  // Parent tab state — default to whichever is available
  const [activeParent, setActiveParent] = useState<ParentId>(() =>
    isAdmin ? 'admin' : 'partner'
  );

  // Sub-tab state per parent
  const [adminSub,   setAdminSub]   = useState(ADMIN_TABS[0].id);
  const [partnerSub, setPartnerSub] = useState(PARTNER_TABS[0].id);

  const currentSubTabs = activeParent === 'admin' ? ADMIN_TABS : PARTNER_TABS;
  const currentSubId   = activeParent === 'admin' ? adminSub   : partnerSub;
  const setCurrentSub  = activeParent === 'admin' ? setAdminSub : setPartnerSub;

  const activeSubTab = currentSubTabs.find((t) => t.id === currentSubId) ?? currentSubTabs[0];
  const ActiveComponent = activeSubTab?.Component;

  // Component props for sub-tabs
  const subProps = {
    theme,
    isAdmin,
    isPartner,
    partnerId,
    density,
  };

  // Edge: no accessible tabs
  if (!showAdmin && !showPartner) {
    return (
      <div className={`h-full flex items-center justify-center ${s.shell}`}>
        <div className={`rounded-xl ${s.emptyCard} p-10 text-center max-w-sm`}>
          <TrendingUp className={`w-8 h-8 mx-auto mb-3 ${s.textMuted}`} />
          <p className={`text-sm ${s.textMuted}`}>Marketa access pending. Contact the Marketa team.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden ${s.shell}`}>

      {/* Top nav — parent tabs + theme toggle */}
      <div className={`flex-shrink-0 ${s.topBar} px-4`}>
        <div className="flex items-center gap-1 py-2.5">

          {/* Parent tabs */}
          <div className="flex items-center gap-1 flex-1">
            {showAdmin && (
              <button
                onClick={() => setActiveParent('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeParent === 'admin' ? s.parentActive : s.parentInactive
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                Admin
              </button>
            )}
            {showPartner && (
              <button
                onClick={() => setActiveParent('partner')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeParent === 'partner' ? s.parentActive : s.parentInactive
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Partners
              </button>
            )}
          </div>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={`flex items-center justify-center w-7 h-7 rounded-md transition-all ${s.toggleBtn}`}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Sub-tab strip */}
      <div className={`flex-shrink-0 ${s.subBar} px-4 overflow-x-auto`}>
        <div className="flex items-end gap-0 min-w-max">
          {currentSubTabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setCurrentSub(id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-all ${
                currentSubId === id ? s.subActive : s.subInactive
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 min-h-0 overflow-y-auto ${s.content}`}>
        {ActiveComponent && (
          <ActiveComponent {...subProps} />
        )}
      </div>

      <CodexCopilotLayer
        isOpen={copilotOpen}
        onClose={() => setCopilotOpen(false)}
        onOpen={() => setCopilotOpen(true)}
        variant="floating"
        accentColor="rose"
        agent={{ id: 'aigent-marketa', name: 'Marketa' }}
        personaId="aigent-marketa"
        onUserPrompt={handleMarketaPrompt}
        enableInferenceRendering
        promptPlaceholder="Ask Marketa about campaigns, partners, or content..."
        initialMessage="I'm Marketa — your venture studio copilot. Ask me about the active campaigns (KS Prospects, KNYT Investors, Partners), partner activation, content packs, or what to do next."
        quickPrompts={[
          'Campaign status',
          'Next email to fire',
          'Partner pipeline',
          'Write a social post',
          'Propose a content pack',
        ]}
      />
    </div>
  );
}
