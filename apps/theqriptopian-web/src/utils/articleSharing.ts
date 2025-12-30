/**
 * Article Sharing Utilities
 * 
 * Handles deep linking, social sharing, and analytics tracking for article shares
 */

export interface ShareMetadata {
  id: string;
  title: string;
  description?: string;
  image?: string;
  modalities?: any;
  section?: string;
}

export interface ShareAnalytics {
  articleId: string;
  personaId?: string;
  platform: string;
  timestamp: Date;
  deepLink: string;
}

/**
 * Generate deep link for an article
 */
export function generateArticleDeepLink(article: ShareMetadata, personaId?: string): string {
  const baseUrl = window.location.origin;
  const params = new URLSearchParams({
    id: article.id,
    title: article.title,
    section: article.section || 'unknown',
  });
  
  if (personaId) {
    params.set('persona', personaId);
  }
  
  if (article.modalities?.watch?.video_url) {
    params.set('type', 'video');
  }
  
  return `${baseUrl}/article?${params.toString()}`;
}

/**
 * Generate social share links
 */
export function generateSocialShareLinks(article: ShareMetadata, personaId?: string) {
  const deepLink = generateArticleDeepLink(article, personaId);
  const text = `Check out this article: ${article.title}`;
  const hashtags = 'Qriptopian,AigentIQ,Web3';
  
  return {
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(deepLink)}&hashtags=${hashtags}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(deepLink)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(deepLink)}`,
    reddit: `https://reddit.com/submit?url=${encodeURIComponent(deepLink)}&title=${encodeURIComponent(text)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${deepLink}`)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(text)}`,
    email: `mailto:?subject=${encodeURIComponent(article.title)}&body=${encodeURIComponent(`${text} ${deepLink}`)}`,
    native: deepLink // For native share API
  };
}

/**
 * Track share analytics
 */
export async function trackShare(analytics: Omit<ShareAnalytics, 'timestamp'>): Promise<void> {
  try {
    const response = await fetch('/api/analytics/share', {
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
      console.warn('Failed to track share analytics:', response.statusText);
    }
  } catch (error) {
    console.warn('Error tracking share analytics:', error);
  }
}

/**
 * Enhanced share function with analytics and deep linking
 */
export async function shareArticle(
  article: ShareMetadata, 
  personaId?: string,
  preferredPlatform?: string
): Promise<void> {
  const deepLink = generateArticleDeepLink(article, personaId);
  const socialLinks = generateSocialShareLinks(article, personaId);
  
  // Track the share attempt
  await trackShare({
    articleId: article.id,
    personaId,
    platform: preferredPlatform || 'native',
    deepLink,
  });
  
  // If specific platform requested, open it directly
  if (preferredPlatform && socialLinks[preferredPlatform as keyof typeof socialLinks]) {
    window.open(socialLinks[preferredPlatform as keyof typeof socialLinks], '_blank');
    return;
  }
  
  // Try native share API first
  if (navigator.share) {
    try {
      await navigator.share({
        title: article.title,
        text: article.description || `Check out this ${article.modalities?.watch?.video_url ? 'video' : 'article'} from Qriptopian`,
        url: deepLink,
      });
      return;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.warn('Native share failed:', error);
      }
    }
  }
  
  // Fallback: show social sharing dialog
  showSocialSharingDialog(article, socialLinks, personaId);
}

/**
 * Show social sharing dialog (fallback when native share fails)
 */
function showSocialSharingDialog(
  article: ShareMetadata, 
  socialLinks: ReturnType<typeof generateSocialShareLinks>,
  personaId?: string
) {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4';
  modal.style.display = 'flex';
  
  modal.innerHTML = `
    <div class="bg-[#071327] border border-[#1e2b40] rounded-xl p-6 max-w-md w-full">
      <h3 class="text-xl font-semibold text-white mb-4">Share this article</h3>
      <p class="text-gray-300 mb-6">${article.title}</p>
      
      <div class="grid grid-cols-2 gap-3 mb-6">
        <button onclick="window.open('${socialLinks.twitter}', '_blank')" class="flex flex-col items-center p-3 bg-[#1e2b40] hover:bg-[#2a3b52] rounded-lg transition-colors">
          <div class="w-6 h-6 bg-blue-400 rounded-full mb-2"></div>
          <span class="text-xs text-gray-300">Twitter</span>
        </button>
        <button onclick="window.open('${socialLinks.linkedin}', '_blank')" class="flex flex-col items-center p-3 bg-[#1e2b40] hover:bg-[#2a3b52] rounded-lg transition-colors">
          <div class="w-6 h-6 bg-blue-600 rounded-full mb-2"></div>
          <span class="text-xs text-gray-300">LinkedIn</span>
        </button>
        <button onclick="window.open('${socialLinks.facebook}', '_blank')" class="flex flex-col items-center p-3 bg-[#1e2b40] hover:bg-[#2a3b52] rounded-lg transition-colors">
          <div class="w-6 h-6 bg-blue-500 rounded-full mb-2"></div>
          <span class="text-xs text-gray-300">Facebook</span>
        </button>
        <button onclick="window.open('${socialLinks.reddit}', '_blank')" class="flex flex-col items-center p-3 bg-[#1e2b40] hover:bg-[#2a3b52] rounded-lg transition-colors">
          <div class="w-6 h-6 bg-orange-500 rounded-full mb-2"></div>
          <span class="text-xs text-gray-300">Reddit</span>
        </button>
        <button onclick="window.open('${socialLinks.whatsapp}', '_blank')" class="flex flex-col items-center p-3 bg-[#1e2b40] hover:bg-[#2a3b52] rounded-lg transition-colors">
          <div class="w-6 h-6 bg-green-500 rounded-full mb-2"></div>
          <span class="text-xs text-gray-300">WhatsApp</span>
        </button>
        <button onclick="window.open('${socialLinks.telegram}', '_blank')" class="flex flex-col items-center p-3 bg-[#1e2b40] hover:bg-[#2a3b52] rounded-lg transition-colors">
          <div class="w-6 h-6 bg-blue-400 rounded-full mb-2"></div>
          <span class="text-xs text-gray-300">Telegram</span>
        </button>
      </div>
      
      <div class="flex gap-3">
        <button onclick="navigator.clipboard.writeText('${deepLink.replace(/'/g, "\\'")}'); this.textContent='Copied!'; setTimeout(() => this.textContent='Copy Link', 2000)" class="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg transition-colors">
          Copy Link
        </button>
        <button onclick="this.closest('.fixed').remove()" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors">
          Cancel
        </button>
      </div>
      
      ${personaId ? `<p class="text-xs text-gray-400 mt-4">Shared via persona: ${personaId}</p>` : ''}
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

/**
 * Get current persona ID from local storage or context
 */
export function getCurrentPersonaId(): string | null {
  // Try multiple sources for persona ID
  return (
    localStorage.getItem('currentPersonaId') ||
    sessionStorage.getItem('currentPersonaId') ||
    null
  );
}

/**
 * Parse article from URL parameters
 */
export function parseArticleFromUrl(): ShareMetadata | null {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const title = params.get('title');
  const section = params.get('section');
  const type = params.get('type');
  
  if (!id || !title) return null;
  
  return {
    id,
    title,
    section: section || undefined,
    modalities: type === 'video' ? { watch: { video_url: '', available: true } } : undefined,
  };
}
