/**
 * ContentModalities - Defines available content consumption modes
 * Each modality should only be present if the content actually supports it
 */
export interface ContentModalities {
    read?: {
        text?: string;
        available?: boolean;
        cid?: string;
        duration?: string;
    };
    watch?: {
        video_url?: string;
        available?: boolean;
        cid?: string;
        duration?: string;
        thumbnail?: string;
        type?: string;
    };
    listen?: {
        audio_url: string;
        duration?: string;
        cover_image?: string;
    };
    link?: {
        url: string;
        allow_embed?: boolean;
    };
    view?: {
        image_url?: string;
    };
}
export type ActionType = 'read' | 'watch' | 'listen' | 'link' | 'view' | 'expand' | 'share';
/**
 * ContentContext - Determines which actions are contextually appropriate
 */
export type ContentContext = 'thumbnail' | 'hero' | 'card' | 'fullscreen' | 'drawer';
export interface SmartContentItem {
    id: string;
    title: string;
    description?: string;
    excerpt?: string;
    image?: string;
    modalities?: ContentModalities | null;
    section?: string;
    pdf_cid?: string;
    pdf_lite_url?: string;
}
interface Props {
    modalities: ContentModalities | null;
    onAction: (action: ActionType) => void;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    context?: ContentContext;
    showExpand?: boolean;
    showShare?: boolean;
}
export declare function SmartContentActions({ modalities, onAction, className, size, context, showExpand, showShare }: Props): import("react/jsx-runtime").JSX.Element | null;
/**
 * Helper to check if a content item has any playable modality
 */
export declare function hasPlayableContent(modalities: ContentModalities | null): boolean;
/**
 * Helper to check if a content item has readable content
 */
export declare function hasReadableContent(modalities: ContentModalities | null): boolean;
/**
 * Helper to get the primary action for a content item
 */
export declare function getPrimaryAction(modalities: ContentModalities | null): ActionType | null;
/**
 * Enhanced share function with deep linking and persona tracking
 * This can be used by the SmartContentActionContext
 */
export declare function shareArticle(article: SmartContentItem, personaId?: string, preferredPlatform?: string): Promise<void>;
/**
 * Get current persona ID from local storage or context
 */
export declare function getCurrentPersonaId(): string | null;
export {};
//# sourceMappingURL=SmartContentActions.d.ts.map