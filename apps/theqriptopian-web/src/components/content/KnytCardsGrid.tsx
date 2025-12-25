/**
 * KnytCardsGrid - Display KNYT Cards from Autonomys
 * 
 * Phase 1 Pricing: Character cards are 2 KNYT (still) or 4 KNYT (motion)
 */

import { useState, useEffect } from 'react';
import { Loader2, Users, X, Coins, ShoppingCart, Check } from 'lucide-react';
import { ContentPurchaseModal, type ContentType } from './ContentPurchaseModal';

// Phase 1 Pricing Constants
const KNYT_USD_RATE = 1.40;
const CARD_PRICE_STILL = 2;  // 2 KNYT for character card (still)
const CARD_PRICE_MOTION = 4; // 4 KNYT for character card (motion)

interface KnytCardAsset {
  id: string;
  title: string;
  episodeNumber: number | null;
  assetKind: 'character_poster' | 'powers_sheet';
  autoDriveCid: string;
  characterName?: string;
  digiterraName?: string;
  affiliation?: string;
}

interface EpisodeGroup {
  episodeNumber: number;
  displayNumber: string;
  posters: KnytCardAsset[];
  sheets: KnytCardAsset[];
}

interface KnytCardsGridProps {
  personaId?: string;
  knytBalance?: number;
  spendableKnyt?: number;
  onBalanceRefresh?: () => void;
}

export function KnytCardsGrid({ personaId = '', knytBalance = 0, spendableKnyt, onBalanceRefresh }: KnytCardsGridProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<EpisodeGroup[]>([]);
  const [selected, setSelected] = useState<{ poster: KnytCardAsset; sheet?: KnytCardAsset } | null>(null);
  const [ownedCharacters, setOwnedCharacters] = useState<Set<string>>(new Set());
  
  // Purchase Modal state
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseCard, setPurchaseCard] = useState<KnytCardAsset | null>(null);

  useEffect(() => {
    async function fetchCards() {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const res = await fetch(`${apiUrl}/api/codex/knyt-cards`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setGroups(data.byEpisode || []);
      } catch (err) {
        setError('Failed to load KNYT cards');
      } finally {
        setLoading(false);
      }
    }
    fetchCards();
  }, []);

  // Fetch owned characters
  useEffect(() => {
    async function fetchOwned() {
      if (!personaId) return;
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
        const res = await fetch(`${apiUrl}/api/codex/owned?personaId=${personaId}`);
        if (!res.ok) return;
        const data = await res.json();
        console.log('[KnytCardsGrid] Owned characters data:', data);
        const owned = new Set(data.characters?.map((c: any) => c.characterId) || []);
        console.log('[KnytCardsGrid] Owned character IDs:', Array.from(owned));
        setOwnedCharacters(owned);
      } catch (err) {
        console.error('Failed to fetch owned characters:', err);
      }
    }
    fetchOwned();
  }, [personaId]);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
    </div>
  );

  if (error) return <div className="text-red-400 text-center py-8">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-cyan-400" />
        <h3 className="text-xl font-bold text-white">KNYT Cards</h3>
        <span className="text-white/60 text-sm">({groups.reduce((a, g) => a + g.posters.length, 0)} cards)</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {groups.flatMap(group => group.posters.map(poster => {
          const sheet = group.sheets.find(s => 
            s.title.toLowerCase().includes(poster.title.toLowerCase().replace(' front', ''))
          ) || group.sheets[0];
          
          // Check if character is owned (match by ID)
          const isOwned = ownedCharacters.has(poster.id);
          console.log('[KnytCardsGrid] Character:', poster.id, 'isOwned:', isOwned);
          
          return (
            <div
              key={poster.id}
              onClick={() => setSelected({ poster, sheet })}
              className="relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-cyan-400 transition-all bg-gray-800 group"
            >
              <img
                src={`${apiUrl}/api/content/cover/${poster.autoDriveCid}?variant=thumb`}
                alt={poster.title}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              
              {/* Owned badge - top left */}
              {isOwned && (
                <div className="absolute top-2 left-2 z-10">
                  <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/90 text-white text-xs font-bold">
                    <Check className="w-3 h-3" />
                    Owned
                  </span>
                </div>
              )}
              
              {/* Price badge - top right */}
              {!isOwned && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/90 text-white text-xs font-bold">
                    <Coins className="w-3 h-3" />
                    {CARD_PRICE_STILL} KNYT
                  </span>
                </div>
              )}
              
              {/* Action Icons - Buy button (same as Scrolls tab) */}
              {!isOwned && (
                <div className="absolute bottom-12 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="w-6 h-6 rounded-md bg-amber-500/80 backdrop-blur-sm flex items-center justify-center ring-1 ring-amber-400/40 text-white hover:bg-amber-400 transition-all"
                    title={`Buy for ${CARD_PRICE_STILL} KNYT`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPurchaseCard(poster);
                      setPurchaseModalOpen(true);
                    }}
                  >
                    <ShoppingCart className="w-3 h-3" />
                  </button>
                </div>
              )}
              
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black">
                <p className="text-xs text-cyan-400 font-medium">{poster.digiterraName || poster.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-amber-300">{CARD_PRICE_STILL} KNYT</span>
                  <span className="text-[10px] text-white/40">(${(CARD_PRICE_STILL * KNYT_USD_RATE).toFixed(2)})</span>
                </div>
              </div>
            </div>
          );
        }))}
      </div>

      {/* Modal - poster2 format (2 large posters side by side) */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2 md:p-4 overflow-auto" onClick={() => setSelected(null)}>
          <button onClick={() => setSelected(null)} className="absolute top-4 right-4 text-white/60 hover:text-white z-10">
            <X className="w-8 h-8" />
          </button>
          
          {/* poster2 layout - 2 columns, large posters with full card visibility */}
          <div className="w-full max-w-6xl my-auto" onClick={(e) => e.stopPropagation()}>
            {/* Character name header */}
            <h2 className="text-xl md:text-2xl font-bold text-cyan-300 text-center mb-4">
              {selected.poster.digiterraName || selected.poster.title.replace(' front', '')}
            </h2>
            
            {/* 2-column poster grid - taller aspect ratio (2:3) to show full card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* Front - Character Poster */}
              <div className="group flex flex-col">
                <div className="aspect-[2/3] rounded-xl bg-black/50 overflow-hidden ring-1 ring-white/10 hover:ring-cyan-500/50 transition-all relative flex items-center justify-center">
                  <img
                    src={`${apiUrl}/api/content/cover/${selected.poster.autoDriveCid}?variant=thumb`}
                    alt="Character Poster"
                    className="max-w-full max-h-full object-contain"
                  />
                  {/* Top-right badge */}
                  <div className="absolute top-3 right-3">
                    <span className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-xs font-medium text-cyan-300 ring-1 ring-white/20">
                      FRONT
                    </span>
                  </div>
                </div>
                <h4 className="mt-2 text-sm md:text-base font-semibold text-cyan-300 text-center">
                  Character Poster
                </h4>
              </div>
              
              {/* Back - Powers Sheet */}
              {selected.sheet && (
                <div className="group flex flex-col">
                  <div className="aspect-[2/3] rounded-xl bg-black/50 overflow-hidden ring-1 ring-white/10 hover:ring-purple-500/50 transition-all relative flex items-center justify-center">
                    <img
                      src={`${apiUrl}/api/content/cover/${selected.sheet.autoDriveCid}?variant=thumb`}
                      alt="Powers Sheet"
                      className="max-w-full max-h-full object-contain"
                    />
                    {/* Top-right badge */}
                    <div className="absolute top-3 right-3">
                      <span className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-xs font-medium text-purple-300 ring-1 ring-white/20">
                        BACK
                      </span>
                    </div>
                  </div>
                  <h4 className="mt-2 text-sm md:text-base font-semibold text-purple-300 text-center">
                    Powers Sheet
                  </h4>
                </div>
              )}
            </div>
            
            {/* Character info and pricing below */}
            <div className="mt-4 p-3 md:p-4 rounded-xl bg-white/5 ring-1 ring-white/10">
              {/* Character details */}
              {(selected.poster.characterName || selected.poster.affiliation) && (
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  {selected.poster.characterName && (
                    <div>
                      <span className="text-white/50">Terra Name:</span>
                      <span className="ml-2 text-white">{selected.poster.characterName}</span>
                    </div>
                  )}
                  {selected.poster.affiliation && (
                    <div>
                      <span className="text-white/50">Affiliation:</span>
                      <span className="ml-2 text-white">{selected.poster.affiliation}</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Pricing and Purchase */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <div>
                  <div className="text-sm text-white/60">Price</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-amber-300">{CARD_PRICE_STILL} KNYT</span>
                    <span className="text-sm text-white/40">(${(CARD_PRICE_STILL * KNYT_USD_RATE).toFixed(2)} USD)</span>
                  </div>
                  <div className="text-xs text-emerald-400 mt-0.5">
                    Pay with KNYT: {(CARD_PRICE_STILL * (1 - 0.20)).toFixed(1)} KNYT (20% off)
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPurchaseCard(selected.poster);
                    setPurchaseModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold transition-colors"
                >
                  <Coins className="w-4 h-4" />
                  Buy Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Content Purchase Modal */}
      {purchaseCard && (
        <ContentPurchaseModal
          open={purchaseModalOpen}
          onClose={() => { setPurchaseModalOpen(false); setPurchaseCard(null); }}
          personaId={personaId}
          contentType="character_card"
          contentId={purchaseCard.id}
          contentTitle={purchaseCard.digiterraName || purchaseCard.title}
          contentImage={`${apiUrl}/api/content/cover/${purchaseCard.autoDriveCid}?variant=thumb`}
          knytBalance={knytBalance}
          spendableKnyt={spendableKnyt}
          onPurchaseComplete={(entitlementId) => {
            console.log('[KnytCardsGrid] Purchase complete, entitlement:', entitlementId);
            setPurchaseModalOpen(false);
            setPurchaseCard(null);
            setSelected(null);
          }}
          onBalanceRefresh={onBalanceRefresh}
        />
      )}
    </div>
  );
}

export default KnytCardsGrid;
