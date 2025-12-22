import { useState, useEffect } from "react";
import { useLiquidUIContent } from "@/hooks/useLiquidUIContent";
import { SmartContentActions, type ContentModalities } from "./SmartContentActions";
import { useSmartContentAction } from "@/contexts/SmartContentActionContext";
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
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  const handleTouchEnd = () => {
    if (touchStart - touchEnd > 75) {
      // Swipe left - next
      setActiveArticle(prev => (prev + 1) % articles.length);
    }
    if (touchStart - touchEnd < -75) {
      // Swipe right - previous
      setActiveArticle(prev => (prev - 1 + articles.length) % articles.length);
    }
  };
  
  return (
    <div 
      className="w-full h-[60vh] relative flex-shrink-0 bg-[#050f1f]"
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
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center px-8 max-w-4xl">
          <h2 className="text-5xl font-bold text-[#d0f6ff] mb-6 drop-shadow-[0_0_30px_rgba(0,196,255,0.5)]">
            {currentArticle.title}
          </h2>
          <p className="text-xl text-[#8fb3c0] mb-8 drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
            {currentArticle.subtitle}
          </p>
          {/* SmartContentActions - uses global action handler */}
          <div className="flex justify-center mb-4">
            <SmartContentActions
              modalities={currentArticle.modalities}
              context="hero"
              showExpand={false}
              showShare={true}
              size="lg"
              onAction={createHandler({
                id: currentArticle.id,
                title: currentArticle.title,
                description: currentArticle.subtitle,
                image: currentArticle.image,
                modalities: currentArticle.modalities,
              })}
            />
          </div>
          
          {articles.length > 1 && (
            <div className="flex justify-center gap-2 mt-4">
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
        </div>
      </div>

      {/* VideoModal and ArticleReader are now handled globally by SmartContentActionProvider */}
    </div>
  );
}
