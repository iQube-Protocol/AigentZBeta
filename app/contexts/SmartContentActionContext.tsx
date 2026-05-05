/**
 * SmartContentActionContext - Global action handler for SmartContent
 * 
 * PORTED FROM NETLIFY DEPLOYMENT with agentiQ adaptations
 * 
 * ARCHITECTURAL PRINCIPLE: SmartContent actions are ATOMIC and UNIVERSAL.
 * Actions are determined by the content's modalities, not by the section or component.
 * This context provides global handling so components don't need local handlers.
 * 
 * This follows the Liquid UI model where content behavior is intrinsic to the content,
 * not dependent on where it's displayed.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { shareArticle } from '@/packages/smarttriad/src/socialSharing';
import { getCurrentPersonaId, resolveCurrentPersona } from '@/app/services/personaService';
import type { SmartContentItem, ActionType } from '@/packages/smarttriad/src/types';
import type { SmartWalletContentPayload } from '@/app/wallet/contracts';
import {
  addSmartWalletEventListener,
  dispatchOpenSmartWalletDrawer,
  dispatchSmartWalletPayment,
  SMART_WALLET_EVENTS,
} from '@/app/wallet/events';

// Import agentiQ-specific components
import { VideoModal } from '@/packages/smarttriad/src/VideoModal';
import { SocialSharingModal } from '@/packages/smarttriad/src/SocialSharingModal';
import { PDFLiteReaderModal } from '@/app/triad/components/content/PDFLiteReaderModal';
import { PDFPageViewer } from '@/app/triad/components/content/PDFPageViewer';

interface SmartContentActionContextValue {
  /**
   * Execute an action on a content item.
   * This is the UNIVERSAL action handler - use this instead of local handlers.
   */
  executeAction: (action: ActionType, item: SmartContentItem, playlist?: SmartContentItem[]) => void;
  
  /**
   * Create an onAction handler for SmartContentActions component.
   * Pass the content item and get back a handler function.
   */
  createHandler: (item: SmartContentItem, playlist?: SmartContentItem[]) => (action: ActionType) => void;
}

const SmartContentActionContext = createContext<SmartContentActionContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
}

export function SmartContentActionProvider({ children }: ProviderProps) {
  // Global modal state
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoItem, setVideoItem] = useState<SmartContentItem | null>(null);
  const [videoPlaylist, setVideoPlaylist] = useState<SmartContentItem[]>([]);
  const [videoIndex, setVideoIndex] = useState(0);
  
  // Article reader state (simplified for agentiQ)
  const [readArticle, setReadArticle] = useState<SmartContentItem | null>(null);
  const [articleModalOpen, setArticleModalOpen] = useState(false);
  
  // PDF viewer state
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfItem, setPdfItem] = useState<SmartContentItem | null>(null);
  
  // Social sharing modal state
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareItem, setShareItem] = useState<SmartContentItem | null>(null);
  
  // TODO: Add audio player state when implemented
  // const [audioItem, setAudioItem] = useState<SmartContentItem | null>(null);

  useEffect(() => {
    const ensurePersonaId = async () => {
      if (getCurrentPersonaId()) return;

      try {
        await resolveCurrentPersona();
      } catch (error) {
        console.warn('[SmartContentAction] Failed to resolve persona:', error);
      }
    };

    ensurePersonaId();
  }, []);

  /**
   * Handle payment action by determining and invoking appropriate payment surface
   * REUSE EXISTING PAYMENT SURFACES - DO NOT BUILD NEW ONES
   */
  const handlePaymentAction = useCallback(async (item: SmartContentItem) => {
    if (!item.price?.amount || item.price.amount <= 0) {
      console.warn('[SmartContentAction] Invalid price for item:', item.title);
      return;
    }

    console.log('[SmartContentAction] Processing payment for:', item.title, 'Price:', item.price.amount, 'Q¢');

    try {
      // Determine preferred payment surface from metadata or context
      const preferredSurface = item.paymentMetadata?.paymentSurface;
      
      // Convert SmartContentItem to a payment payload compatible with existing surfaces
      const paymentContentPayload: SmartWalletContentPayload = {
        id: item.id,
        title: item.title,
        description: item.description,
        excerpt: item.excerpt,
        image: item.image,
        section: item.section,
        pricingModel: {
          tiers: [{
            kind: item.price.paymentType || 'one-time',
            amount: item.price.amount,
            currency: item.price.currency
          }]
        },
        // Preserve other metadata used by existing flows
        type: item.type,
        modalities: item.modalities,
        pdf_cid: item.pdf_cid,
        pdf_master_id: item.pdf_master_id,
        created_at: item.created_at,
        updated_at: item.updated_at,
      };
      
      if (preferredSurface === 'liquid') {
        // INTEGRATION: Liquid UI payment chips in chat surface
        console.log('[SmartContentAction] Using Liquid UI payment surface');
        dispatchSmartWalletPayment('liquid', {
          item: paymentContentPayload,
          price: item.price,
        });
        
      } else if (preferredSurface === 'embedded') {
        // INTEGRATION: Embedded payment within copilots
        console.log('[SmartContentAction] Using Embedded payment surface');
        dispatchSmartWalletPayment('embedded', {
          item: paymentContentPayload,
          price: item.price,
        });
        
      } else {
        // DEFAULT: Overlay wallet drawers and payment modals
        console.log('[SmartContentAction] Using Overlay payment surface (SmartWalletDrawer)');
        
        dispatchSmartWalletPayment('overlay', {
          item: paymentContentPayload,
          price: item.price,
          paymentSurface: 'overlay',
        });
        
        // Also try to open SmartWalletDrawer directly if it exists
        dispatchOpenSmartWalletDrawer({
          currentContent: paymentContentPayload,
          open: true,
          variant: 'overlay',
        });
      }
      
    } catch (error) {
      console.error('[SmartContentAction] Payment action failed:', error);
    }
  }, []);

  /**
   * Universal action executor
   * Handles ALL SmartContent actions based on the content's modalities
   */
  const executeAction = useCallback((action: ActionType, item: SmartContentItem, playlist?: SmartContentItem[]) => {
    const modalities = item.modalities;

    switch (action) {
      case 'watch':
        if (modalities?.watch?.video_url) {
          const sourceList = playlist && playlist.length > 0 ? playlist : [item];
          const playableItems = sourceList.filter((entry) => !!entry.modalities?.watch?.video_url);
          const effectivePlaylist = playableItems.length > 0 ? playableItems : [item];
          const startIndex = Math.max(0, effectivePlaylist.findIndex((entry) => entry.id === item.id));
          setVideoPlaylist(effectivePlaylist);
          setVideoIndex(startIndex === -1 ? 0 : startIndex);
          setVideoItem(item);
          setVideoModalOpen(true);
        }
        break;
        
      case 'read': {
        const hasPdf = !!(item.pdf_lite_url || item.pdf_cid);
        const hasText = !!(item.modalities?.read?.text);
        if (hasText) {
          setReadArticle(item);
          setArticleModalOpen(true);
        } else if (hasPdf) {
          setPdfItem(item);
          setPdfViewerOpen(true);
        }
        break;
      }
        
      case 'listen':
        // TODO: Implement audio player when ready
        console.log('[SmartContentAction] Audio player not yet implemented');
        break;
        
      case 'share':
        setShareItem(item);
        setShareModalOpen(true);
        break;
        
      case 'buy':
        // Handle payment action - REUSE EXISTING PAYMENT SURFACES
        handlePaymentAction(item);
        break;
        
      case 'link':
        if (item.modalities?.link?.url) {
          window.open(item.modalities.link.url, '_blank', 'noopener,noreferrer');
        }
        break;
        
      case 'view':
        // TODO: Implement image lightbox when ready
        console.log('[SmartContentAction] Image lightbox not yet implemented');
        break;
        
      case 'expand':
        // TODO: Implement expand action when ready
        console.log('[SmartContentAction] Expand action not yet implemented');
        break;
    }
  }, [handlePaymentAction]);

  // Listen for custom SmartContent action events
  useEffect(() => {
    const cleanup = addSmartWalletEventListener(
      SMART_WALLET_EVENTS.smartContentAction,
      ({ item, action, playlist }) => {
      console.log('[SmartContentActionContext] Received action:', action, 'for item:', item.title);
      executeAction(action, item, playlist);
    });
    return cleanup;
  }, [executeAction]);

  /**
   * Handle share tracking from social sharing modal
   */
  const handleShareTracking = useCallback(async (platform: string) => {
    if (!shareItem) return;
    
    const personaId = getCurrentPersonaId();
    const shareMetadata = {
      id: shareItem.id,
      title: shareItem.title,
      description: shareItem.description || shareItem.excerpt || '',
      image: shareItem.image,
      modalities: shareItem.modalities,
      section: shareItem.section,
    };
    
    try {
      await shareArticle(shareMetadata, personaId ?? undefined, platform);
    } catch (error) {
      console.warn('[SmartContentAction] Share tracking failed:', error);
    }
  }, [shareItem]);

  /**
   * Factory function to create an onAction handler for a specific item
   */
  const createHandler = useCallback((item: SmartContentItem, playlist?: SmartContentItem[]) => {
    return (action: ActionType) => executeAction(action, item, playlist);
  }, [executeAction]);

  return (
    <SmartContentActionContext.Provider value={{ executeAction, createHandler }}>
      {children}

      {/* Global VideoModal */}
      <VideoModal
        isOpen={videoModalOpen}
        onClose={() => {
          setVideoModalOpen(false);
          setVideoItem(null);
          setVideoPlaylist([]);
          setVideoIndex(0);
        }}
        items={(videoPlaylist.length > 0 ? videoPlaylist : videoItem ? [videoItem] : []).map((entry) => ({
          id: entry.id,
          title: entry.title,
          videoUrl: entry.modalities?.watch?.video_url || '',
          duration: entry.modalities?.watch?.duration || '0:00',
        }))}
        initialIndex={videoIndex}
      />

      {/* Global Article Reader (Simplified) */}
      {articleModalOpen && readArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-xl border border-white/10 w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">{readArticle.title}</h2>
              <button
                onClick={() => {
                  setArticleModalOpen(false);
                  setReadArticle(null);
                }}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] text-white">
              <div className="prose prose-invert max-w-none">
                {readArticle.modalities?.read?.text && (
                  <div dangerouslySetInnerHTML={{ __html: readArticle.modalities.read.text }} />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global PDF viewer — split between fast iframe (lite URL) and
          page-by-page render (Autonomys CID, avoids Lambda 6MB response limit) */}
      {pdfViewerOpen && pdfItem?.pdf_lite_url && (
        <PDFLiteReaderModal
          open={pdfViewerOpen}
          pdfUrl={pdfItem.pdf_lite_url}
          title={pdfItem.title}
          onClose={() => {
            setPdfViewerOpen(false);
            setPdfItem(null);
          }}
        />
      )}

      {pdfViewerOpen && pdfItem && !pdfItem.pdf_lite_url && pdfItem.pdf_cid && (
        <PDFPageViewer
          cid={pdfItem.pdf_cid}
          title={pdfItem.title}
          onClose={() => {
            setPdfViewerOpen(false);
            setPdfItem(null);
          }}
        />
      )}

      {/* Social Sharing Modal */}
      <SocialSharingModal
        isOpen={shareModalOpen}
        onClose={() => {
          setShareModalOpen(false);
          setShareItem(null);
        }}
        article={shareItem ? {
          id: shareItem.id,
          title: shareItem.title,
          description: shareItem.description || shareItem.excerpt || '',
          section: shareItem.section,
          url: shareItem.modalities?.link?.url,
          type: shareItem.modalities?.read?.text
            ? 'text'
            : shareItem.modalities?.watch?.video_url
              ? 'video'
              : undefined,
        } : { id: '', title: '', section: '' }}
        personaId={getCurrentPersonaId() || undefined}
        onShare={handleShareTracking}
      />

      {/* TODO: Global AudioPlayer */}
    </SmartContentActionContext.Provider>
  );
}

/**
 * Hook to access the global SmartContent action context
 */
export function useSmartContentAction() {
  const context = useContext(SmartContentActionContext);
  if (!context) {
    throw new Error('useSmartContentAction must be used within SmartContentActionProvider');
  }
  return context;
}

/**
 * Hook that returns a handler for a specific content item
 * Use this in components: onAction={useSmartContentHandler(item)}
 */
export function useSmartContentHandler(item: SmartContentItem, playlist?: SmartContentItem[]) {
  const { createHandler } = useSmartContentAction();
  return createHandler(item, playlist);
}
