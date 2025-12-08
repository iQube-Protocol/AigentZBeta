import { useState, useEffect } from "react";
import { BookOpen, Play, Headphones } from "lucide-react";
import { useCodex } from "@agentiq/codex";
import heroImage from "@/assets/qriptopian-hero.jpg";
export function HeroSection() {
  const [activeArticle, setActiveArticle] = useState(0);
  const [activeMode, setActiveMode] = useState<'read' | 'watch' | 'listen' | null>(null);
  const { currentCodex } = useCodex();
  
  // Get home-hero content from CodexQube
  const homeDomain = currentCodex?.domains.find(d => d.domainId === 'home');
  const heroArticles = homeDomain?.sections
    ?.filter(s => {
      const section = (s as any).placement?.section;
      return section === 'home-hero';
    })
    .sort((a, b) => {
      const posA = (a as any).placement?.position || 0;
      const posB = (b as any).placement?.position || 0;
      return posA - posB;
    })
    .map(section => {
      const placement = (section as any).placement;
      return {
        id: section.contentId,
        title: section.title,
        subtitle: section.excerpt || '',
        image: section.media?.hero || section.media?.thumbnail || heroImage,
        readContent: section.excerpt || '',
        duration: '12 min read',
        watchProgress: 0,
        imageScale: placement?.imageScale || 100,
        imageX: placement?.imageX || 50,
        imageY: placement?.imageY || 50
      };
    }) || [];
  
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
      
      {/* Main Content - Centered */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center max-w-3xl px-8">
          <h1 className="font-bold text-[#d0f6ff] mb-4 drop-shadow-[0_0_30px_rgba(0,196,255,0.5)] text-5xl md:text-6xl">
            {currentArticle.title}
          </h1>
          <p className="text-xl text-[#8fb3c0] drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] mb-8">
            {currentArticle.subtitle}
          </p>
          
          {/* Centered Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-lg bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M12 8v8" />
                <path d="M8 12h8" />
              </svg>
            </div>
          </div>
          
          {/* Navigation Dots */}
          <div className="flex justify-center gap-2">
            {articles.map((_, index) => (
              <button 
                key={index} 
                onClick={() => setActiveArticle(index)} 
                className={`transition-all rounded-full ${
                  index === activeArticle 
                    ? 'w-8 h-2 bg-cyan-400' 
                    : 'w-2 h-2 bg-white/30 hover:bg-white/50'
                }`} 
                aria-label={`Article ${index + 1}`} 
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Bottom-left Action Icons */}
      <div className="absolute bottom-8 left-8">
        <div className="flex gap-3">
          <button onClick={() => setActiveMode(activeMode === 'read' ? null : 'read')} className={`p-2 rounded-lg transition-all ${activeMode === 'read' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500' : 'bg-black/50 text-cyan-400 hover:text-cyan-300 hover:bg-black/70'}`} aria-label="Read">
            <BookOpen className="h-4 w-4" />
          </button>
          <button onClick={() => setActiveMode(activeMode === 'watch' ? null : 'watch')} className={`p-2 rounded-lg transition-all ${activeMode === 'watch' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500' : 'bg-black/50 text-cyan-400 hover:text-cyan-300 hover:bg-black/70'}`} aria-label="Watch">
            <Play className="h-4 w-4" />
          </button>
          <button onClick={() => setActiveMode(activeMode === 'listen' ? null : 'listen')} className={`p-2 rounded-lg transition-all ${activeMode === 'listen' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500' : 'bg-black/50 text-cyan-400 hover:text-cyan-300 hover:bg-black/70'}`} aria-label="Listen">
            <Headphones className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Read Mode Overlay */}
      {activeMode === 'read' && <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8">
          <div className="max-w-4xl w-full bg-[#0a1528]/95 rounded-lg border border-cyan-500/20 p-8 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-3xl font-bold text-[#d0f6ff] mb-2">{currentArticle.title}</h2>
                <p className="text-cyan-400">{currentArticle.duration}</p>
              </div>
              <button onClick={() => setActiveMode(null)} className="text-cyan-400 hover:text-cyan-300 text-xl">
                ×
              </button>
            </div>
            <div className="prose prose-cyan max-w-none">
              <p className="text-gray-300 leading-relaxed text-lg">
                {currentArticle.readContent}
              </p>
            </div>
          </div>
        </div>}

      {/* Watch Mode Overlay */}
      {activeMode === 'watch' && <div className="absolute inset-0 bg-black/95 flex items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="absolute top-6 right-24 z-10">
              <button onClick={() => setActiveMode(null)} className="text-white hover:text-cyan-400 text-xl bg-black/50 rounded-full w-10 h-10 flex items-center justify-center">
                ×
              </button>
            </div>
            
            {/* Watch Content Placeholder */}
            <div className="text-center">
              <div className="w-32 h-32 mx-auto mb-6 bg-cyan-500/20 rounded-full flex items-center justify-center border border-cyan-500">
                <Play className="h-16 w-16 text-cyan-400" />
              </div>
              <h3 className="text-2xl text-white mb-4">{currentArticle.title}</h3>
              <div className="text-cyan-400 mb-6">Duration: {currentArticle.duration}</div>
              
              {/* Progress Bar */}
              <div className="w-96 mx-auto">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>0:00</span>
                  <span>{currentArticle.duration}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className="bg-cyan-400 h-2 rounded-full transition-all" style={{
                width: `${currentArticle.watchProgress}%`
              }} />
                </div>
              </div>
            </div>
          </div>
        </div>}
    </div>;
}