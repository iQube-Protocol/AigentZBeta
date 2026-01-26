/**
 * ContentPurchaseModal - Content Purchase Modal
 * 
 * Ported from Qriptopian Web App with SmartTriad integration
 * Handles content purchase flows with KNYT and payment options.
 */

import { useState } from 'react';
import { X, Coins, ShoppingCart, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type ContentType = 'scroll_still' | 'scroll_motion' | 'character_card' | 'lore_access';

interface ContentPurchaseModalProps {
  open: boolean;
  onClose: () => void;
  personaId?: string;
  contentType: ContentType;
  contentId: string;
  contentTitle: string;
  contentImage?: string;
  knytBalance: number;
  spendableKnyt: number;
  onPurchaseComplete: () => void;
  onBalanceRefresh: () => void;
}

export function ContentPurchaseModal({
  open,
  onClose,
  personaId,
  contentType,
  contentId,
  contentTitle,
  contentImage,
  knytBalance,
  spendableKnyt,
  onPurchaseComplete,
  onBalanceRefresh,
}: ContentPurchaseModalProps) {
  const [purchaseMethod, setPurchaseMethod] = useState<'knyt' | 'paypal'>('knyt');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get pricing based on content type
  const getPrice = () => {
    switch (contentType) {
      case 'scroll_still':
        return 3;
      case 'scroll_motion':
        return 5;
      case 'character_card':
        return 2;
      case 'lore_access':
        return 1;
      default:
        return 3;
    }
  };

  const price = getPrice();
  const canAffordWithKnyt = spendableKnyt >= price;

  const handlePurchase = async () => {
    if (!personaId) {
      setError('Authentication required. Please connect your wallet.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const endpoint = purchaseMethod === 'knyt' 
        ? '/api/codex/knyt-purchase'
        : '/api/wallet/knyt/purchase/paypal';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personaId,
          assetId: contentId,
          assetKind: contentType,
          characterName: contentTitle,
          paymentMethod: purchaseMethod,
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (purchaseMethod === 'paypal' && result.redirectUrl) {
          // Redirect to PayPal
          window.location.href = result.redirectUrl;
        } else {
          // KNYT purchase completed
          onPurchaseComplete();
          onBalanceRefresh();
          onClose();
        }
      } else {
        setError(result.error || 'Purchase failed. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm">
      <div className="h-full flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-950/90 backdrop-blur-xl rounded-2xl ring-1 ring-white/10 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <div>
              <h3 className="text-lg font-semibold text-white">Purchase Content</h3>
              <p className="text-sm text-white/60 mt-1">{contentTitle}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/10"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content Preview */}
          {contentImage && (
            <div className="p-6 border-b border-white/10">
              <div className="aspect-video relative rounded-lg overflow-hidden bg-slate-800/50">
                <img
                  src={contentImage}
                  alt={contentTitle}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Purchase Details */}
          <div className="p-6 space-y-4">
            {/* Price */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg border border-purple-500/20">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <span className="text-white font-medium">Price</span>
              </div>
              <span className="text-xl font-bold text-amber-400">{price} KNYT</span>
            </div>

            {/* Balance */}
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white/60">Your Balance</span>
                <span className="text-white font-medium">{knytBalance.toLocaleString()} KNYT</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Spendable</span>
                <span className="text-sm text-white/80">{spendableKnyt.toLocaleString()} KNYT</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={purchaseMethod === 'knyt' ? 'default' : 'outline'}
                  className={`${
                    purchaseMethod === 'knyt'
                      ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                      : 'border-white/20 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                  onClick={() => setPurchaseMethod('knyt')}
                  disabled={!canAffordWithKnyt}
                >
                  <Coins className="w-4 h-4 mr-2" />
                  KNYT
                  {!canAffordWithKnyt && (
                    <span className="ml-auto text-xs text-red-400">Insufficient</span>
                  )}
                </Button>
                
                <Button
                  variant={purchaseMethod === 'paypal' ? 'default' : 'outline'}
                  className={`${
                    purchaseMethod === 'paypal'
                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      : 'border-white/20 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                  onClick={() => setPurchaseMethod('paypal')}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  PayPal
                </Button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              </div>
            )}

            {/* Purchase Button */}
            <Button
              onClick={handlePurchase}
              disabled={isProcessing || (purchaseMethod === 'knyt' && !canAffordWithKnyt)}
              className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-medium"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                <>
                  {purchaseMethod === 'knyt' ? (
                    <>
                      <Coins className="w-4 h-4 mr-2" />
                      Purchase for {price} KNYT
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Continue with PayPal
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
