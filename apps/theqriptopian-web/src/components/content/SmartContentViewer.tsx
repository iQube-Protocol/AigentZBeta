import { useState } from "react";
import { Play, X, Maximize2, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  SmartContentActions, 
  type ContentModalities,
  hasPlayableContent,
  hasReadableContent,
} from "./SmartContentActions";
import { useSmartContentAction } from "@/contexts/SmartContentActionContext";

interface ContentItem {
  id: string;
  title: string;
  image: string;
  badge?: string;
  description?: string;
  modalities?: ContentModalities;
}

interface SmartContentViewerProps {
  items: ContentItem[];
  domain: string;
  hideActionIcons?: boolean;
  onFullscreenChange?: (isFullscreen: boolean) => void;
}

export function SmartContentViewer({ 
  items, 
  domain, 
  hideActionIcons = false,
  onFullscreenChange 
}: SmartContentViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Use global SmartContent action handler
  const { executeAction } = useSmartContentAction();

  const activeItem = items[activeIndex];

  // Guard against empty items array
  if (!activeItem) {
    return (
      <div className="h-[400px] flex items-center justify-center bg-black/50 rounded-lg">
        <p className="text-white/50">No content available</p>
      </div>
    );
  }

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
          aria-label="Close fullscreen"
          title="Close fullscreen"
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
        
        {/* Primary Action Button Center - Only show if there's playable or readable content */}
        {hasPlayableContent(activeItem.modalities) && (
          <button 
            onClick={() => executeAction('watch', activeItem)}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-cyan-500/30 border-2 border-cyan-400 flex items-center justify-center group hover:scale-110 transition-all"
            aria-label="Play video"
            title="Play video"
          >
            <Play className="h-6 w-6 text-cyan-400 ml-1" fill="currentColor" />
          </button>
        )}
        
        {/* Read Button Center - Show if readable but not playable */}
        {!hasPlayableContent(activeItem.modalities) && hasReadableContent(activeItem.modalities) && (
          <button 
            onClick={() => executeAction('read', activeItem)}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-cyan-500/30 border-2 border-cyan-400 flex items-center justify-center group hover:scale-110 transition-all"
            aria-label="Read article"
            title="Read article"
          >
            <BookOpen className="h-6 w-6 text-cyan-400" />
          </button>
        )}

        {/* Fullscreen Button */}
        <button
          onClick={() => setIsFullscreen(true)}
          className="absolute top-6 left-6 p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white transition-colors"
          aria-label="View fullscreen"
          title="View fullscreen"
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
        
        {/* Smart Content Action Buttons */}
        {!hideActionIcons && (
          <div className="absolute bottom-8 right-8">
            <SmartContentActions
              modalities={activeItem.modalities || null}
              context="drawer"
              showExpand={true}
              showShare={true}
              onAction={(action) => {
                // Expand/view is handled locally for fullscreen
                if (action === 'expand' || action === 'view') {
                  setIsFullscreen(true);
                } else {
                  // All other actions use global handler
                  executeAction(action, activeItem);
                }
              }}
            />
          </div>
        )}
      </div>
      
      {/* VideoModal and ArticleReader are now handled globally by SmartContentActionProvider */}
    </div>
  );
}
