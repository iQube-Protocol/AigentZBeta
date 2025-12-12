import { useState } from "react";
import { BookOpen, Play, Headphones } from "lucide-react";
import heroImage from "@/assets/qriptopian-hero.jpg";
import quantumTechImage from "@/assets/quantum-tech-hero.jpg";
const articles = [{
  id: 1,
  title: "The Qriptopian",
  subtitle: "Navigate the Quantum-Ready Internet",
  image: heroImage,
  readContent: "In the rapidly evolving landscape of quantum computing and decentralized technologies, The Qriptopian emerges as a comprehensive guide for navigating this new frontier. This groundbreaking publication explores the intersection of quantum mechanics and internet infrastructure...",
  duration: "12 min read",
  watchProgress: 0
}, {
  id: 2,
  title: "Quantum Market Intel",
  subtitle: "Real-time insights across all major protocols",
  image: quantumTechImage,
  readContent: "The quantum market represents a paradigm shift in how we understand financial networks and trading algorithms. With the integration of quantum computing capabilities into market analysis...",
  duration: "8 min read",
  watchProgress: 0
}, {
  id: 3,
  title: "DeFi Protocol Evolution",
  subtitle: "Next-generation decentralized finance",
  image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1920&h=1080&fit=crop",
  readContent: "Decentralized Finance continues to evolve at breakneck speed, with new protocols emerging that challenge traditional financial systems. This comprehensive analysis examines the latest developments...",
  duration: "15 min read",
  watchProgress: 0
}];
export function HeroSection() {
  const [activeArticle, setActiveArticle] = useState(0);
  const [activeMode, setActiveMode] = useState<'read' | 'watch' | 'listen' | null>(null);
  const currentArticle = articles[activeArticle];
  return <div className="w-full h-[calc(100vh-88px)] relative flex-shrink-0">
      <img src={currentArticle.image} alt={currentArticle.title} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050f1f]" />
      
      {/* Main Content */}
      <div className="absolute inset-0 flex items-end pb-16">
        <div className="px-8 max-w-2xl">
          {/* Action Icons and Navigation Dots */}
          <div className="flex items-center gap-4 mb-6">
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
            
            {/* Navigation Dots */}
            <div className="flex gap-2">
              {articles.map((_, index) => <button key={index} onClick={() => setActiveArticle(index)} className={`transition-all ${index === activeArticle ? 'w-8 h-2 bg-cyan-400 rounded-full' : 'w-2 h-2 bg-white/30 hover:bg-white/50 rounded-full'}`} aria-label={`Article ${index + 1}`} />)}
            </div>
          </div>
          
          <h1 className="font-bold text-[#d0f6ff] mb-4 drop-shadow-[0_0_30px_rgba(0,196,255,0.5)] text-5xl">
            {currentArticle.title}
          </h1>
          <p className="text-xl text-[#8fb3c0] drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
            {currentArticle.subtitle}
          </p>
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