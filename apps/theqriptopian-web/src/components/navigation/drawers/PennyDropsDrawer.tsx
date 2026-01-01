/**
 * PennyDropsDrawer - Q¢ Use Cases
 * Published Issue #0 v0.1
 * 
 * Single tab: Stories
 * Subtitle: "Q¢ use cases - fun, practical, irreverent"
 * Features: metaVatar integration, modality buttons, hover actions
 */

import { useState, useEffect } from "react";
import { DrawerLayer } from "@agentiq/smarttriad";
import { useLiquidUIContent } from "@/hooks/useLiquidUIContent";
import { SmartContentViewer } from "@/components/content/SmartContentViewer";
import { SmartContentActions, type ContentModalities } from "@/components/content/SmartContentActions";
import { useSmartContentAction } from "@/contexts/SmartContentActionContext";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import { useMetaAvatar } from "@/contexts/MetaAvatarContext";

interface PennyDropsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PennyDropsDrawer({ isOpen, onClose }: PennyDropsDrawerProps) {
  const [activeTab] = useState('stories');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const { requestAvatar, releaseAvatar } = useMetaAvatar();
  
  // Use global SmartContent action handler
  const { createHandler } = useSmartContentAction();
  
  // Get pennydrops content from Liquid UI Issue Package v1.4
  const { content: liquidUIContent } = useLiquidUIContent('pennydrops');

  // Request/release avatar based on drawer state and fullscreen mode
  useEffect(() => {
    if (isOpen && fullscreenIndex === null) {
      // Show avatar in sidebar when drawer is open and not in fullscreen
      requestAvatar('sidebar', 'moneypenny');
    } else {
      // Hide avatar when drawer closes or fullscreen is active
      releaseAvatar('sidebar');
    }
    
    // Cleanup on unmount
    return () => releaseAvatar('sidebar');
  }, [isOpen, fullscreenIndex, requestAvatar, releaseAvatar]);
  
  // Transform Liquid UI content to component format
  const pennyDropsContent = liquidUIContent.map(item => ({
    id: item.id,
    title: item.title,
    description: item.excerpt || '',
    image: item.image || 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=600&fit=crop',
    badge: item.badge || 'Q¢',
    modalities: item.modalities || {},
  }));

  const tabs = [
    { id: 'stories', label: 'Stories' },
  ];

  return (
    <DrawerLayer
      isOpen={isOpen}
      onClose={onClose}
      title="Penny Drops"
      subtitle="Q¢ use cases - fun, practical, irreverent"
      columns={3}
      tabs={tabs}
    >
      <div className="col-span-3 h-full flex flex-col">
        {/* Feature Area - Desktop: col-span-2, Mobile: full width */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Feature Viewer */}
          <div className="md:col-span-2">
            <SmartContentViewer
              items={pennyDropsContent}
              domain="pennydrops"
              initialIndex={selectedIndex}
              onFullscreenChange={(isFullscreen) => {
                if (!isFullscreen) setFullscreenIndex(null);
              }}
            />
          </div>

          {/* metaVatar Area - Desktop only
              The actual avatar is rendered globally in Layout.tsx
              and positioned via CSS to appear in this column */}
          <div className="hidden md:block md:col-span-1">
            {/* Transparent placeholder - avatar renders behind/over this via fixed positioning */}
          </div>
        </div>

        {/* Thumbnail Carousel - Desktop: below, Mobile: overlay at bottom */}
        <div className="mt-6 pt-6 border-t border-border/30">
          <Carousel
            opts={{ align: "start", loop: true }}
            plugins={[WheelGesturesPlugin()]}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {pennyDropsContent.map((item, index) => (
                <CarouselItem key={item.id} className="pl-4 basis-1/4">
                  <div
                    onClick={() => setSelectedIndex(index)}
                    className={`group relative aspect-[47/20] w-full overflow-hidden rounded-lg bg-black cursor-pointer transition-all ${selectedIndex === index ? 'ring-2 ring-cyan-400' : 'opacity-70 hover:opacity-100'}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedIndex(index)}
                  >
                    <img
                      src={item.image}
                      alt={item.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    
                    {item.badge && (
                      <div className="absolute top-2 left-2">
                        <span className="px-2 py-0.5 bg-cyan-500/80 backdrop-blur-sm text-white text-[10px] font-bold rounded">
                          {item.badge}
                        </span>
                      </div>
                    )}

                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-white text-sm font-medium line-clamp-2">
                        {item.title}
                      </p>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>
      </div>

      {/* VideoModal and ArticleReader are now handled globally by SmartContentActionProvider */}
    </DrawerLayer>
  );
}
