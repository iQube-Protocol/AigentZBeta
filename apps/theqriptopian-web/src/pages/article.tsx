/**
 * Article Deep Link Page
 * 
 * Handles direct links to individual articles with persona tracking
 * URL format: /article?id=xxx&title=xxx&section=xxx&persona=xxx&type=video
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseArticleFromUrl } from '@/utils/articleSharing';
import { useLiquidUIContent } from '@/hooks/useLiquidUIContent';
import { ArticleReader } from '@agentiq/article-reader';
import { VideoModal } from '@agentiq/smarttriad';
import { Loader2, AlertCircle } from 'lucide-react';

export default function ArticlePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [article, setArticle] = useState<any>(null);
  const [personaId, setPersonaId] = useState<string | null>(null);

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
        const apiUrl = import.meta.env.VITE_API_URL || 'https://dev-beta.aigentz.me';
        const response = await fetch(`${apiUrl}/api/content/section/${urlArticle.section || 'latest-news'}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch article: ${response.status}`);
        }
        
        const data = await response.json();
        const foundArticle = data.content.find((item: any) => item.id === urlArticle.id);
        
        if (!foundArticle) {
          throw new Error('Article not found');
        }

        setArticle(foundArticle);
        
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
        console.error('[ArticlePage] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load article');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, []);

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
    return null;
  }

  // Render video article
  if (article.modalities?.watch?.video_url) {
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
            
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <VideoModal
                videoUrl={article.modalities.watch.video_url}
                title={article.title}
                thumbnail={article.image}
                autoPlay={false}
                showControls={true}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render text article
  if (article.modalities?.read?.text) {
    const articleQube = {
      contentId: article.id,
      title: article.title,
      excerpt: article.excerpt || article.description || '',
      content: article.modalities.read.text,
      media: article.image ? { thumbnail: article.image } : undefined,
    };

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
            {personaId && (
              <p className="text-sm text-cyan-400 mb-6">
                Shared via persona: {personaId}
              </p>
            )}
            
            <ArticleReader article={articleQube} />
          </div>
        </div>
      </div>
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
