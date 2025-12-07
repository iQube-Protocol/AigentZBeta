import { useState } from "react";
import { Play, BookOpen, Maximize2, X, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArticleReader, theQriptopianStyleGuide } from "@agentiq/article-reader";
import type { ArticleQube } from "@agentiq/codex";

interface ContentItem {
  id: string;
  title: string;
  image: string;
  badge?: string;
  article?: ArticleQube;  // Full article data for read mode
}

interface Kn0w1ViewerProps {
  items: ContentItem[];
  domain: string;
  hideActionIcons?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export function Kn0w1Viewer({ 
  items, 
  domain, 
  hideActionIcons = false,
  onFullscreenChange 
}: Kn0w1ViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState<'read' | 'watch' | 'listen'>('watch');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [readArticle, setReadArticle] = useState<ArticleQube | null>(null);

  const activeItem = items[activeIndex];

  const handlePrevious = () => {
    setActiveIndex((prev) => (prev === 0 ? items.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === items.length - 1 ? 0 : prev + 1));
  };

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
        <button
          onClick={() => setIsFullscreen(false)}
          className="absolute top-4 right-24 z-10 text-white hover:text-cyan-400 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
        
        <div className="relative w-full h-full flex items-center justify-center">
          <img
            src={activeItem.image}
            alt={activeItem.title}
            className="max-w-full max-h-full object-contain"
          />
          
          {/* Fullscreen Dot Navigation */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3">
            {items.map((item, index) => (
              <button
                key={item.id}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "transition-all rounded-full",
                  activeIndex === index 
                    ? "w-12 h-3 bg-cyan-400" 
                    : "w-3 h-3 bg-white/50 hover:bg-white/70"
                )}
                aria-label={`Go to ${item.title}`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* Hero Image */}
      <div className="relative h-[400px] bg-gradient-to-b from-purple-900 via-blue-900 to-black rounded-lg overflow-hidden">
        <img
          src={activeItem.image}
          alt={activeItem.title}
          className="w-full h-full object-cover opacity-80"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        
        {/* Badge */}
        {activeItem.badge && (
          <div className="absolute top-6 right-6 px-3 py-1 bg-cyan-500/20 border border-cyan-500 rounded text-sm text-cyan-400">
            {activeItem.badge}
          </div>
        )}
        
        {/* Play Button Center */}
        <button 
          onClick={() => setIsFullscreen(true)}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-cyan-500/30 border-2 border-cyan-400 flex items-center justify-center group hover:scale-110 transition-all"
        >
          <Play className="h-6 w-6 text-cyan-400 ml-1" fill="currentColor" />
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={() => setIsFullscreen(true)}
          className="absolute top-6 left-6 p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white transition-colors"
        >
          <Maximize2 className="h-5 w-5" />
        </button>
        
        {/* Title and Dot Navigation Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 mb-4">
            {activeItem.title}
          </h2>
          
          {/* Dot Navigation */}
          <div className="flex gap-2">
            {items.map((item, index) => (
              <button
                key={item.id}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "transition-all rounded-full",
                  activeIndex === index 
                    ? "w-8 h-2 bg-cyan-400" 
                    : "w-2 h-2 bg-cyan-400/30 hover:bg-cyan-400/50"
                )}
                aria-label={`Go to ${item.title}`}
              />
            ))}
          </div>
        </div>
        
        {/* Icon Buttons in Bottom Right */}
        {!hideActionIcons && (
          <div className="absolute bottom-8 right-8 flex gap-3 items-end">
            <button 
              onClick={() => activeItem.article && setReadArticle(activeItem.article)}
              disabled={!activeItem.article}
              className="text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" 
              aria-label="Read article"
            >
              <BookOpen className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setMode('watch')}
              className="text-cyan-400 hover:text-cyan-300 transition-colors" 
              aria-label="Watch video"
            >
              <Play className="h-4 w-4" />
            </button>
            <button 
              onClick={() => setMode('listen')}
              className="text-cyan-400 hover:text-cyan-300 transition-colors" 
              aria-label="Listen to audio"
            >
              <Headphones className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      
      {/* ArticleReader Modal */}
      <ArticleReader
        article={readArticle}
        isOpen={!!readArticle}
        onClose={() => setReadArticle(null)}
        styleGuide={theQriptopianStyleGuide}
      />
    </div>
  );
}
