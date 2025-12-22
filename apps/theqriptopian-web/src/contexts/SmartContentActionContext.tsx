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

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { VideoModal } from '@agentiq/smarttriad';
import { ArticleReader, theQriptopianStyleGuide } from '@agentiq/article-reader';
import type { ArticleQube } from '@agentiq/codex';
import type { ContentModalities, ActionType } from '@/components/content/SmartContentActions';

/**
 * Content item interface for action execution
 */
export interface SmartContentItem {
  id: string;
  title: string;
  description?: string;
  excerpt?: string;
  image?: string;
  modalities?: ContentModalities | null;
}

interface SmartContentActionContextValue {
  /**
   * Execute an action on a content item.
   * This is the UNIVERSAL action handler - use this instead of local handlers.
   */
  executeAction: (action: ActionType, item: SmartContentItem) => void;
  
  /**
   * Create an onAction handler for SmartContentActions component.
   * Pass the content item and get back a handler function.
   */
  createHandler: (item: SmartContentItem) => (action: ActionType) => void;
}

const SmartContentActionContext = createContext<SmartContentActionContextValue | null>(null);

interface ProviderProps {
  children: ReactNode;
}

export function SmartContentActionProvider({ children }: ProviderProps) {
  // Global modal state
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoItem, setVideoItem] = useState<SmartContentItem | null>(null);
  const [readArticle, setReadArticle] = useState<ArticleQube | null>(null);
  // TODO: Add audio player state when implemented
  // const [audioItem, setAudioItem] = useState<SmartContentItem | null>(null);

  /**
   * Universal action executor
   * Handles ALL SmartContent actions based on the content's modalities
   */
  const executeAction = useCallback((action: ActionType, item: SmartContentItem) => {
    const modalities = item.modalities;

    switch (action) {
      case 'watch':
        if (modalities?.watch?.video_url) {
          setVideoItem(item);
          setVideoModalOpen(true);
        }
        break;

      case 'read':
        if (modalities?.read?.text) {
          // ArticleQube expects 'content' field for the article body
          const article: ArticleQube = {
            contentId: item.id,
            title: item.title,
            excerpt: item.description || item.excerpt || '',
            content: modalities.read.text,
            media: item.image ? { thumbnail: item.image } : undefined,
          };
          setReadArticle(article);
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
        if (navigator.share) {
          navigator.share({
            title: item.title,
            text: item.description || item.excerpt || '',
            url: window.location.href,
          });
        } else {
          // Clipboard fallback
          navigator.clipboard.writeText(window.location.href);
        }
        break;
    }
  }, []);

  /**
   * Factory function to create an onAction handler for a specific item
   */
  const createHandler = useCallback((item: SmartContentItem) => {
    return (action: ActionType) => executeAction(action, item);
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
        }}
        items={videoItem ? [{
          id: videoItem.id,
          title: videoItem.title,
          videoUrl: videoItem.modalities?.watch?.video_url || '',
          duration: videoItem.modalities?.watch?.duration || '0:00',
        }] : []}
        initialIndex={0}
      />

      {/* Global ArticleReader */}
      <ArticleReader
        article={readArticle}
        isOpen={!!readArticle}
        onClose={() => setReadArticle(null)}
        styleGuide={theQriptopianStyleGuide}
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
export function useSmartContentHandler(item: SmartContentItem) {
  const { createHandler } = useSmartContentAction();
  return createHandler(item);
}
