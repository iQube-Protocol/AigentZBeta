/**
 * SmartContentActionContext - Global action handler for SmartContent
 * 
 * ARCHITECTURAL PRINCIPLE: SmartContent actions are ATOMIC and UNIVERSAL.
 * Actions are determined by the content's modalities, not by the section or component.
 * This context provides global handling so components don't need local handlers.
 * 
 * This follows the Liquid UI model where content behavior is intrinsic to the content,
 * not dependent on where it's displayed.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { VideoModal } from '@agentiq/smarttriad';
import { ArticleReader, theQriptopianStyleGuide } from '@agentiq/article-reader';
import { PDFPageViewer } from '@/components/content/PDFPageViewer';
import { shareArticle, getCurrentPersonaId, SocialSharingModal } from '@agentiq/smarttriad';
import type { ArticleQube } from '@agentiq/codex';
import type { ContentModalities, ActionType, SmartContentItem } from '@agentiq/smarttriad';
import { supabase } from '@/integrations/supabase/client';
import { getMyWalletPersonas } from '@/services/walletApi';

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
  const [readArticle, setReadArticle] = useState<ArticleQube | null>(null);
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { personas } = await getMyWalletPersonas();
        const first = personas[0];
        if (!first?.id) return;
        localStorage.setItem('currentPersonaId', first.id);
        sessionStorage.setItem('currentPersonaId', first.id);
      } catch (error) {
        console.warn('[SmartContentAction] Failed to resolve persona:', error);
      }
    };

    ensurePersonaId();
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

      case 'read':
        // Check for text content FIRST - this is the most common case for articles
        if (modalities?.read?.text) {
          console.log('[SmartContentAction] Opening ArticleReader for:', item.title);
          const article: ArticleQube = {
            contentId: item.id,
            title: item.title,
            excerpt: item.description || item.excerpt || '',
            content: modalities.read.text,
            media: item.image ? { thumbnail: item.image } : undefined,
          };
          setReadArticle(article);
        } else if (modalities?.read?.cid || item.pdf_cid || item.pdf_lite_url) {
          // Only use PDF viewer if there's an explicit PDF CID or URL (no text content)
          console.log('[SmartContentAction] Opening PDF viewer for:', item.title);
          setPdfItem(item);
          setPdfViewerOpen(true);
        }
        break;

      case 'listen':
        if (modalities?.listen?.audio_url) {
          // TODO: Implement global audio player
          console.log('[SmartContentAction] Listen action - audio player not yet implemented', {
            audioUrl: modalities.listen.audio_url,
            item: item.title,
          });
        }
        break;

      case 'link':
        if (modalities?.link?.url) {
          window.open(modalities.link.url, '_blank');
        }
        break;

      case 'view':
        if (modalities?.view?.image_url) {
          // TODO: Implement image lightbox
          window.open(modalities.view.image_url, '_blank');
        }
        break;

      case 'expand':
        // Expand is context-dependent - components handle this locally
        // This is the ONE action that may need local handling for carousel selection
        console.log('[SmartContentAction] Expand action - handled locally by component');
        break;

      case 'share':
        // Open social sharing modal with comprehensive platform options
        setShareItem(item);
        setShareModalOpen(true);
        break;
    }
  }, []);

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
      await shareArticle(shareMetadata, personaId, platform);
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

      {/* Global ArticleReader */}
      <ArticleReader
        article={readArticle}
        isOpen={!!readArticle}
        onClose={() => setReadArticle(null)}
        styleGuide={theQriptopianStyleGuide}
      />

      {/* Global PDFPageViewer */}
      {pdfViewerOpen && pdfItem && (
        <PDFPageViewer
          cid={pdfItem.pdf_cid || pdfItem.modalities?.read?.cid || ''}
          pdfLiteUrl={pdfItem.pdf_lite_url}
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
