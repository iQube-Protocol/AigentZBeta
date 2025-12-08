import { Lock, Crown } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselApi } from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import { useCodex } from "@agentiq/codex";

export function LatestNewsCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const { currentCodex } = useCodex();
  
  // Get latest-news content from CodexQube
  const homeDomain = currentCodex?.domains.find(d => d.domainId === 'home');
  const newsItems = homeDomain?.sections
    ?.filter(s => {
      const section = (s as any).placement?.section;
      return section === 'latest-news';
    })
    .sort((a, b) => {
      const posA = (a as any).placement?.position || 0;
      const posB = (b as any).placement?.position || 0;
      return posA - posB;
    })
    .map(section => ({
      id: section.contentId,
      title: section.title,
      description: section.excerpt || '',
      image: section.media?.thumbnail || section.media?.hero || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop',
      badge: 'NEWS',
      isPremium: false
    })) || [];
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
            {newsItems.map((item) => (
              <CarouselItem key={item.id} className="pl-4 md:basis-1/2 lg:basis-1/3">
                <div className={`bg-[#020b18] border rounded-lg overflow-hidden transition-colors ${
                  item.isPremium ? 'border-amber-500/30 hover:border-amber-500/50' : 'border-[#1e2b40] hover:border-cyan-500/30'
                }`}>
                  {item.isPremium && (
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                      <Crown className="h-4 w-4 text-amber-400" />
                      <Badge variant="default" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        Premium
                      </Badge>
                    </div>
                  )}
                  <div className="relative">
                    <img 
                      src={item.image} 
                      alt={item.title} 
                      className={`w-full h-48 object-cover ${item.isPremium ? 'opacity-60' : ''}`} 
                    />
                    {item.isPremium && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Lock className="h-12 w-12 text-amber-400" />
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <Badge variant="default" className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 mb-2">
                      {item.badge}
                    </Badge>
                    <h3 className={`text-xl font-semibold mb-2 ${
                      item.isPremium ? 'text-amber-400' : 'text-[#d0f6ff]'
                    }`}>
                      {item.title}
                    </h3>
                    <p className="text-[#8fb3c0] text-sm mb-4">
                      {item.description}
                    </p>
                    <button className={`text-sm transition-colors ${
                      item.isPremium 
                        ? 'text-amber-400 hover:text-amber-300 font-semibold' 
                        : 'text-cyan-400 hover:text-cyan-300'
                    }`}>
                      {item.isPremium ? 'Unlock with QCT →' : 'Explore →'}
                    </button>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </div>;
}