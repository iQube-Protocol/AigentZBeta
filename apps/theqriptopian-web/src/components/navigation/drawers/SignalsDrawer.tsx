import { useState } from "react";
import { DrawerLayer } from "@agentiq/smarttriad";
import { SmartContentViewer } from "@/components/content/SmartContentViewer";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { BookOpen, Play, Headphones, Maximize2, X } from "lucide-react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
interface SignalsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}
const signalsContent = [{
  id: '1',
  title: 'Real-Time Market Signals: Q¢ HFT Update',
  image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1200&h=800&fit=crop',
  badge: 'LIVE'
}, {
  id: '2',
  title: 'Cross-Chain Activity Surge Detected',
  image: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=1200&h=800&fit=crop',
  badge: 'HOT'
}, {
  id: '3',
  title: 'DeFi Protocol Governance Changes',
  image: 'https://images.unsplash.com/photo-1642790551116-18e150f248e4?w=1200&h=800&fit=crop',
  badge: 'NEW'
}];
const thumbnailContent = [{
  id: '1',
  image: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=400&h=300&fit=crop',
  title: 'DeFi Protocol Monitor',
  subtitle: 'Track governance changes',
  badge: 'HOT'
}, {
  id: '2',
  image: 'https://images.unsplash.com/photo-1642790551116-18e150f248e4?w=400&h=300&fit=crop',
  title: 'Cross-Chain Flows',
  subtitle: 'Multi-chain analytics',
  badge: 'LIVE'
}, {
  id: '3',
  image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop',
  title: 'Sentiment Analysis',
  subtitle: 'AI-powered insights',
  badge: 'NEW'
}, {
  id: '4',
  image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop',
  title: 'Volume Tracker',
  subtitle: '24h trading volume'
}, {
  id: '5',
  image: 'https://images.unsplash.com/photo-1543286386-2e659306cd6c?w=400&h=300&fit=crop',
  title: 'Whale Movements',
  subtitle: 'Large transactions',
  badge: 'ALERT'
}, {
  id: '6',
  image: 'https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?w=400&h=300&fit=crop',
  title: 'Gas Price Monitor',
  subtitle: 'Network fee trends'
}];
export function SignalsDrawer({
  isOpen,
  onClose
}: SignalsDrawerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const tabs = [{
    id: 'current',
    label: 'Current'
  }, {
    id: 'archive',
    label: 'Archive'
  }];
  
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
        <button
          onClick={() => setIsFullscreen(false)}
          className="absolute top-4 right-4 z-10 text-white hover:text-cyan-400 transition-colors"
          aria-label="Close fullscreen"
          title="Close fullscreen"
        >
          <X className="h-6 w-6" />
        </button>
        
        <div className="relative w-full h-full flex items-center justify-center">
          <img
            src="https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1920&h=1080&fit=crop"
            alt="Market Overview"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      </div>
    );
  }
  
  return <DrawerLayer isOpen={isOpen} onClose={onClose} title="Signals" subtitle="What's happening now" columns={3} tabs={tabs}>
      <div className="col-span-3">
        <div className="grid grid-cols-3 gap-6">
          {/* Column 1: Main Signal Viewer */}
          <div className="h-full">
            <SmartContentViewer items={signalsContent} domain="signals" />
          </div>

          {/* Column 2 & 3: Hero Image */}
          <div className="col-span-2">
            <div className="relative h-[400px] rounded-lg overflow-hidden bg-gradient-to-br from-cyan-900 via-blue-900 to-purple-900">
              <img src="https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1200&h=600&fit=crop" alt="Market Overview" className="w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              
              {/* Fullscreen Button */}
              <button
                onClick={() => setIsFullscreen(true)}
                className="absolute top-6 left-6 p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white transition-colors"
                aria-label="View fullscreen"
                title="View fullscreen"
              >
                <Maximize2 className="h-5 w-5" />
              </button>
              
              {/* Icon Buttons in Bottom Right */}
              <div className="absolute bottom-6 right-6 flex gap-3 items-end">
                <button className="text-cyan-400 hover:text-cyan-300 transition-colors" aria-label="Read" title="Read">
                  <BookOpen className="h-4 w-4" />
                </button>
                <button className="text-cyan-400 hover:text-cyan-300 transition-colors" aria-label="Watch" title="Watch">
                  <Play className="h-4 w-4" />
                </button>
                <button className="text-cyan-400 hover:text-cyan-300 transition-colors" aria-label="Listen" title="Listen">
                  <Headphones className="h-4 w-4" />
                </button>
              </div>
              
              <div className="absolute bottom-6 left-6">
                <div className="inline-block px-3 py-1 bg-cyan-500/20 border border-cyan-500 rounded text-sm text-cyan-400 mb-3">
                  LIVE ANALYSIS
                </div>
                <h2 className="font-bold text-white mb-2 text-2xl">Q¢ Market Intelligence</h2>
                <p className="text-gray-300 text-base">Real-time insights across all major protocols</p>
              </div>
            </div>
          </div>
        </div>

        {/* Full Width Carousel Below */}
        <div className="mt-6">
          <Carousel 
            opts={{
              align: "start",
              loop: true,
              dragFree: true
            }} 
            plugins={[WheelGesturesPlugin()]}
            className="w-full"
          >
            <CarouselContent className="-ml-2">
              {thumbnailContent.map(item => <CarouselItem key={item.id} className="pl-2 basis-[43%] md:basis-1/3 lg:basis-1/4">
                  <div className="relative rounded-lg overflow-hidden group cursor-pointer bg-card/50 backdrop-blur-sm border border-border/30 hover:border-cyan-500/50 transition-all">
                    <div className="aspect-video relative">
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      {item.badge && <div className="absolute top-2 left-2">
                          <span className={`px-2 py-1 rounded text-xs ${item.badge === 'HOT' ? 'bg-orange-500/20 border border-orange-500 text-orange-400' : item.badge === 'LIVE' ? 'bg-cyan-500/20 border border-cyan-500 text-cyan-400' : item.badge === 'NEW' ? 'bg-green-500/20 border border-green-500 text-green-400' : 'bg-yellow-500/20 border border-yellow-500 text-yellow-400'}`}>
                            {item.badge}
                          </span>
                        </div>}
                    </div>
                    <div className="p-3">
                      <h4 className="text-sm font-semibold text-foreground mb-1">{item.title}</h4>
                      <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                    </div>
                  </div>
                </CarouselItem>)}
            </CarouselContent>
            <CarouselPrevious className="left-2" />
            <CarouselNext className="right-2" />
          </Carousel>
        </div>
      </div>
    </DrawerLayer>;
}
