import { useState, useEffect } from "react";
import { useLiquidUIContent } from "@/hooks/useLiquidUIContent";
import { SmartContentActions, type ContentModalities } from "./SmartContentActions";
import { useSmartContentAction } from "@/contexts/SmartContentActionContext";
import heroImage from "@/assets/qriptopian-hero.jpg";

export function HeroSection() {
  const [activeArticle, setActiveArticle] = useState(0);
  
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
    modalities: item.modalities as ContentModalities || null
  }));
  
  const articles = heroArticles.length > 0 ? heroArticles : [{
    id: '1',
    title: 'The Qriptopian',
    subtitle: 'Navigate the Quantum-Ready Internet',
    image: heroImage,
    readContent: 'Loading content...',
    duration: '12 min read',
    watchProgress: 0
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
  return <div 
    className="w-full h-[calc(100vh-88px)] relative flex-shrink-0"
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
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050f1f]" />
      
      {/* Main Content */}
      <div className="absolute inset-0 flex items-end pb-16">
        <div className="px-8 max-w-2xl">
          {/* Smart Content Actions - Only shows icons for available modalities */}
          <div className="flex items-center gap-4 mb-6">
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
              })}
            />
            
            {/* Navigation Dots */}
            <div className="flex gap-2">
              {articles.map((_, index) => <button key={index} onClick={() => setActiveArticle(index)} className={`transition-all ${index === activeArticle ? 'w-8 h-2 bg-cyan-400 rounded-full' : 'w-2 h-2 bg-white/30 hover:bg-white/50 rounded-full'}`} aria-label={`Article ${index + 1}`} />)}
            </div>
          </div>
          
          <h1 className="font-bold text-[#d0f6ff] mb-4 drop-shadow-[0_0_30px_rgba(0,196,255,0.5)] text-4xl">
            {currentArticle.title}
          </h1>
          <p className="text-xl text-[#8fb3c0] drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
            {currentArticle.subtitle}
          </p>
        </div>
      </div>

      {/* VideoModal and ArticleReader are now handled globally by SmartContentActionProvider */}
    </div>;
}