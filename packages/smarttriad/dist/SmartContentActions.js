import { jsx as _jsx } from "react/jsx-runtime";
import { Play, BookOpen, Headphones, ExternalLink, Image, Maximize2, Share2 } from "lucide-react";
/**
 * Utility function for className merging
 */
function cn(...inputs) {
    return inputs.filter(Boolean).join(' ');
}
const ICONS = {
    watch: Play,
    read: BookOpen,
    listen: Headphones,
    link: ExternalLink,
    view: Image,
    expand: Maximize2,
    share: Share2,
};
const ACTION_LABELS = {
    watch: 'Watch video',
    read: 'Read article',
    listen: 'Listen to audio',
    link: 'Open link',
    view: 'View image',
    expand: 'Expand',
    share: 'Share',
};
/**
 * Determines which actions should be available based on modalities and context
 */
function getAvailableActions(modalities, context, showExpand, showShare) {
    const actions = [];
    // Only add modality actions if they have actual content
    if (modalities?.watch?.video_url || modalities?.watch?.available)
        actions.push('watch');
    if (modalities?.read?.text || modalities?.read?.available)
        actions.push('read');
    if (modalities?.listen?.audio_url)
        actions.push('listen');
    if (modalities?.link?.url)
        actions.push('link');
    // Disabled: view and expand actions are redundant and not working
    // if (modalities?.view?.image_url) actions.push('view');
    // if (showExpand && context === 'thumbnail') actions.push('expand');
    if (showShare)
        actions.push('share');
    return actions;
}
export function SmartContentActions({ modalities, onAction, className, size = 'md', context = 'card', showExpand = true, showShare = true }) {
    const actions = getAvailableActions(modalities, context, showExpand, showShare);
    // Don't render if no actions available
    if (actions.length === 0)
        return null;
    const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
    const buttonSize = size === 'sm' ? 'p-1' : size === 'lg' ? 'p-2.5' : 'p-1.5';
    return (_jsx("div", { className: cn("flex gap-1.5 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1", className), children: actions.map((action) => {
            const Icon = ICONS[action];
            return (_jsx("button", { onClick: (e) => { e.stopPropagation(); onAction(action); }, className: cn(buttonSize, "text-cyan-400 hover:text-cyan-300 hover:bg-white/10 rounded transition-colors"), "aria-label": ACTION_LABELS[action], title: ACTION_LABELS[action], children: _jsx(Icon, { className: iconSize }) }, action));
        }) }));
}
/**
 * Helper to check if a content item has any playable modality
 */
export function hasPlayableContent(modalities) {
    return !!(modalities?.watch?.video_url || modalities?.listen?.audio_url);
}
/**
 * Helper to check if a content item has readable content
 */
export function hasReadableContent(modalities) {
    return !!(modalities?.read?.text || modalities?.read?.available);
}
/**
 * Helper to get the primary action for a content item
 */
export function getPrimaryAction(modalities) {
    if (modalities?.watch?.video_url)
        return 'watch';
    if (modalities?.read?.text)
        return 'read';
    if (modalities?.listen?.audio_url)
        return 'listen';
    if (modalities?.link?.url)
        return 'link';
    return null;
}
/**
 * Enhanced share function with deep linking and persona tracking
 * This can be used by the SmartContentActionContext
 */
export async function shareArticle(article, personaId, preferredPlatform) {
    const deepLink = generateArticleDeepLink(article, personaId);
    // Track the share attempt
    await trackShare({
        articleId: article.id,
        personaId,
        platform: preferredPlatform || 'native',
        deepLink,
    });
    // Try native share API first
    if (navigator.share) {
        try {
            await navigator.share({
                title: article.title,
                text: article.description || article.excerpt || `Check out this ${article.modalities?.watch?.video_url ? 'video' : 'article'} from Qriptopian`,
                url: deepLink,
            });
            return;
        }
        catch (error) {
            if (error.name !== 'AbortError') {
                console.warn('Native share failed:', error);
            }
        }
    }
    // Fallback: copy to clipboard
    navigator.clipboard.writeText(deepLink);
}
/**
 * Generate deep link for an article
 */
function generateArticleDeepLink(article, personaId) {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
        id: article.id,
        title: article.title,
        section: article.section || 'unknown',
    });
    if (personaId) {
        params.set('persona', personaId);
    }
    const hasVideo = !!article.modalities?.watch?.video_url;
    const hasText = !!article.modalities?.read?.text;
    if (hasVideo && !hasText) {
        params.set('type', 'video');
    }
    else if (hasText) {
        params.set('type', 'text');
    }
    return `${baseUrl}/article?${params.toString()}`;
}
/**
 * Track share analytics
 */
async function trackShare(analytics) {
    try {
        const apiUrl = import.meta.env?.VITE_API_URL || 'https://dev-beta.aigentz.me';
        const response = await fetch(`${apiUrl}/api/analytics/share`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...analytics,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                referrer: document.referrer,
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.warn('Failed to track share analytics:', errorText);
        }
    }
    catch (error) {
        console.warn('Error tracking share analytics:', error);
    }
}
/**
 * Get current persona ID from local storage or context
 */
export function getCurrentPersonaId() {
    // Try multiple sources for persona ID
    return (localStorage.getItem('currentPersonaId') ||
        sessionStorage.getItem('currentPersonaId') ||
        null);
}
