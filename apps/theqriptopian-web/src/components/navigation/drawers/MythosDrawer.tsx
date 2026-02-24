import { DrawerLayer } from "@agentiq/smarttriad";
import { SmartContentViewer } from "@/components/content/SmartContentViewer";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { useState } from "react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";

interface MythosDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const mythosContent = [
  {
    id: '1',
    title: 'The Awakening: Chapter 1',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=800&fit=crop',
    badge: 'COMIC'
  },
  {
    id: '2',
    title: 'Chronicles of the Quantum Realm',
    image: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=1200&h=800&fit=crop',
    badge: 'STORY'
  },
  {
    id: '3',
    title: 'Voices from the Digital Frontier',
    image: 'https://images.unsplash.com/photo-1617791160505-6f00504e3519?w=1200&h=800&fit=crop',
    badge: 'SERIES'
  },
  {
    id: '4',
    title: 'The Rise of the Agent Network',
    image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1200&h=800&fit=crop',
    badge: 'COMIC'
  },
  {
    id: '5',
    title: 'Legends of the Blockchain',
    image: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=1200&h=800&fit=crop',
    badge: 'STORY'
  },
  {
    id: '6',
    title: 'The iQube Chronicles',
    image: 'https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=1200&h=800&fit=crop',
    badge: 'SERIES'
  },
];

export function MythosDrawer({ isOpen, onClose }: MythosDrawerProps) {
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  
  const tabs = [
    { id: 'stories', label: 'Stories' },
    { id: 'chronicles', label: 'Chronicles' },
    { id: 'voices', label: 'Voices' },
    { id: 'culture', label: 'Culture' },
  ];

  return (
    <DrawerLayer
      isOpen={isOpen}
      onClose={onClose}
      title="Mythos"
      subtitle="Stories from the Quantum-Ready Internet"
      columns={2}
      tabs={tabs}
    >
      <div className="col-span-full space-y-6">
        {/* Main Carousel with Large Cards */}
        <Carousel 
          className="w-full"
          opts={{
            align: "start",
            loop: true
          }}
          plugins={[WheelGesturesPlugin()]}
        >
          <CarouselContent>
            {mythosContent.map((item, index) => (
              <CarouselItem key={item.id} className="md:basis-1/2">
                <div 
                  onClick={() => setSelectedItemIndex(index)}
                  className="cursor-pointer"
                >
                  <SmartContentViewer items={[item]} domain="mythos" />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        {/* Thumbnail Scrolling Layer */}
        <div className="border-t border-border/30 pt-4">
          <Carousel
            className="w-full"
            opts={{
              align: "start",
              dragFree: true
            }}
            plugins={[WheelGesturesPlugin()]}
          >
            <CarouselContent className="-ml-2">
              {mythosContent.map((item, index) => (
                <CarouselItem key={`thumb-${item.id}`} className="basis-[43%] md:basis-1/3 lg:basis-1/4 pl-2">
                  <button
                    onClick={() => setSelectedItemIndex(index)}
                    className={`w-full aspect-video rounded-lg overflow-hidden border-2 transition-all hover:border-primary/50 ${
                      selectedItemIndex === index 
                        ? 'border-primary ring-2 ring-primary/20' 
                        : 'border-border/30'
                    }`}
                  >
                    <img 
                      src={item.image} 
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
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
