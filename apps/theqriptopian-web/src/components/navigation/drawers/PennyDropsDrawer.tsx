/**
 * PennyDropsDrawer - Q¢ Use Cases
 * Published Issue #0 v0.1
 * 
 * Single tab: Stories
 * Subtitle: "Q¢ use cases - fun, practical, irreverent"
 * Features: metaVatar integration, modality buttons, hover actions
 */

import { useState } from "react";
import { DrawerLayer } from "@agentiq/smarttriad";
import { useCodex } from "@agentiq/codex";
import { Kn0w1Viewer } from "@/components/content/Kn0w1Viewer";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";

interface PennyDropsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PennyDropsDrawer({ isOpen, onClose }: PennyDropsDrawerProps) {
  const [activeTab] = useState('stories');
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);
  const { currentCodex } = useCodex();
  
  // Get live content from CodexQube
  const pennyDropsDomain = currentCodex?.domains.find(d => d.domainId === 'pennydrops');
  const pennyDropsContent = pennyDropsDomain?.sections?.map(section => ({
    id: section.contentId,
    title: section.title,
    description: section.excerpt || '',
    image: section.media?.thumbnail || section.media?.hero || 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=600&fit=crop',
    badge: 'Q¢',
  })) || [];

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
            <Kn0w1Viewer
              items={pennyDropsContent}
              domain="pennydrops"
              onFullscreenChange={(isFullscreen) => {
                if (!isFullscreen) setFullscreenIndex(null);
              }}
            />
          </div>

          {/* metaVatar Placeholder Area - Desktop only */}
          <div className="hidden md:block md:col-span-1">
            <div className="h-full bg-background/20 backdrop-blur-sm border border-border/30 rounded-lg flex items-center justify-center">
              <div className="text-center text-muted-foreground p-6">
                <p className="text-sm">metaVatar Integration</p>
                <p className="text-xs mt-2 opacity-70">Coming soon</p>
              </div>
            </div>
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
                  <button
                    onClick={() => setFullscreenIndex(index)}
                    className="group relative aspect-[47/20] w-full overflow-hidden rounded-lg bg-black"
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
                      <p className="text-white text-xs font-medium line-clamp-2">
                        {item.title}
                      </p>
                    </div>
                  </button>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>
      </div>
    </DrawerLayer>
  );
}
