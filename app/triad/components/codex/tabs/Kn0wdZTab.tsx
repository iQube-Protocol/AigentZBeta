'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  FileText,
  Github,
  Lock,
  Layers,
  Loader2,
  MessageCircle,
  Palette,
  Terminal,
  TrendingUp,
  Users,
  Video,
  Crown,
} from 'lucide-react';
import { useSmartTriad } from '@/app/components/content/SmartTriadProvider';
import { CodexActionRow } from '../CodexActionRow';
import { isLockedContent, isPremiumContent } from '@/app/triad/components/codex/utils/contentFlags';
import { CodexBadge } from '../CodexBadge';
import { CacheManager } from '@/app/utils/cache';
import { buildCodexUrl } from '@/utils/codex-nav';

// AgentiQ OS public mirror — verified from .github/workflows/sync-agentiq-os-to-public.yml.
const AGENTIQ_OS_GITHUB_URL = 'https://github.com/iQube-Protocol/AgentiQ-OS';

interface Kn0wdZTabProps {
  theme?: 'light' | 'dark';
  personaId?: string;
  issueSlug?: string;
}

type Kn0wdZItem = {
  id: string;
  title: string;
  excerpt?: string;
  image?: string;
  cover_image_url?: string;
  badge?: string;
  position?: number;
  tags?: string[];
  isPremium?: boolean;
  price?: { amount: number; currency?: string };
  modalities?: any;
};

type TabId = 'dev' | 'creative' | 'exec';

const panels = {
  dev: {
    title: 'Quick Start',
    subtitle: 'Builder & Developer Knowledge - How It Works',
    icon: Terminal,
    panelClass: 'border-cyan-500/30 bg-cyan-500/10',
    accentClass: 'text-cyan-400',
    ringClass: 'ring-cyan-400/40',
    tabClass: 'border-cyan-400/60 text-cyan-200 bg-cyan-500/20',
    content: `# 1. Install the AgentiQ OS SDK
npm install @agentiqos/agentiq-sdk

# 2. Scaffold a new cartridge
npx @agentiqos/agentiq-sdk init my-cartridge
cd my-cartridge && npm install

# 3. Use the SDK in code
import { AgentiQClient } from '@agentiqos/agentiq-sdk';

const client = new AgentiQClient({
  apiUrl: process.env.AGENTIQ_API_URL,
  personaId: process.env.AGENTIQ_PERSONA_ID,
});

// Register an AigentQube
await client.registry.publish({
  type: 'AigentQube',
  capabilities: ['knowledge_retrieval'],
  policyBindings: { disclosure_class: 'tenant' },
  trust_band: 'L1_EXPERIMENTAL',
});`,
    resources: [
      { label: 'Documentation', desc: 'AgentiQ OS Docs / KB', icon: BookOpen, kind: 'docs' as const },
      { label: 'GitHub Repos', desc: 'iQube-Protocol/AgentiQ-OS', icon: Github, kind: 'github' as const },
      { label: 'Discord', desc: 'Developer community', icon: MessageCircle, kind: 'noop' as const },
      { label: 'Video Tutorials', desc: 'Step-by-step guides', icon: Video, kind: 'noop' as const },
    ],
  },
  creative: {
    title: 'Creative Framework',
    subtitle: 'Creative Storytelling & Visual Content',
    icon: Palette,
    panelClass: 'border-purple-500/30 bg-purple-500/10',
    accentClass: 'text-purple-400',
    ringClass: 'ring-purple-400/40',
    tabClass: 'border-purple-400/60 text-purple-200 bg-purple-500/20',
    description:
      'Build compelling narratives that resonate with your audience through our mythos storytelling framework.',
    structure: [
      'Establish world & characters',
      'Define central conflict',
      'Build tension & stakes',
      'Resolution & transformation',
    ],
    resources: [
      { label: 'Style Guide', desc: 'Visual standards & templates', icon: FileText },
      { label: 'Asset Library', desc: 'Logos, characters & props', icon: Layers },
      { label: 'Creative Community', desc: 'Share & collaborate', icon: Users },
      { label: 'Tutorial Series', desc: 'Comics, animation & more', icon: Video },
    ],
  },
  exec: {
    title: 'Strategic Impact & Business Development',
    subtitle: 'Impact Imperatives & Business Development - Strategic Insights',
    icon: Building2,
    panelClass: 'border-orange-500/30 bg-orange-500/10',
    accentClass: 'text-orange-400',
    ringClass: 'ring-orange-400/40',
    tabClass: 'border-orange-400/60 text-orange-200 bg-orange-500/20',
    description:
      'Drive measurable impact through iQube infrastructure while building sustainable business models and strategic partnerships.',
    imperatives: [
      'Impact measurement & reporting frameworks',
      'Enterprise integration & revenue models',
      'Operational scaling & efficiency',
      'Market positioning & ecosystem growth',
    ],
    resources: [
      { label: 'Strategic Playbooks', desc: 'Business model templates', icon: Briefcase },
      { label: 'Partner Portal', desc: 'Integration resources', icon: Users },
      { label: 'Ops Dashboard', desc: 'Metrics & analytics', icon: BarChart3 },
      { label: 'Market Intelligence', desc: 'Competitive insights', icon: TrendingUp },
    ],
  },
};

const tabOrder: TabId[] = ['dev', 'creative', 'exec'];

function getApiOrigin() {
  if (typeof window === 'undefined') return 'https://dev-beta.aigentz.me';
  return window.location.origin;
}

function badgeToTab(badge?: string): TabId {
  const normalized = (badge || '').toLowerCase();
  if (normalized === 'creative') return 'creative';
  if (normalized === 'exec') return 'exec';
  return 'dev';
}

export function Kn0wdZTab({ theme = 'dark', personaId, issueSlug }: Kn0wdZTabProps) {
  const { actions } = useSmartTriad();
  const isOwnedItem = (item: { id: string }) => actions.checkOwnership(item.id);
  const [items, setItems] = useState<Kn0wdZItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('dev');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === 'dark';
  const textClass = isDark ? 'text-white' : 'text-slate-900';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600';

  const issueParam = useMemo(() => {
    const params = new URLSearchParams();
    if (issueSlug) params.set('issue', issueSlug);
    params.set('scope', 'codex');
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [issueSlug]);

  useEffect(() => {
    const fetchKn0wdz = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const origin = getApiOrigin();
        const issue = issueSlug || 'issue-1';
        const cacheKey = CacheManager.generateKey('qripto:knowdz', { issue });
        const data = await CacheManager.getOrSet(
          cacheKey,
          async () => {
            const res = await fetch(`${origin}/api/content/section/21knowdz${issueParam}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          },
          { ttl: 300, tags: [`qripto:knowdz:${issue}`] }
        );

        const content = data.content || data.data || [];
        setItems(Array.isArray(content) ? content : []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load Kn0wdZ');
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchKn0wdz();
  }, [issueParam]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [activeTab, items.length]);

  const tabItems = useMemo(() => {
    return items
      .filter((item) => badgeToTab(item.badge) === activeTab)
      .sort((a, b) => (a.position || 999) - (b.position || 999));
  }, [activeTab, items]);

  const selectedItem = tabItems[selectedIndex] || tabItems[0];
  const activePanel = panels[activeTab];
  const ActivePanelIcon = activePanel.icon;
  const isSelectedPremium = selectedItem ? isPremiumContent(selectedItem) : false;
  const isSelectedLocked = selectedItem ? isLockedContent(selectedItem, isOwnedItem) : false;

  const emitDvnReceipt = async (eventType: string, contentId: string) => {
    try {
      await fetch('/api/ops/dvn/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          contentId,
          personaId: null,
          issue: issueSlug || 'issue-1',
          source: 'QRIPTO_KNOWDZ_TAB',
        }),
      });
    } catch {
      // Fail-open for UX; DVN is optional.
    }
  };

  const openItem = async (item: Kn0wdZItem, modality: string | null) => {
    const eventType = modality === 'watch' ? 'content.watch' : modality === 'read' ? 'content.read' : 'content.view';
    const isLocked = isLockedContent(item, isOwnedItem);
    await actions.loadContent(item.id);
    if (isLocked) {
      actions.openWallet('full', 'payments');
      await emitDvnReceipt(eventType, item.id);
      return;
    }
    actions.setContentAccessGranted(true);
    actions.setViewerModality(modality);
    actions.setActiveDrawer('contentViewer');
    await emitDvnReceipt(eventType, item.id);
  };

  const getImage = (item: Kn0wdZItem) => item.image || item.cover_image_url;

  const openShareModal = (item: Kn0wdZItem) => {
    actions.openShare({
      id: item.id,
      title: item.title,
      description: item.excerpt,
      section: item.badge || activeTab.toUpperCase(),
      type: item.modalities?.watch ? 'video' : 'text',
      url: item.modalities?.link?.url,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabOrder.map((tab) => {
          const tabConfig = panels[tab];
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                isActive
                  ? tabConfig.tabClass
                  : 'border-slate-700/70 text-slate-300 hover:border-slate-500/70'
              }`}
            >
              {tab.toUpperCase()}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          {selectedItem ? (
            <button
              onClick={() => openItem(selectedItem, selectedItem.modalities?.read ? 'read' : null)}
              className={`group relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 transition-colors hover:border-slate-600`}
            >
              <div className="relative aspect-[4/3]">
                {getImage(selectedItem) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getImage(selectedItem)}
                    alt={selectedItem.title}
                    className={`absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                      isSelectedLocked ? 'opacity-60' : ''
                    }`}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                    <Brain className="h-10 w-10 text-slate-600" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                {isSelectedLocked && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-full bg-black/60 p-3">
                      <Lock className="h-5 w-5 text-amber-300" />
                    </div>
                  </div>
                )}
                <div className="absolute right-3 top-3 flex items-center gap-2">
                  <CodexBadge tone="indigo">{selectedItem.badge || activeTab.toUpperCase()}</CodexBadge>
                  {isSelectedPremium ? (
                    <CodexBadge tone="amber">
                      <Crown className="h-3 w-3" />
                      Premium
                    </CodexBadge>
                  ) : null}
                </div>
                <div className="absolute bottom-3 left-3 right-3 text-left">
                  <p className="text-sm font-semibold text-white line-clamp-2">{selectedItem.title}</p>
                  {selectedItem.excerpt && (
                    <p className="mt-1 text-xs text-slate-200 line-clamp-2">{selectedItem.excerpt}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <CodexActionRow
                      item={selectedItem}
                      variant="indigo"
                      showRead={!!selectedItem.modalities?.read}
                      showWatch={!!selectedItem.modalities?.watch}
                      showShare
                      onRead={() => openItem(selectedItem, 'read')}
                      onWatch={() => openItem(selectedItem, 'watch')}
                      onView={() => openItem(selectedItem, null)}
                      onShare={() => openShareModal(selectedItem)}
                    />
                  </div>
                </div>
              </div>
            </button>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900/40 text-sm text-slate-500">
              No {activeTab.toUpperCase()} content yet.
            </div>
          )}
        </div>

        <div className={`rounded-xl border p-4 ${activePanel.panelClass}`}>
          <div className="mb-3 flex items-center gap-2">
            <ActivePanelIcon className={`h-5 w-5 ${activePanel.accentClass}`} />
            <div>
              <p className={`text-sm font-semibold ${textClass}`}>{activePanel.title}</p>
              <p className="text-xs text-slate-400">{activePanel.subtitle}</p>
            </div>
          </div>

          {activeTab === 'dev' && (
            <pre className="text-xs text-cyan-300 bg-black/50 p-3 rounded-lg overflow-auto max-h-48 font-mono">
              {panels.dev.content}
            </pre>
          )}

          {activeTab === 'creative' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">{panels.creative.description}</p>
              <div className="rounded-lg bg-black/30 p-3">
                <p className="text-xs font-semibold text-white mb-2">Story Structure</p>
                {panels.creative.structure?.map((item, index) => (
                  <p key={item} className="text-xs text-slate-400">
                    {index + 1}. {item}
                  </p>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-white">Core Elements</span>
              </div>
              <p className="text-xs text-slate-400 ml-6">Visual Narrative Design</p>
            </div>
          )}

          {activeTab === 'exec' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">{panels.exec.description}</p>
              <div className="rounded-lg bg-black/30 p-3">
                <p className="text-xs font-semibold text-white mb-2">Key Imperatives</p>
                {panels.exec.imperatives?.map((item) => (
                  <p key={item} className="text-xs text-slate-400">
                    • {item}
                  </p>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-400" />
                <span className="text-sm text-white">Focus Areas</span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Layers className="h-5 w-5 text-slate-400" />
            <p className={`text-sm font-semibold ${textClass}`}>Resources</p>
          </div>
          <div className="space-y-2">
            {activePanel.resources.map((resource) => {
              const kind = (resource as { kind?: string }).kind;
              const isDocs = kind === 'docs';
              const isGithub = kind === 'github';
              const href = isDocs
                ? buildCodexUrl('agentiq-os-cartridge', { tab: 'docs-kb', personaId, from: 'qripto', fromTab: 'kn0wdz' })
                : isGithub
                  ? AGENTIQ_OS_GITHUB_URL
                  : undefined;
              const className = `flex items-center gap-3 rounded-lg p-2 transition-colors ${
                href ? 'hover:bg-white/10 cursor-pointer' : 'hover:bg-white/5'
              }`;
              const inner = (
                <>
                  <resource.icon className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm text-white">{resource.label}</p>
                    <p className="text-xs text-slate-400">{resource.desc}</p>
                  </div>
                </>
              );
              if (href) {
                return (
                  <a
                    key={resource.label}
                    href={href}
                    target={isGithub ? '_blank' : '_self'}
                    rel={isGithub ? 'noopener noreferrer' : undefined}
                    className={className}
                  >
                    {inner}
                  </a>
                );
              }
              return (
                <div key={resource.label} className={className}>
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-800 pt-3">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {tabItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => setSelectedIndex(index)}
              className={`group relative h-24 w-40 flex-shrink-0 overflow-hidden rounded-lg border transition-all ${
                selectedIndex === index
                  ? `border-slate-500 ring-2 ${activePanel.ringClass}`
                  : 'border-slate-800 hover:border-slate-500'
              }`}
            >
              {isPremiumContent(item) && (
                <div className="absolute top-2 right-2 z-10">
                  <CodexBadge tone="amber" className="px-1.5 py-0.5">
                    <Crown className="h-3 w-3" />
                  </CodexBadge>
                </div>
              )}
              {getImage(item) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getImage(item)}
                  alt={item.title}
                  className={`absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                    isLockedContent(item, isOwnedItem) ? 'opacity-60' : ''
                  }`}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                  <Brain className="h-6 w-6 text-slate-600" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              {isLockedContent(item, isOwnedItem) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Lock className="h-4 w-4 text-amber-300" />
                </div>
              )}
              <div className="absolute bottom-2 left-2 right-2 text-left">
                <p className="text-xs font-semibold text-white line-clamp-2">{item.title}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 && !error && (
        <div className={`text-sm ${mutedClass}`}>No Kn0wdZ content found for this issue.</div>
      )}

    </div>
  );
}
