/**
 * Article Deep Link Page
 * 
 * Handles direct links to individual articles with persona tracking
 * URL format: /article?id=xxx&title=xxx&section=xxx&persona=xxx&type=video
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseArticleFromUrl } from '@/utils/articleSharing';
import { ArticleReader, theQriptopianStyleGuide } from '@agentiq/article-reader';
import { Loader2, AlertCircle } from 'lucide-react';

export default function ArticlePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<any>(null);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'text' | 'video' | null>(null);

  useEffect(() => {
    const urlArticle = parseArticleFromUrl();
    const urlPersona = new URLSearchParams(window.location.search).get('persona');

    if (!urlArticle) {
      setError('Invalid article link');
      setLoading(false);
      return;
    }

    setPersonaId(urlPersona);

    // Fetch the full article data
    const fetchArticle = async () => {
      try {
        // Use direct article fetch by ID
        const apiBase = import.meta.env.VITE_AIGENT_API_URL || '';
        const fullUrl = `${apiBase}/api/content/smart/${urlArticle.id}`;

        const response = await fetch(fullUrl, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch article (${response.status}): ${errorText || 'No error details'}`);
        }
        
        const result = await response.json();
        
        if (!result.success || !result.data) {
          throw new Error(`Article not found: ${result.error || 'Content may have been removed or ID is invalid'}`);
        }

        const foundArticle = result.data;
        setArticle(foundArticle);
        
        // Track social share conversion if persona is present
        if (urlPersona) {
          trackSocialConversion(urlArticle.id, urlPersona);
        }
        
        // Update page metadata
        document.title = `${foundArticle.title} - Qriptopian`;
        
        // Update meta description
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
          metaDescription.setAttribute('content', foundArticle.excerpt || foundArticle.description || '');
        }

        // Update Open Graph tags
        updateOpenGraphTags(foundArticle, urlPersona);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load article');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, []);

  const trackSocialConversion = async (articleId: string, personaId: string) => {
    try {
      const apiBase = import.meta.env.VITE_AIGENT_API_URL || '';
      await fetch(`${apiBase}/api/social/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId,
          contentId: articleId,
          platform: document.referrer ? new URL(document.referrer).hostname : 'direct',
          eventType: 'conversion',
          metadata: { articleId, deepLink: window.location.href }
        })
      });
    } catch (error) {
    }
  };

  const updateOpenGraphTags = (articleData: any, persona: string | null) => {
    const ogUrl = window.location.href;
    
    // Update or create OG tags
    const tags = [
      { property: 'og:title', content: articleData.title },
      { property: 'og:description', content: articleData.excerpt || articleData.description || '' },
      { property: 'og:url', content: ogUrl },
      { property: 'og:type', content: 'article' },
      { property: 'og:image', content: articleData.image || '' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: articleData.title },
      { name: 'twitter:description', content: articleData.excerpt || articleData.description || '' },
      { name: 'twitter:image', content: articleData.image || '' },
    ];

    tags.forEach(tag => {
      const key = tag.property ? 'property' : 'name';
      const value = tag.property || tag.name;
      
      let element = document.querySelector(`meta[${key}="${value}"]`) as HTMLMetaElement;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(key, value);
        document.head.appendChild(element);
      }
      element.setAttribute('content', tag.content);
    });
  };

  useEffect(() => {
    if (!article) return;
    const params = new URLSearchParams(window.location.search);
    const preferredType = params.get('type');
    const hasText = !!article.modalities?.read?.text;
    const hasVideo = !!article.modalities?.watch?.video_url;

    if (preferredType === 'video' && hasVideo) {
      setViewMode('video');
      return;
    }

    if (hasText) {
      setViewMode('text');
      return;
    }

    if (hasVideo) {
      setViewMode('video');
      return;
    }

    setViewMode('text');
  }, [article]);

  const setPreferredView = (nextMode: 'text' | 'video') => {
    setViewMode(nextMode);
    const params = new URLSearchParams(window.location.search);
    params.set('type', nextMode);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', newUrl);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050f1f] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050f1f] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Article Not Found</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-[#050f1f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
        <p className="text-gray-300 ml-3">Loading...</p>
      </div>
    );
  }

  const hasVideo = !!article.modalities?.watch?.video_url;
  const hasText = !!article.modalities?.read?.text;
  const showToggle = hasVideo && hasText;
  const resolvedView = viewMode || (hasText ? 'text' : hasVideo ? 'video' : 'text');

  // Render video article
  if (resolvedView === 'video' && hasVideo) {
    return (
      <div className="min-h-screen bg-[#050f1f]">
        <div className="container mx-auto px-4 py-8">
          <button
            onClick={() => navigate('/')}
            className="text-cyan-400 hover:text-cyan-300 mb-6 transition-colors"
          >
            ← Back to Home
          </button>
          
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-white mb-4">{article.title}</h1>
            {article.excerpt && (
              <p className="text-gray-300 mb-6">{article.excerpt}</p>
            )}
            
            {personaId && (
              <p className="text-sm text-cyan-400 mb-6">
                Shared via persona: {personaId}
              </p>
            )}

            {showToggle && (
              <div className="mb-6 flex items-center gap-2">
                <button
                  onClick={() => setPreferredView('text')}
                  className="rounded-full border border-[#1e2b40] px-4 py-1 text-sm text-gray-300 hover:text-white hover:bg-[#0a1a2f] transition-colors"
                >
                  Read Text
                </button>
                <button
                  onClick={() => setPreferredView('video')}
                  className="rounded-full border border-cyan-500/40 px-4 py-1 text-sm text-cyan-300 bg-cyan-500/10"
                >
                  Watch Video
                </button>
              </div>
            )}

            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <video
                src={article.modalities.watch.video_url}
                poster={article.image || undefined}
                controls
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render text article
  if (resolvedView === 'text' && hasText) {
    const articleQube = {
      qubeType: 'articleQube',
      contentId: article.id,
      title: article.title,
      slug: article.slug || article.id,
      description: article.excerpt || article.description || '',
      content: article.modalities.read.text,
      author: {
        name: article.author?.name || 'Qriptopian',
      },
      publishedAt: article.publishedAt || article.created_at || new Date().toISOString(),
      image: article.image ? { url: article.image, alt: article.title } : undefined,
      tags: Array.isArray(article.tags) ? article.tags : [],
      status: 'published' as const,
    };

    return (
      <>
        <ArticleReader
          article={articleQube}
          isOpen={true}
          onClose={() => navigate('/')}
          styleGuide={theQriptopianStyleGuide}
        />
        <button
          onClick={() => navigate('/')}
          className="fixed top-4 left-4 z-[10002] rounded-full bg-[#071327] border border-[#1e2b40] px-4 py-2 text-sm text-cyan-400 hover:text-cyan-300 hover:bg-[#0a1a2f] transition-colors"
        >
          ← Back to Home
        </button>
        {showToggle && (
          <div className="fixed top-4 right-4 z-[10002] flex items-center gap-2">
            <button
              onClick={() => setPreferredView('text')}
              className="rounded-full border border-cyan-500/40 px-4 py-2 text-sm text-cyan-300 bg-cyan-500/10"
            >
              Read Text
            </button>
            <button
              onClick={() => setPreferredView('video')}
              className="rounded-full border border-[#1e2b40] px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-[#0a1a2f] transition-colors"
            >
              Watch Video
            </button>
          </div>
        )}
      </>
    );
  }

  // Fallback for other content types
  return (
    <div className="min-h-screen bg-[#050f1f]">
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => navigate('/')}
          className="text-cyan-400 hover:text-cyan-300 mb-6 transition-colors"
        >
          ← Back to Home
        </button>
        
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-4">{article.title}</h1>
          {article.excerpt && (
            <p className="text-gray-300 mb-6">{article.excerpt}</p>
          )}
          
          {personaId && (
            <p className="text-sm text-cyan-400 mb-6">
              Shared via persona: {personaId}
            </p>
          )}
          
          <div className="bg-[#071327] border border-[#1e2b40] rounded-lg p-6">
            <p className="text-gray-300">
              This content type is not yet supported for direct viewing. 
              Please return to the main site to access this content.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
