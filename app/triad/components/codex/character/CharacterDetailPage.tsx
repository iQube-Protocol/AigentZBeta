"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Coins, Check, Star, Shield, Sword, Heart, Zap, User, MapPin, Calendar, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useKnytBalance } from "@/app/hooks/useKnytBalance";
import { useKnytPurchases } from "@/app/hooks/useKnytPurchases";
import { tokenPricingService } from "@/app/services/token/pricingService";
import type { KnytCardAsset } from "@/app/hooks/useKnytCards";

interface CharacterDetailPageProps {
  characterId: string;
  onBack?: () => void;
}

export function CharacterDetailPage({ characterId, onBack }: CharacterDetailPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { balance, spendableBalance, refreshBalance } = useKnytBalance();
  const { ownedCharacters, refreshPurchases } = useKnytPurchases();
  
  const [character, setCharacter] = useState<KnytCardAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [loadingPurchase, setLoadingPurchase] = useState(false);

  // Check if character is owned
  const isOwned = character ? ownedCharacters.has(character.id) : false;

  // Fetch character details
  useEffect(() => {
    const fetchCharacter = async () => {
      try {
        setLoading(true);
        
        // For now, we'll simulate fetching character data
        // In production, this would call an API endpoint
        // const response = await fetch(`/api/codex/character/${characterId}`);
        // const data = await response.json();
        
        // Mock character data based on the Netlify app structure
        const mockCharacter: KnytCardAsset = {
          id: characterId,
          title: getCharacterName(characterId),
          episodeNumber: getCharacterEpisode(characterId),
          assetKind: 'character_poster',
          autoDriveCid: getCharacterCid(characterId),
          mimeType: 'image/jpeg',
          characterName: getCharacterName(characterId),
          digiterraName: getCharacterDigiterraName(characterId),
          affiliation: getCharacterAffiliation(characterId),
          powers: getCharacterPowers(characterId),
          primaryWeapon: getCharacterWeapon(characterId),
        };
        
        setCharacter(mockCharacter);
      } catch (error) {
        console.error('Failed to fetch character:', error);
        toast({
          title: "Error",
          description: "Failed to load character details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (characterId) {
      fetchCharacter();
    }
  }, [characterId, toast]);

  const handlePurchase = async () => {
    if (!character || isOwned) return;
    
    setLoadingPurchase(true);
    try {
      // Purchase logic would go here
      toast({
        title: "Purchase Successful",
        description: `You now own ${character.characterName}!`,
      });
      
      // Refresh purchases and balance
      await Promise.all([
        refreshPurchases(),
        refreshBalance(),
      ]);
    } catch (error) {
      console.error('Purchase failed:', error);
      toast({
        title: "Purchase Failed",
        description: "Failed to complete purchase. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingPurchase(false);
      setPurchaseModalOpen(false);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-white/60">Loading character details...</p>
        </div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-white/60">Character not found</p>
          <Button onClick={handleBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  const pricing = tokenPricingService.getContentPricing('character_card');
  const discountPrice = tokenPricingService.calculatePaymentPricing(pricing.knyt);

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={handleBack} className="text-white/80 hover:text-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Characters
            </Button>
            
            {isOwned && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <Check className="w-3 h-3 mr-1" />
                Owned
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Character Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Character Image Card */}
          <div className="lg:col-span-1">
            <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0 overflow-hidden">
              <div className="aspect-square relative bg-slate-800/50">
                <img
                  src={`https://autonomys-ipfs.com/ipfs/${character.autoDriveCid}`}
                  alt={character.characterName}
                  className="w-full h-full object-cover"
                />
                
                {/* Rarity Badge */}
                <div className="absolute top-4 right-4">
                  <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30">
                    {getCharacterRarity(characterId)}
                  </Badge>
                </div>
                
                {/* Owned Overlay */}
                {isOwned && (
                  <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                    <div className="text-center">
                      <Check className="w-16 h-16 text-emerald-400 mx-auto mb-2" />
                      <span className="text-emerald-300 font-bold">OWNED</span>
                    </div>
                  </div>
                )}
              </div>
              
              <CardContent className="p-6">
                <h1 className="text-2xl font-bold text-white mb-2">{character.characterName}</h1>
                <p className="text-white/60 mb-4">{character.affiliation}</p>
                
                {/* Quick Stats */}
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-white/60">Episode</span>
                    <span className="text-white">#{character.episodeNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Powers</span>
                    <span className="text-white">{character.powers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Weapon</span>
                    <span className="text-white">{character.primaryWeapon}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Purchase Card */}
            {!isOwned && (
              <Card className="mt-6 backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Purchase Character</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Price</span>
                      <div className="text-right">
                        <div className="text-lg font-bold text-amber-300">
                          {tokenPricingService.formatPriceDisplay(pricing)}
                        </div>
                        <div className="text-xs text-emerald-400">
                          KNYT: {discountPrice.knyt.amount.toFixed(1)} (20% off)
                        </div>
                      </div>
                    </div>
                    
                    <Button 
                      onClick={handlePurchase}
                      disabled={loadingPurchase || (spendableBalance || 0) < discountPrice.knyt.amount}
                      className="w-full bg-purple-500 hover:bg-purple-600 disabled:opacity-50"
                    >
                      {loadingPurchase ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                      ) : (
                        <>
                          <Coins className="w-4 h-4 mr-2" />
                          Purchase Now
                        </>
                      )}
                    </Button>
                    
                    {(spendableBalance || 0) < discountPrice.knyt.amount && (
                      <p className="text-xs text-red-400 text-center">
                        Insufficient KNYT balance
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Character Details */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Description */}
            <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-400" />
                  Character Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-white/80 leading-relaxed">{getCharacterDescription(characterId)}</p>
              </CardContent>
            </Card>

            {/* Powers */}
            <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  Powers & Abilities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-white/5 rounded-lg">
                  <h4 className="font-semibold text-white mb-1">Primary Powers</h4>
                  <p className="text-sm text-white/60">{character.powers}</p>
                </div>
              </CardContent>
            </Card>

            {/* Weapon */}
            <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Sword className="w-5 h-5 text-red-400" />
                  Primary Weapon
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{character.primaryWeapon}</div>
                  <div className="text-sm text-white/60">Weapon Type</div>
                </div>
              </CardContent>
            </Card>

            {/* Backstory */}
            <Card className="backdrop-blur-xl bg-white/5 ring-1 ring-white/10 border-0">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  Backstory
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-white/80 leading-relaxed whitespace-pre-wrap">
                  {getCharacterBackstory(characterId)}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions for mock data
function getCharacterName(id: string): string {
  const names: Record<string, string> = {
    'char1': 'Kael the Void Walker',
    'char2': 'Lyra Starweaver',
    'char3': 'Thorne Ironheart',
    'char4': 'Seraphina Moonwhisper',
    'char5': 'Zephyr Stormborn',
  };
  return names[id] || 'Unknown Character';
}

function getCharacterAffiliation(id: string): string {
  const affiliations: Record<string, string> = {
    'char1': 'Order of the Void',
    'char2': 'Celestial Guild',
    'char3': 'Iron Brotherhood',
    'char4': 'Lunar Circle',
    'char5': 'Storm Guard',
  };
  return affiliations[id] || 'Unknown Affiliation';
}

function getCharacterDigiterraName(id: string): string {
  return getCharacterName(id);
}

function getCharacterCid(id: string): string {
  return 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55mbzdv'; // Mock CID
}

function getCharacterEpisode(id: string): number {
  const episodes: Record<string, number> = {
    'char1': 1,
    'char2': 2,
    'char3': 3,
    'char4': 4,
    'char5': 5,
  };
  return episodes[id] || 1;
}

function getCharacterRarity(id: string): string {
  const rarities: Record<string, string> = {
    'char1': 'Legendary',
    'char2': 'Epic',
    'char3': 'Rare',
    'char4': 'Uncommon',
    'char5': 'Common',
  };
  return rarities[id] || 'Common';
}

function getCharacterPowers(id: string): string {
  const powers: Record<string, string> = {
    'char1': 'Void Walk, Data Weave, Quantum Shield',
    'char2': 'Star Weave, Celestial Light, Astral Projection',
    'char3': 'Iron Will, Earth Shield, Forge Master',
    'char4': 'Moon Whisper, Lunar Shield, Night Vision',
    'char5': 'Storm Call, Lightning Strike, Wind Walk',
  };
  return powers[id] || 'Unknown Powers';
}

function getCharacterWeapon(id: string): string {
  const weapons: Record<string, string> = {
    'char1': 'Void Blade',
    'char2': 'Star Staff',
    'char3': 'Iron Hammer',
    'char4': 'Moon Dagger',
    'char5': 'Storm Sword',
  };
  return weapons[id] || 'Unknown Weapon';
}

function getCharacterDescription(id: string): string {
  return `A mysterious figure from the KNYT universe, wielding powers that defy conventional understanding. This character plays a crucial role in the ongoing conflict between the digital and physical realms.`;
}

function getCharacterAbilities(id: string): Array<{name: string; description: string}> {
  return [
    { name: 'Void Walk', description: 'Phase through digital barriers' },
    { name: 'Data Weave', description: 'Manipulate digital information flows' },
    { name: 'Quantum Shield', description: 'Protect against digital attacks' },
  ];
}

function getCharacterStats(id: string): Record<string, number> {
  return {
    power: 85,
    defense: 70,
    speed: 90,
    magic: 95,
  };
}

function getCharacterBackstory(id: string): string {
  return `Born in the digital realm, this character discovered their unique abilities during the Great Convergence. Trained by the ancient masters of the code, they now serve as a guardian of the boundary between worlds. Their journey has been marked by countless battles against the forces that seek to corrupt the digital-physical interface.`;
}

function getCharacterRelationships(id: string): Array<{character: string; type: string; status: string}> {
  return [
    { character: 'The Archivist', type: 'Mentor', status: 'Allied' },
    { character: 'Shadow Walker', type: 'Rival', status: 'Neutral' },
    { character: 'Digital Oracle', type: 'Guide', status: 'Allied' },
  ];
}

function getCharacterFirstAppearance(id: string): string {
  return `Episode ${getCharacterEpisode(id)}`;
}

function getRarityBadgeClass(rarity: string): string {
  const classes: Record<string, string> = {
    'Legendary': 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border-yellow-500/30',
    'Epic': 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30',
    'Rare': 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/30',
    'Uncommon': 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border-green-500/30',
    'Common': 'bg-gradient-to-r from-gray-500/20 to-slate-500/20 text-gray-400 border-gray-500/30',
  };
  return classes[rarity] || classes['Common'];
}
