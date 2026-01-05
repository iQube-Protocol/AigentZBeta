import { useState, useEffect } from "react";
import { useLiquidUIContent } from '@/hooks/useLiquidUIContent';
import { SmartContentActions, type ContentModalities } from '@agentiq/smarttriad';
import { useSmartContentAction } from '@/contexts/SmartContentActionContext';
import quantumTechHero from "@/assets/quantum-tech-hero.jpg";

export function SecondHeroSection() {
  const [activeArticle, setActiveArticle] = useState(0);
  
  // Use global SmartContent action handler
  const { createHandler } = useSmartContentAction();
  
  // Get second-hero content from Liquid UI Issue Package v1.4
  const { content: liquidUIContent } = useLiquidUIContent('second-hero');
  
  // Transform Liquid UI content to component format
  const heroArticles = liquidUIContent.map(item => ({
    id: item.id,
    title: item.title,
    subtitle: item.excerpt || '',
    image: item.image || quantumTechHero,
    imageScale: item.imageScale || 100,
    imageX: item.imageX || 50,
    imageY: item.imageY || 50,
    modalities: item.modalities as ContentModalities || null
  }));
  
  const articles = heroArticles.length > 0 ? heroArticles : [{
    id: '1',
    title: 'Powering the Quantum Future',
    subtitle: 'Advanced computing infrastructure for the next generation of digital innovation',
    image: quantumTechHero,
  }];
  
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
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  const minSwipeDistance = 50;
  
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null); // Reset touchEnd
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
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
  
  return (
    <div 
      className="w-full h-[calc(100svh-64px)] md:h-[calc(100vh-88px)] relative flex-shrink-0 bg-[#050f1f] overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className="w-full h-full bg-cover bg-center"
        style={{
          backgroundImage: `url(${currentArticle.image})`,
          backgroundSize: `${(currentArticle as any).imageScale || 100}%`,
          backgroundPosition: `${(currentArticle as any).imageX || 50}% ${(currentArticle as any).imageY || 50}%`
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050f1f] via-transparent to-transparent" />

      {/* Action Buttons */}
      <div className="absolute top-4 right-6 md:right-8 flex gap-3 z-10">
        <SmartContentActions
          modalities={currentArticle.modalities}
          context="hero"
          showExpand={false}
          showShare={true}
          size="md"
          onAction={createHandler({
            id: currentArticle.id,
            title: currentArticle.title,
            description: currentArticle.subtitle,
            image: currentArticle.image,
            modalities: currentArticle.modalities,
            section: 'second-hero',
          })}
        />
      </div>

      {/* Text Overlay */}
      <div className="absolute inset-x-0 bottom-0">
        <div className="bg-gradient-to-t from-black/80 to-transparent px-6 md:px-8 pb-8 md:pb-16">
          <div className="text-left max-w-2xl">
            {/* Navigation Dots */}
            {articles.length > 1 && (
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
            )}

            <h2 className="text-2xl md:text-4xl font-bold text-[#d0f6ff] mb-3 drop-shadow-[0_0_30px_rgba(0,196,255,0.5)] leading-tight">
              {currentArticle.title}
            </h2>
            <p className="text-sm md:text-lg text-[#8fb3c0] drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] line-clamp-2 md:line-clamp-none">
              {currentArticle.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* VideoModal and ArticleReader are now handled globally by SmartContentActionProvider */}
    </div>
  );
}
