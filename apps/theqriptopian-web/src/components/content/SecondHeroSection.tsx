import { useState, useEffect } from "react";
import { useCodex } from "@agentiq/codex";
import quantumTechHero from "@/assets/quantum-tech-hero.jpg";

export function SecondHeroSection() {
  const [activeArticle, setActiveArticle] = useState(0);
  const { currentCodex } = useCodex();
  
  // Get second-hero content from CodexQube
  const homeDomain = currentCodex?.domains.find(d => d.domainId === 'home');
  const heroArticles = homeDomain?.sections?.filter(s => {
    const section = (s as any).placement?.section;
    return section === 'second-hero';
  }).map(section => ({
    id: section.contentId,
    title: section.title,
    subtitle: section.excerpt || '',
    image: section.media?.hero || section.media?.thumbnail || quantumTechHero,
  })) || [];
  
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
      <img 
        src={currentArticle.image} 
        alt={currentArticle.title} 
        className="w-full h-full object-cover" 
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
    </div>
  );
}
