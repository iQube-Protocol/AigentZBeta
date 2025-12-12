import { Lock, Crown } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselApi } from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
export function LatestNewsCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  useEffect(() => {
    if (!api) return;
    const updateButtons = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };
    updateButtons();
    api.on("select", updateButtons);
    api.on("reInit", updateButtons);
    return () => {
      api.off("select", updateButtons);
      api.off("reInit", updateButtons);
    };
  }, [api]);
  const scrollPrev = () => api?.scrollPrev();
  const scrollNext = () => api?.scrollNext();
  return <div className="w-full bg-[#071327] py-12 px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 px-12">
          <h2 className="text-[#d0f6ff] text-2xl font-medium text-left px-0 mx-0">Latest News</h2>
          <div className="flex items-center gap-4">
            <button onClick={scrollPrev} disabled={!canScrollPrev} className="p-2 rounded-full bg-[#020b18]/80 border border-[#1e2b40] text-cyan-400 hover:bg-[#020b18] hover:text-cyan-300 hover:border-cyan-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button onClick={scrollNext} disabled={!canScrollNext} className="p-2 rounded-full bg-[#020b18]/80 border border-[#1e2b40] text-cyan-400 hover:bg-[#020b18] hover:text-cyan-300 hover:border-cyan-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
        <Carousel 
          setApi={setApi} 
          className="w-full" 
          opts={{
            align: "start",
            loop: true
          }}
          plugins={[WheelGesturesPlugin()]}
        >
          <CarouselContent className="-ml-4">
            <CarouselItem className="pl-4 md:basis-1/2 lg:basis-1/3">
              <div className="bg-[#020b18] border border-[#1e2b40] rounded-lg overflow-hidden hover:border-cyan-500/30 transition-colors">
                <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop" alt="Mythos: The Awakening" className="w-full h-48 object-cover" />
                <div className="p-6">
                  <Badge variant="default" className="bg-purple-500/20 text-purple-400 border-purple-500/30 mb-2">
                    COMIC
                  </Badge>
                  <h3 className="text-xl font-semibold text-[#d0f6ff] mb-2">Mythos: The Awakening</h3>
                  <p className="text-[#8fb3c0] text-sm mb-4">
                    Chapter 1 - The quantum realm opens, and the first agents emerge
                  </p>
                  <button className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors">
                    Explore →
                  </button>
                </div>
              </div>
            </CarouselItem>

            <CarouselItem className="pl-4 md:basis-1/2 lg:basis-1/3">
              <div className="bg-[#020b18] border border-[#1e2b40] rounded-lg overflow-hidden hover:border-cyan-500/30 transition-colors">
                <img src="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400&h=300&fit=crop" alt="Chronicles of the Quantum Realm" className="w-full h-48 object-cover" />
                <div className="p-6">
                  <Badge variant="default" className="bg-purple-500/20 text-purple-400 border-purple-500/30 mb-2">
                    STORY
                  </Badge>
                  <h3 className="text-xl font-semibold text-[#d0f6ff] mb-2">Chronicles of the Quantum Realm</h3>
                  <p className="text-[#8fb3c0] text-sm mb-4">
                    Tales from the digital frontier where data becomes legend
                  </p>
                  <button className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors">
                    Explore →
                  </button>
                </div>
              </div>
            </CarouselItem>

            <CarouselItem className="pl-4 md:basis-1/2 lg:basis-1/3">
              <div className="bg-[#020b18] border border-[#1e2b40] rounded-lg overflow-hidden hover:border-cyan-500/30 transition-colors">
                <img src="https://images.unsplash.com/photo-1622186477895-f2af6a0f5a97?w=400&h=300&fit=crop" alt="City Dispatches" className="w-full h-48 object-cover" />
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-[#d0f6ff] mb-2">City Dispatches</h3>
                  <p className="text-[#8fb3c0] text-sm mb-4">
                    Updates and stories from quantum-ready urban centers
                  </p>
                  <button className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors">
                    Explore →
                  </button>
                </div>
              </div>
            </CarouselItem>

            <CarouselItem className="pl-4 md:basis-1/2 lg:basis-1/3">
              <div className="bg-[#020b18] border border-[#1e2b40] rounded-lg overflow-hidden hover:border-cyan-500/30 transition-colors">
                <img src="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=300&fit=crop" alt="Markets Watch" className="w-full h-48 object-cover" />
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-[#d0f6ff] mb-2">Markets Watch</h3>
                  <p className="text-[#8fb3c0] text-sm mb-4">
                    Tracking trends in crypto, quantum tech, and emerging markets
                  </p>
                  <button className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors">
                    Explore →
                  </button>
                </div>
              </div>
            </CarouselItem>

            <CarouselItem className="pl-4 md:basis-1/2 lg:basis-1/3">
              <div className="relative bg-[#020b18] border border-amber-500/30 rounded-lg overflow-hidden hover:border-amber-500/50 transition-colors">
                <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-400" />
                  <Badge variant="default" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                    Premium
                  </Badge>
                </div>
                <div className="relative">
                  <img src="https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop" alt="Quantum Trading" className="w-full h-48 object-cover opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Lock className="h-12 w-12 text-amber-400" />
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-amber-400 mb-2">Quantum Trading Algorithms</h3>
                  <p className="text-[#8fb3c0] text-sm mb-4">
                    Advanced strategies using quantum computing for market predictions
                  </p>
                  <button className="text-amber-400 text-sm hover:text-amber-300 transition-colors font-semibold">
                    Unlock with 100 QCT →
                  </button>
                </div>
              </div>
            </CarouselItem>

            <CarouselItem className="pl-4 md:basis-1/2 lg:basis-1/3">
              <div className="bg-[#020b18] border border-[#1e2b40] rounded-lg overflow-hidden hover:border-cyan-500/30 transition-colors">
                <img src="https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=300&fit=crop" alt="AI & Machine Learning" className="w-full h-48 object-cover" />
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-[#d0f6ff] mb-2">AI & Machine Learning</h3>
                  <p className="text-[#8fb3c0] text-sm mb-4">
                    Breakthroughs in artificial intelligence and neural networks
                  </p>
                  <button className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors">
                    Explore →
                  </button>
                </div>
              </div>
            </CarouselItem>

            <CarouselItem className="pl-4 md:basis-1/2 lg:basis-1/3">
              <div className="relative bg-[#020b18] border border-amber-500/30 rounded-lg overflow-hidden hover:border-amber-500/50 transition-colors">
                <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-400" />
                  <Badge variant="default" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                    Premium
                  </Badge>
                </div>
                <div className="relative">
                  <img src="https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=400&h=300&fit=crop" alt="DeFi Strategies" className="w-full h-48 object-cover opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Lock className="h-12 w-12 text-amber-400" />
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-amber-400 mb-2">Advanced DeFi Strategies</h3>
                  <p className="text-[#8fb3c0] text-sm mb-4">
                    Exclusive insights into yield farming and liquidity pool optimization
                  </p>
                  <button className="text-amber-400 text-sm hover:text-amber-300 transition-colors font-semibold">
                    Unlock with 150 QCT →
                  </button>
                </div>
              </div>
            </CarouselItem>

            <CarouselItem className="pl-4 md:basis-1/2 lg:basis-1/3">
              <div className="bg-[#020b18] border border-[#1e2b40] rounded-lg overflow-hidden hover:border-cyan-500/30 transition-colors">
                <img src="https://images.unsplash.com/photo-1639762681057-408e52192e55?w=400&h=300&fit=crop" alt="Cybersecurity" className="w-full h-48 object-cover" />
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-[#d0f6ff] mb-2">Cybersecurity Updates</h3>
                  <p className="text-[#8fb3c0] text-sm mb-4">
                    Quantum-resistant encryption and security protocols
                  </p>
                  <button className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors">
                    Explore →
                  </button>
                </div>
              </div>
            </CarouselItem>
          </CarouselContent>
        </Carousel>
      </div>
    </div>;
}