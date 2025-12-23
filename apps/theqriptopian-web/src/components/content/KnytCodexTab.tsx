/**
 * KnytCodexTab - Dynamic KNYT Codex UI with multiple content tabs
 * 
 * Tab navigation is now handled by the parent CodexDrawer header.
 * This component receives the activeTab prop and renders the appropriate content.
 * 
 * The 'codex' tab now uses the Liquid UI template system (CodexLiquidUITab).
 * All other tabs (scrolls, characters, lore, etc.) remain unchanged.
 */

import { useState, useEffect, lazy, Suspense, Component, type ReactNode, useMemo } from 'react';
import { Loader2, BookOpen, Play, Lock, Check, Sparkles, Coins, ShoppingCart, AlertTriangle, RefreshCw } from 'lucide-react';
import { PDFViewer } from './PDFViewer';
import { VideoPlayer } from './VideoPlayer';
import { KnytCardsGrid } from './KnytCardsGrid';
import { ContentPurchaseModal, type ContentType } from './ContentPurchaseModal';
import { CodexHomeTab, LoreTab, DigiTerraTab, TerraTab, OrderOfMetayeTab } from './codex';

// Lazy load Liquid UI to prevent breaking other tabs if there are import issues
const CodexLiquidUITab = lazy(() => 
  import('@/components/codex/CodexLiquidUITab').then(mod => ({ default: mod.CodexLiquidUITab }))
);

// Error Boundary for Codex - prevents crashes from breaking the entire UI
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class CodexErrorBoundary extends Component<{ children: ReactNode; onRetry?: () => void }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; onRetry?: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[CodexErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center p-6">
          <AlertTriangle className="w-12 h-12 text-amber-400 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Codex Loading Error</h3>
          <p className="text-white/60 mb-4 max-w-md">
            There was an issue loading the Codex. This may be due to a network issue or service unavailability.
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Feature flag for Liquid UI on the 'codex' tab
const ENABLE_LIQUID_UI_CODEX_TAB = true;

// Phase 1 Pricing Constants (from knytPricingService)
const KNYT_USD_RATE = 1.40;
const KNYT_DISCOUNT_PERCENT = 0.20;

// Base prices in KNYT for content types
const CONTENT_PRICES = {
  scroll_still: 3,      // Single scroll (still/PDF)
  scroll_motion: 5,     // Single scroll (motion comic)
  character_card: 2,    // Character card (still)
  character_card_motion: 4, // Character card (motion)
  bundle_3_still: 8,    // 3-scroll bundle (stills)
  bundle_5_still: 12,   // 5-scroll bundle (stills)
  bundle_3_motion: 12,  // 3-scroll bundle (motion)
  bundle_5_motion: 18,  // 5-scroll bundle (motion)
  season_codex_still: 25, // Full season (stills)
  season_codex_motion: 40, // Full season (motion)
};

// Types
interface Episode {
  episodeNumber: number;
  displayNumber: string;
  title: string;
  description?: string;
  coverImageCid?: string;
  hasStillMaster: boolean;
  hasMotionMaster: boolean;
  hasPrintRare: boolean;
  hasPrintEpic: boolean;
  hasPrintLegendary: boolean;
  printRareCid?: string;
  printEpicCid?: string;
  printLegendaryCid?: string;
  motionMasterCid?: string;
  availableCovers: number;
  priceKnyt?: number;
}

interface OwnedIssue {
  issueId: string;
  episodeNumber: number;
  coverTitle: string;
  coverVariant?: string;
  rarityTier?: string;
  editionSerial: number;
  editionMax?: number;
  custodyMode: 'custodial' | 'canonical';
  mintedAt: string;
}

type CodexTab = 'codex' | 'scrolls' | 'characters' | 'lore' | 'digiterra' | 'terra' | 'order';

interface KnytCodexTabProps {
  viewMode?: 'grid' | 'detail' | 'owned' | 'reader';
  activeTab?: CodexTab;
  onTabChange?: (tab: CodexTab) => void;
  selectedEpisode?: number;
  highlightedIssue?: string;
  onMintRequest?: (episodeNumber: number) => void;
  onReadRequest?: (issueId: string) => void;
  onWatchRequest?: (issueId: string) => void;
  personaId?: string;
  knytBalance?: number;      // Total KNYT (DVN + EVM)
  spendableKnyt?: number;    // DVN balance only (Tier 0 spendable)
  onBalanceRefresh?: () => void;
}

export function KnytCodexTab({
  viewMode = 'grid',
  activeTab = 'codex',
  onTabChange,
  selectedEpisode,
  highlightedIssue,
  onMintRequest,
  onReadRequest,
  onWatchRequest,
  personaId = '',
  knytBalance = 0,
  spendableKnyt,
  onBalanceRefresh,
}: KnytCodexTabProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [ownedIssues, setOwnedIssues] = useState<OwnedIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // PDF Reader state
  const [pdfReaderOpen, setPdfReaderOpen] = useState(false);
  const [currentPdfCid, setCurrentPdfCid] = useState<string | null>(null);
  const [currentPdfTitle, setCurrentPdfTitle] = useState<string>('');
  
  // Video Player state
  const [videoPlayerOpen, setVideoPlayerOpen] = useState(false);
  const [currentVideoCid, setCurrentVideoCid] = useState<string | null>(null);
  const [currentVideoTitle, setCurrentVideoTitle] = useState<string>('');
  const [videoSegments, setVideoSegments] = useState<Array<{ auto_drive_cid?: string }>>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  
  // Purchase Modal state
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseContent, setPurchaseContent] = useState<{
    type: ContentType;
    id: string;
    title: string;
    image?: string;
  } | null>(null);

  const [visitedTabs, setVisitedTabs] = useState<Set<CodexTab>>(() => new Set([activeTab]));

  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // Fetch episodes
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        console.log('[KnytCodexTab] Fetching episodes...');
        const apiBase = import.meta.env.VITE_API_URL || '';
        const statusRes = await fetch(`${apiBase}/api/admin/codex/status?series=metaKnyts`);
        console.log('[KnytCodexTab] Response status:', statusRes.status);
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          console.log('[KnytCodexTab] Episodes received:', statusData.episodes?.length, statusData);
          const episodeList: Episode[] = statusData.episodes?.map((ep: Episode & { coverImageCid?: string }) => ({
            episodeNumber: ep.episodeNumber,
            displayNumber: ep.displayNumber || `#${ep.episodeNumber - 1}`,
            title: ep.title || `Episode ${ep.displayNumber || ep.episodeNumber}`,
            coverImageCid: ep.coverImageCid,
            hasStillMaster: ep.hasStillMaster,
            hasMotionMaster: ep.hasMotionMaster,
            hasPrintRare: ep.hasPrintRare,
            hasPrintEpic: ep.hasPrintEpic,
            hasPrintLegendary: ep.hasPrintLegendary,
            printRareCid: ep.printRareCid,
            printEpicCid: ep.printEpicCid,
            printLegendaryCid: ep.printLegendaryCid,
            motionMasterCid: ep.motionMasterCid,
            availableCovers: ep.coverCount,
          })) || [];
          setEpisodes(episodeList);
        }
        setError(null);
      } catch (err) {
        console.error('[KnytCodex] Fetch error:', err);
        setError('Failed to load Codex');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const getOwnedIssuesForEpisode = (episodeNumber: number) => {
    return ownedIssues.filter(i => i.episodeNumber === episodeNumber);
  };

  // Render Scrolls tab content (episodes grid)
  const renderScrollsTab = () => (
    <>
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white">Digital Scrolls</h3>
        <p className="text-sm text-white/60">Episodes and motion comics from the metaKnyts saga</p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {episodes.map((episode) => {
          const owned = getOwnedIssuesForEpisode(episode.episodeNumber);
          const isOwned = owned.length > 0;
          const hasMaster = episode.hasStillMaster || episode.hasMotionMaster || episode.hasPrintRare || episode.hasPrintEpic || episode.hasPrintLegendary;
          const isAvailable = hasMaster && episode.availableCovers > 0;

          return (
            <div
              key={episode.episodeNumber}
              className={`group relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 ${
                isOwned ? 'ring-2 ring-cyan-400/50' : 'hover:ring-2 hover:ring-white/30'
              }`}
              onClick={() => {
                const printCid = episode.printRareCid || episode.printEpicCid || episode.printLegendaryCid;
                if (printCid) {
                  setCurrentPdfCid(printCid);
                  setCurrentPdfTitle(episode.title || `Episode ${episode.displayNumber}`);
                  setPdfReaderOpen(true);
                } else {
                  onMintRequest?.(episode.episodeNumber);
                }
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-900 to-black">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-6xl font-bold text-white/10">{episode.episodeNumber}</span>
                </div>
              </div>
              {episode.coverImageCid && (
                <img
                  src={`${import.meta.env.VITE_API_URL || ''}/api/content/cover/${episode.coverImageCid}`}
                  alt={episode.title}
                  className="absolute inset-0 w-full h-full object-cover object-top"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />
              
              {/* Status badges */}
              <div className="absolute top-2 right-2 flex flex-col gap-1">
                {isOwned && (
                  <span className="px-2 py-1 bg-cyan-500/80 text-white text-xs font-bold rounded flex items-center gap-1">
                    <Check className="w-3 h-3" /> OWNED
                  </span>
                )}
                {!isAvailable && !isOwned && (
                  <span className="px-2 py-1 bg-gray-500/80 text-white text-xs font-bold rounded flex items-center gap-1">
                    <Lock className="w-3 h-3" /> SOON
                  </span>
                )}
                {/* Price badge on hover for available items */}
                {isAvailable && !isOwned && (
                  <span className="px-2 py-1 bg-amber-500/90 text-white text-xs font-bold rounded flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Coins className="w-3 h-3" />
                    {episode.hasMotionMaster ? CONTENT_PRICES.scroll_motion : CONTENT_PRICES.scroll_still} KNYT
                  </span>
                )}
              </div>

              {/* Action Icons */}
              <div className="absolute bottom-12 right-2 flex gap-1 z-10">
                {/* Buy button for available episodes */}
                {isAvailable && !isOwned && (
                  <button
                    className="w-6 h-6 rounded-md bg-amber-500/80 backdrop-blur-sm flex items-center justify-center ring-1 ring-amber-400/40 text-white hover:bg-amber-400 transition-all"
                    title={`Buy for ${episode.hasMotionMaster ? CONTENT_PRICES.scroll_motion : CONTENT_PRICES.scroll_still} KNYT`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPurchaseContent({
                        type: episode.hasMotionMaster ? 'scroll_motion' : 'scroll_still',
                        id: `mk_ep${String(episode.episodeNumber).padStart(2, '0')}`,
                        title: episode.title || `Episode ${episode.displayNumber}`,
                        image: episode.coverImageCid ? `${import.meta.env.VITE_API_URL || ''}/api/content/cover/${episode.coverImageCid}` : undefined,
                      });
                      setPurchaseModalOpen(true);
                    }}
                  >
                    <ShoppingCart className="w-3 h-3" />
                  </button>
                )}
                {(episode.hasPrintRare || episode.hasPrintEpic || episode.hasPrintLegendary) && (
                  <button
                    className="w-6 h-6 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center ring-1 ring-cyan-500/40 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all"
                    title="Read"
                    onClick={(e) => {
                      e.stopPropagation();
                      const printCid = episode.printRareCid || episode.printEpicCid || episode.printLegendaryCid;
                      if (printCid) {
                        setCurrentPdfCid(printCid);
                        setCurrentPdfTitle(episode.title || `Episode ${episode.displayNumber}`);
                        setPdfReaderOpen(true);
                      }
                    }}
                  >
                    <BookOpen className="w-3 h-3" />
                  </button>
                )}
                {episode.hasMotionMaster && episode.motionMasterCid && (
                  <button
                    className="w-6 h-6 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center ring-1 ring-cyan-500/40 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-all"
                    title="Watch"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPdfReaderOpen(false);
                      setCurrentVideoTitle(`${episode.title} - Motion Comic`);
                      const motionId = `mk_ep${String(episode.episodeNumber).padStart(2, '0')}_motion`;
                      try {
                        const segRes = await fetch(`/api/content/video/segments?episodeId=${motionId}`);
                        const segs = segRes.ok ? await segRes.json() : [];
                        if (segs.length > 0) {
                          setVideoSegments(segs);
                          setCurrentSegmentIndex(0);
                          setCurrentVideoCid(segs[0].auto_drive_cid);
                        } else {
                          setVideoSegments([]);
                          setCurrentVideoCid(episode.motionMasterCid!);
                        }
                      } catch {
                        setVideoSegments([]);
                        setCurrentVideoCid(episode.motionMasterCid!);
                      }
                      setVideoPlayerOpen(true);
                    }}
                  >
                    <Play className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Episode info */}
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-xs text-cyan-400 font-medium">Episode {episode.displayNumber}</p>
                <p className="text-sm font-bold text-white line-clamp-2">{episode.title}</p>
                {isOwned ? (
                  <p className="text-xs text-cyan-400 mt-1">{owned.length} issue{owned.length > 1 ? 's' : ''} owned</p>
                ) : isAvailable ? (
                  <div className="flex items-center gap-2 mt-1">
                    {episode.hasMotionMaster ? (
                      <>
                        <span className="text-xs font-medium text-amber-300">{CONTENT_PRICES.scroll_motion} KNYT</span>
                        <span className="text-[10px] text-white/40">(${(CONTENT_PRICES.scroll_motion * KNYT_USD_RATE).toFixed(2)})</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-medium text-amber-300">{CONTENT_PRICES.scroll_still} KNYT</span>
                        <span className="text-[10px] text-white/40">(${(CONTENT_PRICES.scroll_still * KNYT_USD_RATE).toFixed(2)})</span>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="absolute inset-0 bg-cyan-500/0 group-hover:bg-cyan-500/10 transition-colors" />
            </div>
          );
        })}
      </div>

      {episodes.length === 0 && (
        <div className="text-center py-12 text-white/60">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No episodes available yet</p>
          <p className="text-sm mt-1">Check back soon for new Digital Scrolls</p>
        </div>
      )}
    </>
  );

  // Render Characters tab (KNYT Cards)
  const renderCharactersTab = () => (
    <>
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white">KNYT Cards</h3>
        <p className="text-sm text-white/60">Meet the heroes and villains of the metaKnyts universe</p>
      </div>
      <KnytCardsGrid personaId={personaId} knytBalance={knytBalance} spendableKnyt={spendableKnyt} onBalanceRefresh={onBalanceRefresh} />
    </>
  );

  const tabPanels = useMemo(() => {
    const panels: Partial<Record<CodexTab, ReactNode>> = {};

    if (loading || error) return panels;

    if (visitedTabs.has('codex')) {
      panels.codex = ENABLE_LIQUID_UI_CODEX_TAB ? (
        <CodexErrorBoundary onRetry={onBalanceRefresh}>
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                <span className="ml-3 text-white/70">Loading Codex...</span>
              </div>
            }
          >
            <CodexLiquidUITab
              personaId={personaId}
              knytBalance={knytBalance}
              spendableKnyt={spendableKnyt}
              onBalanceRefresh={onBalanceRefresh}
              onNavigateToTab={(tab) => onTabChange?.(tab as CodexTab)}
            />
          </Suspense>
        </CodexErrorBoundary>
      ) : (
        <CodexHomeTab onNavigate={(tab) => onTabChange?.(tab as CodexTab)} />
      );
    }

    if (visitedTabs.has('scrolls')) panels.scrolls = renderScrollsTab();
    if (visitedTabs.has('characters')) panels.characters = renderCharactersTab();
    if (visitedTabs.has('lore')) panels.lore = <LoreTab />;
    if (visitedTabs.has('digiterra')) panels.digiterra = <DigiTerraTab />;
    if (visitedTabs.has('terra')) panels.terra = <TerraTab />;
    if (visitedTabs.has('order')) panels.order = <OrderOfMetayeTab />;

    return panels;
  }, [
    loading,
    error,
    visitedTabs,
    personaId,
    knytBalance,
    spendableKnyt,
    onBalanceRefresh,
    onTabChange,
  ]);

  return (
    <>
      {/* PDF Reader Modal */}
      {pdfReaderOpen && currentPdfCid && (
        <PDFViewer
          pdfUrl={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/content/pdf/${currentPdfCid}`}
          title={currentPdfTitle}
          onClose={() => { setPdfReaderOpen(false); setCurrentPdfCid(null); }}
        />
      )}
      
      {/* Video Player Modal */}
      {videoPlayerOpen && currentVideoCid && (
        <VideoPlayer
          videoUrl={`/api/content/video/${currentVideoCid}`}
          title={currentVideoTitle}
          onClose={() => { setVideoPlayerOpen(false); setCurrentVideoCid(null); setVideoSegments([]); }}
          segments={videoSegments}
          currentSegmentIndex={currentSegmentIndex}
          onSegmentChange={(index) => {
            setCurrentSegmentIndex(index);
            setCurrentVideoCid(videoSegments[index]?.auto_drive_cid);
          }}
        />
      )}
      
      {/* Content Purchase Modal */}
      {purchaseContent && (
        <ContentPurchaseModal
          open={purchaseModalOpen}
          onClose={() => { setPurchaseModalOpen(false); setPurchaseContent(null); }}
          personaId={personaId}
          contentType={purchaseContent.type}
          contentId={purchaseContent.id}
          contentTitle={purchaseContent.title}
          contentImage={purchaseContent.image}
          knytBalance={knytBalance}
          spendableKnyt={spendableKnyt}
          onPurchaseComplete={(entitlementId) => {
            console.log('[KnytCodex] Purchase complete, entitlement:', entitlementId);
            setPurchaseModalOpen(false);
            setPurchaseContent(null);
          }}
          onBalanceRefresh={onBalanceRefresh}
        />
      )}
      
      {/* Tab Content - no internal tab navigation, controlled by parent */}
      <div className="min-h-[400px]">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            <span className="ml-3 text-white/70">Loading KNYT Codex...</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center h-64 text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {(Object.keys(tabPanels) as CodexTab[]).map((tabKey) => (
              <div
                key={tabKey}
                style={{ display: tabKey === activeTab ? 'block' : 'none' }}
              >
                {tabPanels[tabKey]}
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
