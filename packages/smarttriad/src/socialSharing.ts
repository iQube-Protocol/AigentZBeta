/**
 * Social Sharing Utilities
 * Ported from Netlify deployment with agentiQ adaptations
 */

interface ShareMetadata {
  id: string;
  title: string;
  description?: string;
  image?: string;
  modalities?: any;
  section?: string;
}

/**
 * Share an article and track the action
 */
export async function shareArticle(
  metadata: ShareMetadata,
  personaId?: string,
  platform?: string
): Promise<void> {
  try {
    // Track the share action
    if (personaId && metadata.id) {
      const response = await fetch('/api/social/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shareId: `${personaId}_${metadata.id}`,
          personaId,
          contentId: metadata.id,
          platform: platform || 'unknown',
          eventType: 'create',
        }),
      });

      if (!response.ok) {
        console.warn('[SocialSharing] Failed to track share:', response.statusText);
      }
    }

    console.log('[SocialSharing] Article shared:', {
      title: metadata.title,
      platform,
      personaId,
    });
  } catch (error) {
    console.error('[SocialSharing] Share tracking failed:', error);
  }
}

/**
 * Get current persona ID from storage
 */
export function getCurrentPersonaId(): string | null {
  if (typeof window === 'undefined') return null;
  
  return (
    localStorage.getItem('currentPersonaId') ||
    sessionStorage.getItem('currentPersonaId') ||
    null
  );
}
