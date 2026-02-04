'use client';

/**
 * KnytCardsGrid - Display KNYT Cards from Autonomys
 *
 * Phase 1 Pricing: Character cards are 2 KNYT (still) or 4 KNYT (motion)
 */

import { useState } from 'react';
import { X, Coins, ShoppingCart, Check, Users } from 'lucide-react';
import { ContentPurchaseModal } from '@/app/triad/components/content/ContentPurchaseModal';
import type { EpisodeGroup, KnytCardAsset } from '@/app/hooks/useKnytCards';

const KNYT_USD_RATE = 1.40;
const CARD_PRICE_STILL = 2;

interface KnytCardsGridProps {
  groups: EpisodeGroup[];
  ownedCharacters: Set<string>;
  personaId?: string;
  knytBalance?: number;
  spendableKnyt?: number;
  onBalanceRefresh?: () => void;
  onPurchaseComplete?: () => void;
}

export function KnytCardsGrid({
  groups,
  ownedCharacters,
  personaId,
  knytBalance = 0,
  spendableKnyt,
  onBalanceRefresh,
  onPurchaseComplete,
}: KnytCardsGridProps) {
  const [selected, setSelected] = useState<{ poster: KnytCardAsset; sheet?: KnytCardAsset } | null>(null);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseCard, setPurchaseCard] = useState<KnytCardAsset | null>(null);

  const cardsCount = groups.reduce((acc, group) => acc + group.posters.length, 0);

  const getOwnedStatus = (poster: KnytCardAsset) => {
    const key = poster.characterName || poster.id;
    return ownedCharacters.has(key);
  };

  const coverUrl = (cid?: string) => (cid ? `/api/content/cover/${cid}?variant=thumb` : '');

  if (!groups.length) {
    return (
      <div className="text-center py-12 text-white/60">
        No character cards available yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-400" />
          <h3 className="text-xl font-bold text-white">KNYT Cards</h3>
        </div>
        <p className="text-sm text-white/60 mt-1">
          Meet the heroes and villains of the metaKnyts universe ({cardsCount} cards)
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {groups.flatMap((group) =>
          group.posters.map((poster) => {
            const sheet =
              group.sheets.find((s) =>
                s.title.toLowerCase().includes(poster.title.toLowerCase().replace(' front', ''))
              ) || group.sheets[0];

            const isOwned = getOwnedStatus(poster);

            return (
              <div
                key={poster.id}
                onClick={() => setSelected({ poster, sheet })}
                className="relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-cyan-400 transition-all bg-gray-800 group"
              >
                <img
                  src={coverUrl(poster.autoDriveCid)}
                  alt={poster.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />

                {isOwned && (
                  <div className="absolute top-2 left-2 z-10">
                    <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/90 text-white text-xs font-bold">
                      <Check className="w-3 h-3" />
                      Owned
                    </span>
                  </div>
                )}

                {!isOwned && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/90 text-white text-xs font-bold">
                      <Coins className="w-3 h-3" />
                      {CARD_PRICE_STILL} KNYT
                    </span>
                  </div>
                )}

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
                  <p className="text-xs text-cyan-400 font-medium">
                    {poster.digiterraName || poster.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-amber-300">{CARD_PRICE_STILL} KNYT</span>
                    <span className="text-[10px] text-white/40">
                      (${(CARD_PRICE_STILL * KNYT_USD_RATE).toFixed(2)})
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2 md:p-4 overflow-auto"
          onClick={() => setSelected(null)}
        >
          <button
            onClick={() => setSelected(null)}
            className="absolute top-4 right-4 text-white/60 hover:text-white z-10"
          >
            <X className="w-8 h-8" />
          </button>

          <div className="w-full max-w-6xl my-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl md:text-2xl font-bold text-cyan-300 text-center mb-4">
              {selected.poster.digiterraName || selected.poster.title.replace(' front', '')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="group flex flex-col">
                <div className="aspect-[2/3] rounded-xl bg-black/50 overflow-hidden ring-1 ring-white/10 hover:ring-cyan-500/50 transition-all relative flex items-center justify-center">
                  <img
                    src={coverUrl(selected.poster.autoDriveCid)}
                    alt="Character Poster"
                    className="max-w-full max-h-full object-contain"
                  />
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

              {selected.sheet && (
                <div className="group flex flex-col">
                  <div className="aspect-[2/3] rounded-xl bg-black/50 overflow-hidden ring-1 ring-white/10 hover:ring-purple-500/50 transition-all relative flex items-center justify-center">
                    <img
                      src={coverUrl(selected.sheet.autoDriveCid)}
                      alt="Powers Sheet"
                      className="max-w-full max-h-full object-contain"
                    />
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

            <div className="mt-4 p-3 md:p-4 rounded-xl bg-white/5 ring-1 ring-white/10">
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

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                {getOwnedStatus(selected.poster) ? (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-500/50">
                    <Check className="w-5 h-5 text-emerald-400" />
                    <span className="text-lg font-bold text-emerald-300">OWNED</span>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="text-sm text-white/60">Price</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-amber-300">{CARD_PRICE_STILL} KNYT</span>
                        <span className="text-sm text-white/40">
                          (${(CARD_PRICE_STILL * KNYT_USD_RATE).toFixed(2)} USD)
                        </span>
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
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {purchaseCard && (
        <ContentPurchaseModal
          open={purchaseModalOpen}
          onClose={() => {
            setPurchaseModalOpen(false);
            setPurchaseCard(null);
          }}
          personaId={personaId}
          contentType="character_card"
          contentId={purchaseCard.id}
          contentTitle={purchaseCard.digiterraName || purchaseCard.title}
          contentImage={coverUrl(purchaseCard.autoDriveCid)}
          knytBalance={knytBalance}
          spendableKnyt={spendableKnyt}
          onPurchaseComplete={(entitlementId) => {
            setPurchaseModalOpen(false);
            setPurchaseCard(null);
            setSelected(null);
            onPurchaseComplete?.();
          }}
          onBalanceRefresh={onBalanceRefresh}
        />
      )}
    </div>
  );
}

export default KnytCardsGrid;
