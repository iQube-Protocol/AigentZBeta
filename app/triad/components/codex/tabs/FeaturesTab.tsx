'use client';

import { useState, useEffect } from 'react';
import { Sparkles, ChevronRight, Clock, User } from 'lucide-react';

// SmartTriad integration types
interface ContentModalities {
  read?: { available?: boolean; text?: string; cid?: string };
  watch?: { available?: boolean; video_url?: string; duration?: string };
  listen?: { available?: boolean; audio_url?: string };
  link?: { available?: boolean; url?: string };
  view?: { available?: boolean; image_url?: string };
}

interface ContentItem {
  id: string;
  title: string;
  excerpt?: string;
  author?: string;
  published_at?: string;
  cover_image_url?: string;
  section?: string;
  modalities?: ContentModalities;
  content_blocks?: Array<{ type: string; text: string }>;
}

interface FeaturesTabProps {
  theme?: 'light' | 'dark';
}

/**
 * FeaturesTab - Displays Qriptopian home content (hero articles, latest news, second hero)
 * Integrates with existing Qriptopian Supabase content structure
 */
export function FeaturesTab({ theme = 'dark' }: FeaturesTabProps) {
  const [heroArticles, setHeroArticles] = useState<ContentItem[]>([]);
  const [latestNews, setLatestNews] = useState<ContentItem[]>([]);
  const [secondHero, setSecondHero] = useState<ContentItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        setIsLoading(true);
        const apiUrl = typeof window !== 'undefined' 
          ? window.location.origin 
          : 'https://dev-beta.aigentz.me';

        // Fetch hero articles
        const heroResponse = await fetch(`${apiUrl}/api/content/section/home-hero`);
        if (heroResponse.ok) {
          const heroData = await heroResponse.json();
          setHeroArticles(heroData.content || []);
        }

        // Fetch latest news
        const newsResponse = await fetch(`${apiUrl}/api/content/section/latest-news`);
        if (newsResponse.ok) {
          const newsData = await newsResponse.json();
          setLatestNews(newsData.content || []);
        }

        // Fetch second hero
        const secondResponse = await fetch(`${apiUrl}/api/content/section/second-hero`);
        if (secondResponse.ok) {
          const secondData = await secondResponse.json();
          if (secondData.content && secondData.content.length > 0) {
            setSecondHero(secondData.content[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching features content:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, []);

  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-slate-800/50' : 'bg-white';
  const textClass = isDark ? 'text-white' : 'text-slate-900';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600';
  const borderClass = isDark ? 'border-slate-700' : 'border-slate-200';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className={`text-xl font-bold ${textClass} flex items-center gap-2`}>
          <Sparkles className="w-5 h-5 text-indigo-400" />
          Featured Content
        </h3>
        <p className={`text-sm ${mutedClass} mt-1`}>
          Explore the latest articles, insights, and stories from The Qriptopian
        </p>
      </div>

      {/* Hero Articles Section */}
      {heroArticles.length > 0 && (
        <div>
          <h4 className={`text-lg font-semibold ${textClass} mb-3`}>Hero Articles</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {heroArticles.slice(0, 3).map((article) => (
              <div
                key={article.id}
                className={`${bgClass} rounded-lg border ${borderClass} overflow-hidden hover:border-indigo-500/50 transition-colors cursor-pointer`}
              >
                {article.cover_image_url && (
                  <div className="aspect-video bg-slate-700 relative overflow-hidden">
                    <img
                      src={article.cover_image_url}
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h5 className={`font-semibold ${textClass} line-clamp-2 mb-2`}>
                    {article.title}
                  </h5>
                  {article.excerpt && (
                    <p className={`text-sm ${mutedClass} line-clamp-2 mb-3`}>
                      {article.excerpt}
                    </p>
                  )}
                  <div className={`flex items-center gap-3 text-xs ${mutedClass}`}>
                    {article.author && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {article.author}
                      </span>
                    )}
                    {article.published_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(article.published_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Latest News Section */}
      {latestNews.length > 0 && (
        <div>
          <h4 className={`text-lg font-semibold ${textClass} mb-3`}>Latest News</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {latestNews.slice(0, 6).map((article) => (
              <div
                key={article.id}
                className={`${bgClass} rounded-lg border ${borderClass} p-4 hover:border-indigo-500/50 transition-colors cursor-pointer`}
              >
                <div className="flex gap-3">
                  {article.cover_image_url && (
                    <div className="w-20 h-20 flex-shrink-0 rounded bg-slate-700 overflow-hidden">
                      <img
                        src={article.cover_image_url}
                        alt={article.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h5 className={`font-medium ${textClass} line-clamp-2 mb-1`}>
                      {article.title}
                    </h5>
                    {article.excerpt && (
                      <p className={`text-xs ${mutedClass} line-clamp-2`}>
                        {article.excerpt}
                      </p>
                    )}
                  </div>
                  <ChevronRight className={`w-4 h-4 ${mutedClass} flex-shrink-0`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Second Hero Section */}
      {secondHero && (
        <div>
          <h4 className={`text-lg font-semibold ${textClass} mb-3`}>Featured Story</h4>
          <div className={`${bgClass} rounded-lg border ${borderClass} overflow-hidden hover:border-indigo-500/50 transition-colors cursor-pointer`}>
            <div className="md:flex">
              {secondHero.cover_image_url && (
                <div className="md:w-1/2 aspect-video md:aspect-auto bg-slate-700 relative overflow-hidden">
                  <img
                    src={secondHero.cover_image_url}
                    alt={secondHero.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="md:w-1/2 p-6">
                <h5 className={`text-xl font-bold ${textClass} mb-3`}>
                  {secondHero.title}
                </h5>
                {secondHero.excerpt && (
                  <p className={`${mutedClass} mb-4 line-clamp-4`}>
                    {secondHero.excerpt}
                  </p>
                )}
                <div className={`flex items-center gap-3 text-sm ${mutedClass}`}>
                  {secondHero.author && (
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {secondHero.author}
                    </span>
                  )}
                  {secondHero.published_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {new Date(secondHero.published_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {heroArticles.length === 0 && latestNews.length === 0 && !secondHero && (
        <div className={`${bgClass} rounded-lg border ${borderClass} p-12 text-center`}>
          <Sparkles className={`w-12 h-12 ${mutedClass} mx-auto mb-4`} />
          <h4 className={`text-lg font-semibold ${textClass} mb-2`}>No Content Available</h4>
          <p className={`text-sm ${mutedClass}`}>
            Featured content will appear here once published
          </p>
        </div>
      )}
    </div>
  );
}
