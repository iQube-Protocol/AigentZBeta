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
import { SocialSharingModal } from '@/packages/smarttriad/src/SocialSharingModal';
import { shareArticle } from '@/packages/smarttriad/src/socialSharing';
import type { ContentModalities, ActionType, SmartContentItem } from '@/packages/smarttriad/src/types';

// Import agentiQ-specific components
import { VideoModal } from '@/packages/smarttriad/src/VideoModal';
import { PDFPageViewer } from '@/app/triad/components/content/PDFPageViewer';

// Import agentiQ services
import { getCurrentPersonaId, resolveCurrentPersona } from '@/app/services/personaService';

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
      
      // FLAG: Payment surface integration points to be implemented
      // These are the existing surfaces we should integrate with:
      
      if (preferredSurface === 'liquid') {
        // INTEGRATION POINT: Liquid UI payment chips in chat surface
        console.log('[SmartContentAction] FLAG: Liquid UI payment surface integration needed');
        // TODO: Integrate with existing Liquid UI payment modals/chips
        // Reference: Qriptopian chat surface payment chips
      } else if (preferredSurface === 'embedded') {
        // INTEGRATION POINT: Embedded payment within copilots
        console.log('[SmartContentAction] FLAG: Embedded payment surface integration needed');
        // TODO: Integrate with existing embedded copilot payment components
        // Reference: Existing copilot payment surfaces
      } else {
        // DEFAULT: Overlay wallet drawers and payment modals
        console.log('[SmartContentAction] FLAG: Overlay payment surface integration needed');
        // TODO: Integrate with existing overlay wallet drawer payment modals
        // Reference: SmartWallet overlay payment modals
      }

      // TODO: Remove this flag when payment surfaces are integrated
      console.warn('[SmartContentAction] PAYMENT SURFACES NOT YET INTEGRATED - Flagged for implementation');
      
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
          setVideoPlaylist(playlist || [item]);
          setVideoIndex(0);
          setVideoModalOpen(true);
        }
        break;
        
      case 'read':
        if (item.modalities?.read?.text || item.modalities?.read?.cid) {
          setReadArticle(item);
          setArticleModalOpen(true);
        }
        break;
        
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
  }, []);

  // Listen for custom SmartContent action events
  useEffect(() => {
    const handleSmartContentAction = (event: CustomEvent) => {
      const { item, action } = event.detail;
      console.log('[SmartContentActionContext] Received action:', action, 'for item:', item.title);
      executeAction(action, item);
    };

    window.addEventListener('smartContentAction', handleSmartContentAction as EventListener);
    return () => {
      window.removeEventListener('smartContentAction', handleSmartContentAction as EventListener);
    };
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

      {/* Global PDFPageViewer */}
      {pdfViewerOpen && pdfItem && (
        <PDFPageViewer
          cid={pdfItem.pdf_cid || pdfItem.modalities?.read?.cid || ''}
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
