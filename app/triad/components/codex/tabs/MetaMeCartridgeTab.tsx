'use client';

/**
 * MetaMeCartridgeTab — top-menu + sub-menu shell for the metaMe Cartridge.
 *
 * Top menu: aigentMe | VL | Marketa | metaMe Studio | AgentiQ OS | Qriptopia | Admin
 * Access gating:
 *   - Standard (all users): aigentMe, Qriptopia
 *   - Admin-gated: VL, Marketa, metaMe Studio, AgentiQ OS, Admin
 *
 * Non-permitted parents are hidden from the menu. Direct URL access to a
 * gated parent shows an access message (not a 404).
 *
 * All surfaces are mounted by import — nothing is rebuilt here.
 */

import React, { useState, useCallback } from 'react';
import {
  Sparkles, Layers, TrendingUp, Wand2, Cpu, Globe, Settings,
  BarChart3, Users, Moon, Sun, Grid3x3, MessageSquare, Package,
  Star, Users2, Bitcoin, ShieldAlert, Megaphone, FileEdit, Route,
} from 'lucide-react';

// ── aigentMe surfaces ─────────────────────────────────────────────────────────
import { AigentMeWelcomeTab } from './AigentMeWelcomeTab';

// ── VL surfaces ───────────────────────────────────────────────────────────────
import { VentureLabGrowthMatrixTab } from './VentureLabGrowthMatrixTab';
import { RelationshipBuilderTab } from './RelationshipBuilderTab';

// ── Marketa partner surfaces ──────────────────────────────────────────────────
import { MarketaMyCampaignTab }  from '@/app/(shell)/marketa/components/MarketaMyCampaignTab';
import { MarketaProposeTab }     from '@/app/(shell)/marketa/components/MarketaProposeTab';
import { MarketaMyPacksTab }     from '@/app/(shell)/marketa/components/MarketaMyPacksTab';
import { MarketaMyReportsTab }   from '@/app/(shell)/marketa/components/MarketaMyReportsTab';
import MarketaQubeTalk           from '@/app/(shell)/marketa/components/MarketaQubeTalk';

// ── metaMe Studio surface ─────────────────────────────────────────────────────
import { ComposerStudio } from '@/components/composer/ComposerStudio';

// ── AgentiQ OS surface ────────────────────────────────────────────────────────
import { AgentiQOSTab } from './AgentiQOSTab';

// ── Qriptopia surface ─────────────────────────────────────────────────────────
import { FeaturesTab } from './FeaturesTab';

// ── Admin surfaces ────────────────────────────────────────────────────────────
import { AgentiqCartridgeTab } from './AgentiqCartridgeTab';
import { ExperienceDashboardTab } from './ExperienceDashboardTab';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface MetaMeCartridgeTabProps {
  theme?:     'light' | 'dark';
  isAdmin?:   boolean;
  isPartner?: boolean;
  partnerId?: string;
  personaId?: string;
  density?:   'narrow' | 'wide';
}

type ParentId = 'aigentme' | 'vl' | 'marketa' | 'studio' | 'agentiqos' | 'qriptopia' | 'admin';

interface SubTab {
  id:        string;
  label:     string;
  Icon:      React.ComponentType<{ className?: string }>;
  Component: React.ComponentType<any>;
  props?:    Record<string, unknown>;
}

// ── Stub component for not-yet-built surfaces ─────────────────────────────────

function StubTab({ title, description, isDark }: { title: string; description: string; isDark: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center h-full min-h-[320px] gap-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
      <Route className="w-8 h-8 opacity-40" />
      <div className="text-center max-w-xs">
        <p className="text-sm font-medium mb-1">{title}</p>
        <p className="text-xs opacity-60">{description}</p>
      </div>
    </div>
  );
}

function makeStub(title: string, description: string): React.ComponentType<{ isDark?: boolean }> {
  return function Stub({ isDark = true }: { isDark?: boolean }) {
    return <StubTab title={title} description={description} isDark={isDark} />;
  };
}

const ExperienceModelStub   = makeStub('Experience Model',   'Experience model definition — coming soon.');
const ExperienceLadderStub  = makeStub('Experience Ladder',  'PCS progression ladder — coming soon.');
const ExperienceJourneyStub = makeStub('Experience Journey', 'User journey progression — coming soon.');
const CommunityStub         = makeStub('Community',          'Qriptopia community surface — coming soon.');
const SatsStub              = makeStub('21 Sats',            'Bitcoin-native rewards surface — coming soon.');

// ── Sub-tab definitions ────────────────────────────────────────────────────────

const AIGENTME_TABS: SubTab[] = [
  { id: 'welcome',   label: 'aigentMe',           Icon: Sparkles,  Component: AigentMeWelcomeTab },
  { id: 'exp-model', label: 'Experience Model',   Icon: Layers,    Component: ExperienceModelStub },
  { id: 'exp-ladder',label: 'Experience Ladder',  Icon: TrendingUp,Component: ExperienceLadderStub },
  { id: 'exp-journey',label:'Experience Journey', Icon: Route,     Component: ExperienceJourneyStub },
];

const VL_TABS: SubTab[] = [
  { id: 'growth-matrix',  label: 'Growth Matrix',       Icon: Grid3x3,   Component: VentureLabGrowthMatrixTab },
  { id: 'rel-builder',    label: 'Relationship Builder', Icon: Users,     Component: RelationshipBuilderTab },
];

const MARKETA_TABS: SubTab[] = [
  { id: 'my-campaign', label: 'My Campaign', Icon: Megaphone,    Component: MarketaMyCampaignTab },
  { id: 'propose',     label: 'Propose',     Icon: Wand2,        Component: MarketaProposeTab },
  { id: 'my-packs',    label: 'My Packs',    Icon: Package,      Component: MarketaMyPacksTab },
  { id: 'reports',     label: 'Reports',     Icon: BarChart3,    Component: MarketaMyReportsTab },
  { id: 'qt-partner',  label: 'QubeTalk',    Icon: MessageSquare,Component: MarketaQubeTalk },
];

const STUDIO_TABS: SubTab[] = [
  { id: 'studio', label: 'metaMe Studio', Icon: FileEdit, Component: ComposerStudio },
];

const AGENTIQOS_TABS: SubTab[] = [
  { id: 'os', label: 'AgentiQ OS', Icon: Cpu, Component: AgentiQOSTab },
];

const QRIPTOPIA_TABS: SubTab[] = [
  { id: 'features',  label: 'Features',  Icon: Star,    Component: FeaturesTab },
  { id: 'community', label: 'Community', Icon: Users2,  Component: CommunityStub },
  { id: '21sats',    label: '21 Sats',   Icon: Bitcoin, Component: SatsStub },
];

const ADMIN_TABS: SubTab[] = [
  {
    id: 'exp-framework', label: 'Experience Framework', Icon: Layers, Component: AgentiqCartridgeTab,
    props: { packId: 'metame', collectionId: 'col_experience_framework', defaultPath: 'items/METAME_EXPERIENCE_FRAMEWORK.md' },
  },
  {
    id: 'journey-dashboard', label: 'Journey Dashboard', Icon: BarChart3, Component: ExperienceDashboardTab,
    props: { tenantId: 'metame' },
  },
];

// ── Parent tab map ─────────────────────────────────────────────────────────────

interface Parent {
  id:      ParentId;
  label:   string;
  Icon:    React.ComponentType<{ className?: string }>;
  subTabs: SubTab[];
  gated:   boolean; // true = admin-only
}

const PARENTS: Parent[] = [
  { id: 'aigentme',  label: 'aigentMe',      Icon: Sparkles,  subTabs: AIGENTME_TABS,   gated: false },
  { id: 'vl',        label: 'VL',            Icon: TrendingUp,subTabs: VL_TABS,          gated: true  },
  { id: 'marketa',   label: 'Marketa',       Icon: Megaphone, subTabs: MARKETA_TABS,     gated: true  },
  { id: 'studio',    label: 'metaMe Studio', Icon: Wand2,     subTabs: STUDIO_TABS,      gated: true  },
  { id: 'agentiqos', label: 'AgentiQ OS',    Icon: Cpu,       subTabs: AGENTIQOS_TABS,   gated: true  },
  { id: 'qriptopia', label: 'Qriptopia',     Icon: Globe,     subTabs: QRIPTOPIA_TABS,   gated: false },
  { id: 'admin',     label: 'Admin',         Icon: Settings,  subTabs: ADMIN_TABS,       gated: true  },
];

// ── Theme helpers ──────────────────────────────────────────────────────────────

function th(d: boolean) {
  return {
    shell:          d ? 'bg-slate-950 text-slate-100' : 'bg-[#f9f8f6] text-slate-900',
    topBar:         d ? 'bg-slate-950/95 border-b border-white/[0.06]' : 'bg-white border-b border-slate-200/80',
    subBar:         d ? 'border-b border-white/[0.06] bg-slate-950/60' : 'border-b border-slate-200/80 bg-white',
    content:        d ? 'bg-slate-950/30' : 'bg-[#f9f8f6]',
    parentActive:   d
      ? 'ring-1 ring-violet-500/30 bg-violet-500/[0.08] text-violet-300'
      : 'ring-1 ring-violet-500/30 bg-violet-500/[0.06] text-violet-700',
    parentInactive: d
      ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/60',
    subActive:      d
      ? 'text-slate-100 border-b-2 border-violet-500/60'
      : 'text-slate-900 border-b-2 border-violet-600/70',
    subInactive:    d
      ? 'text-slate-500 hover:text-slate-300 border-b-2 border-transparent'
      : 'text-slate-400 hover:text-slate-700 border-b-2 border-transparent',
    toggleBtn:      d
      ? 'border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
      : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700',
    noAccessCard:   d ? 'bg-slate-900/40 border border-white/[0.07]' : 'bg-white border border-slate-200',
    textMuted:      d ? 'text-slate-500' : 'text-slate-400',
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

export function MetaMeCartridgeTab({
  theme: themeProp = 'dark',
  isAdmin  = false,
  isPartner = false,
  partnerId,
  personaId,
  density,
}: MetaMeCartridgeTabProps) {

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return themeProp;
    return (localStorage.getItem('metame-cartridge-theme') as 'light' | 'dark') || themeProp;
  });

  const toggleTheme = useCallback(() => {
    setTheme((prev: 'light' | 'dark') => {
      const next: 'light' | 'dark' = prev === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') localStorage.setItem('metame-cartridge-theme', next);
      return next;
    });
  }, []);

  const isDark = theme === 'dark';
  const s = th(isDark);

  // Visible parent tabs — hide gated parents from non-admins
  const visibleParents = PARENTS.filter((p) => !p.gated || isAdmin);

  // Active parent state
  const [activeParentId, setActiveParentId] = useState<ParentId>(() =>
    visibleParents[0]?.id ?? 'aigentme'
  );

  // Sub-tab state per parent (keyed by parent id)
  const [subSelections, setSubSelections] = useState<Partial<Record<ParentId, string>>>({});

  const activeParent = visibleParents.find((p) => p.id === activeParentId) ?? visibleParents[0];

  const currentSubTabs  = activeParent?.subTabs ?? [];
  const currentSubId    = subSelections[activeParent?.id ?? 'aigentme'] ?? currentSubTabs[0]?.id ?? '';

  const setCurrentSub = useCallback((parentId: ParentId, subId: string) => {
    setSubSelections((prev: Partial<Record<ParentId, string>>) => ({ ...prev, [parentId]: subId }));
  }, []);

  const activeSubTab   = currentSubTabs.find((t) => t.id === currentSubId) ?? currentSubTabs[0];
  const ActiveComponent = activeSubTab?.Component;

  const subProps = {
    theme,
    isAdmin,
    isPartner,
    partnerId,
    personaId,
    density,
    isDark,
    ...(activeSubTab?.props ?? {}),
  };

  // No accessible parents at all (edge case — shouldn't happen for public users)
  if (!visibleParents.length) {
    return (
      <div className={`h-full flex items-center justify-center ${s.shell}`}>
        <div className={`rounded-xl ${s.noAccessCard} p-10 text-center max-w-sm`}>
          <ShieldAlert className={`w-8 h-8 mx-auto mb-3 ${s.textMuted}`} />
          <p className={`text-sm ${s.textMuted}`}>No accessible modules. Contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden ${s.shell}`}>

      {/* ── Top nav — parent tabs + theme toggle ──────────────────────────── */}
      <div className={`flex-shrink-0 ${s.topBar} px-4`}>
        <div className="flex items-center gap-1 py-2.5">

          <div className="flex items-center gap-1 flex-1 flex-wrap">
            {visibleParents.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setActiveParentId(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeParentId === id ? s.parentActive : s.parentInactive
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={toggleTheme}
            className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md transition-all ${s.toggleBtn}`}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Sub-tab strip ──────────────────────────────────────────────────── */}
      {currentSubTabs.length > 1 && (
        <div className={`flex-shrink-0 ${s.subBar} px-4 overflow-x-auto`}>
          <div className="flex items-end gap-0 min-w-max">
            {currentSubTabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setCurrentSub(activeParent.id, id)}
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
      )}

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className={`flex-1 min-h-0 overflow-y-auto ${s.content}`}>
        {ActiveComponent && <ActiveComponent {...subProps} />}
      </div>

    </div>
  );
}

export default MetaMeCartridgeTab;
