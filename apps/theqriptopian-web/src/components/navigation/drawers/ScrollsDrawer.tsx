/**
 * ScrollsDrawer - Chronicles from the Quantum-Ready Internet
 * Published Issue #0 v0.1
 * 
 * Tabs: metaKnyts, The SynthSims
 * Subtitle: "Chronicles from the Quantum-Ready Internet"
 * Features: Large carousel cards, pagination dots, media controls
 * 
 * NOTE: Read modality articles will require ArticleReader primitive (TBD)
 */

import { useState } from "react";
import { DrawerLayer } from "@agentiq/smarttriad";
import { useCodex } from "@agentiq/codex";
import { Kn0w1Viewer } from "@/components/content/Kn0w1Viewer";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";

interface ScrollsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// metaKnyts content - visual narratives/comics
const metaKnytsContent = [
  {
    id: '1',
    title: 'metaKnyts: The Awakening',
    description: 'Chapter 1 - The quantum realm opens',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=800&fit=crop',
    badge: 'COMIC',
  },
  {
    id: '2',
    title: 'Chronicles of the Quantum Realm',
    description: 'Tales from the digital frontier',
    image: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=1200&h=800&fit=crop',
    badge: 'STORY',
  },
];

// The SynthSims content - simulations/scenarios
const synthSimsContent = [
  {
    id: '1',
    title: 'The First Transaction',
    description: 'Simulating the birth of quantum currency',
    image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1200&h=800&fit=crop',
    badge: 'SIM',
  },
  {
    id: '2',
    title: 'Agent Emergence',
    description: 'When AI meets quantum protocols',
    image: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=1200&h=800&fit=crop',
    badge: 'SIM',
  },
];

export function ScrollsDrawer({ isOpen, onClose }: ScrollsDrawerProps) {
  const [activeTab, setActiveTab] = useState('metaknyts');
  const { currentCodex } = useCodex();
  
  // Get live content from CodexQube
  const scrollsDomain = currentCodex?.domains.find(d => d.domainId === 'scrolls');
  const scrollsContent = scrollsDomain?.sections?.map(section => ({
    id: section.contentId,
    title: section.title,
    description: section.excerpt || '',
    image: section.media?.thumbnail || section.media?.hero || 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&h=600&fit=crop',
    badge: 'SCROLL',
  })) || [];

  const tabs = [
    { id: 'metaknyts', label: 'metaKnyts' },
    { id: 'synthsims', label: 'The SynthSims' },
  ];

  const currentContent = scrollsContent;

  return (
    <DrawerLayer
      isOpen={isOpen}
      onClose={onClose}
      title="Scrolls"
      subtitle="Chronicles from the Quantum-Ready Internet"
      columns={2}
      tabs={tabs}
    >
      <div className="col-span-2 h-full flex flex-col">
        {/* Main Content Area */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Large Carousel - Desktop: half width, Mobile: full */}
          <div className="md:col-span-1">
            <Carousel
              opts={{ align: "center", loop: true }}
              plugins={[WheelGesturesPlugin()]}
              className="w-full"
            >
              <CarouselContent>
                {currentContent.map((item) => (
                  <CarouselItem key={item.id}>
                    <Kn0w1Viewer
                      items={[item]}
                      domain="scrolls"
                      hideActionIcons={false}
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              
              {/* Pagination Dots */}
              <div className="flex justify-center gap-2 mt-4">
                {currentContent.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 rounded-full transition-all ${
                      index === 0 
                        ? 'w-8 bg-cyan-400' 
                        : 'w-2 bg-white/30'
                    }`}
                  />
                ))}
              </div>
            </Carousel>
          </div>

          {/* Thumbnail Grid - Desktop: half width, Mobile: full */}
          <div className="md:col-span-1 grid grid-cols-2 gap-4">
            {currentContent.map((item) => (
              <div
                key={item.id}
                className="group relative aspect-video overflow-hidden rounded-lg bg-black cursor-pointer"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                
                {item.badge && (
                  <div className="absolute top-2 left-2">
                    <span className="px-2 py-1 bg-purple-500/80 backdrop-blur-sm text-white text-xs font-bold rounded">
                      {item.badge}
                    </span>
                  </div>
                )}

                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-white text-sm font-medium line-clamp-2">
                    {item.title}
                  </p>
                  <p className="text-white/70 text-xs mt-1 line-clamp-1">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Thumbnail Carousel Overlay (hidden on desktop) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/95 via-black/80 to-transparent z-50">
          <Carousel
            opts={{ align: "start", loop: true }}
            plugins={[WheelGesturesPlugin()]}
            className="w-full h-full px-2 pt-2"
          >
            <CarouselContent className="-ml-2">
              {currentContent.map((item) => (
                <CarouselItem key={item.id} className="pl-2 basis-[43%]">
                  <div className="relative aspect-video overflow-hidden rounded-md bg-black">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>
      </div>
    </DrawerLayer>
  );
}
