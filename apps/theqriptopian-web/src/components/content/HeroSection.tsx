import { useState, useEffect, useRef } from "react";
import { useLiquidUIContent } from '@/hooks/useLiquidUIContent';
import { SmartContentActions, type ContentModalities } from '@agentiq/smarttriad';
import { useSmartContentAction } from '@/contexts/SmartContentActionContext';
import { useIsMobile } from "@/hooks/use-mobile";
import heroImage from "@/assets/qriptopian-hero.jpg";

export function HeroSection() {
  const [activeArticle, setActiveArticle] = useState(0);
  const isMobile = useIsMobile();
  
  // Use global SmartContent action handler
  const { createHandler } = useSmartContentAction();
  
  // Get home-hero content from Liquid UI Issue Package v1.4
  const { content: liquidUIContent } = useLiquidUIContent('home-hero');
  
  // Transform Liquid UI content to component format
  const heroArticles = liquidUIContent.map(item => ({
    id: item.id,
    title: item.title,
    subtitle: item.excerpt || '',
    image: item.image || heroImage,
    readContent: item.modalities?.read?.text || item.excerpt || '',
    duration: item.modalities?.read?.duration || '5 min read',
    watchProgress: 0,
    imageScale: item.imageScale || 100,
    imageX: item.imageX || 50,
    imageY: item.imageY || 50,
    modalities: item.modalities ? (item.modalities as ContentModalities) : null,
  }));
  
  const articles = heroArticles.length > 0 ? heroArticles : [{
    id: '1',
    title: 'The Qriptopian',
    subtitle: 'Navigate the Quantum-Ready Internet',
    image: heroImage,
    readContent: 'Loading content...',
    duration: '12 min read',
    watchProgress: 0,
    modalities: null
  }];

  const actionItems = articles.map((article) => ({
    id: article.id,
    title: article.title,
    description: article.subtitle,
    image: article.image,
    modalities: 'modalities' in article ? article.modalities : null,
    section: 'home-hero',
  }));
  
  const currentArticle = articles[activeArticle];
  
  // Auto-advance carousel every 8 seconds
  useEffect(() => {
    if (articles.length <= 1) return;
    const interval = setInterval(() => {
      setActiveArticle(prev => (prev + 1) % articles.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [articles.length]);
  
  // Touch/swipe support
  const touchStartRef = useRef<number | null>(null);
  const touchEndRef = useRef<number | null>(null);
  
  const minSwipeDistance = 50;
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchEndRef.current = null;
    touchStartRef.current = e.targetTouches[0].clientX;
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndRef.current = e.targetTouches[0].clientX;
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchStart = touchStartRef.current;
    const touchEnd = touchEndRef.current ?? e.changedTouches[0]?.clientX;
    if (touchStart === null || touchEnd === null) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && articles.length > 1) {
      // Swipe left - next
      setActiveArticle(prev => (prev + 1) % articles.length);
    }
    if (isRightSwipe && articles.length > 1) {
      // Swipe right - previous
      setActiveArticle(prev => (prev - 1 + articles.length) % articles.length);
    }
  };
  return <div 
    className="w-full h-[calc(100svh-64px)] md:h-[calc(100vh-88px)] relative flex-shrink-0 overflow-hidden"
    onTouchStart={handleTouchStart}
    onTouchMove={handleTouchMove}
    onTouchEnd={handleTouchEnd}
  >
      <div 
        className="w-full h-full bg-cover bg-center"
        style={{
          backgroundImage: `url(${currentArticle.image})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: isMobile ? 'auto 100%' : `${(currentArticle as any).imageScale || 100}%`,
          backgroundPosition: isMobile
            ? 'center center'
            : `${(currentArticle as any).imageX || 50}% ${(currentArticle as any).imageY || 50}%`
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050f1f]" />
      
      {/* Action Buttons */}
      <div className="absolute top-4 right-6 md:right-8 flex gap-3 z-10">
        <SmartContentActions
          modalities={'modalities' in currentArticle ? currentArticle.modalities : null}
          context="hero"
          showExpand={false}
          showShare={true}
          size="md"
          onAction={createHandler({
            id: currentArticle.id,
            title: currentArticle.title,
            description: currentArticle.subtitle,
            image: currentArticle.image,
            modalities: 'modalities' in currentArticle ? currentArticle.modalities : null,
            section: 'home-hero',
          }, actionItems)}
        />
      </div>

      {/* Text Overlay */}
      <div className="absolute inset-x-0 bottom-0">
        <div className="bg-gradient-to-t from-black/80 to-transparent px-6 md:px-8 pb-8 md:pb-16">
          <div className="max-w-2xl">
            {/* Navigation Dots */}
            <div className="flex gap-2 mb-3 md:mb-6">
              {articles.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveArticle(index)}
                  className={`transition-all ${
                    index === activeArticle
                      ? 'w-8 h-2 bg-cyan-400 rounded-full'
                      : 'w-2 h-2 bg-white/30 hover:bg-white/50 rounded-full'
                  }`}
                  aria-label={`Article ${index + 1}`}
                />
              ))}
            </div>
            
            <h1 className="font-bold text-[#d0f6ff] mb-3 drop-shadow-[0_0_30px_rgba(0,196,255,0.5)] text-2xl md:text-4xl leading-tight">
              {currentArticle.title}
            </h1>
            <p className="text-sm md:text-lg text-[#8fb3c0] drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] line-clamp-2 md:line-clamp-none">
              {currentArticle.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* VideoModal and ArticleReader are now handled globally by SmartContentActionProvider */}
    </div>;
}
