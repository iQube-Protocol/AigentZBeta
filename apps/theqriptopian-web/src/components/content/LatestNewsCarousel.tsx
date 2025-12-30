import { Lock, Crown, RefreshCw } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselApi } from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import { useLiquidUIContent } from "@/hooks/useLiquidUIContent";
import { SmartContentActions, type ContentModalities } from "@agentiq/smarttriad";
import { useSmartContentAction } from "@/contexts/SmartContentActionContext";

export function LatestNewsCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  
  // Use global SmartContent action handler
  const { createHandler } = useSmartContentAction();
  
  // Get latest-news content from Liquid UI Issue Package v1.4
  const { content: liquidUIContent, refresh, isLoading, lastUpdated } = useLiquidUIContent('latest-news');
  
  // Transform Liquid UI content to component format
  const newsItems = liquidUIContent.map(item => ({
    id: item.id,
    title: item.title,
    description: item.excerpt || '',
    image: item.image || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop',
    badge: item.badge || 'NEWS',
    isPremium: false,
    modalities: item.modalities as ContentModalities || null
  }));
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
  return <div className="w-full bg-[#071327] py-12 px-4">
      <div className="w-full">
        <div className="flex items-center justify-between mb-8 px-4">
          <div className="flex items-center gap-4">
            <h2 className="text-[#d0f6ff] text-2xl font-medium text-left px-0 mx-0">Latest News</h2>
            <button 
              onClick={refresh} 
              disabled={isLoading}
              className="p-2 rounded-full bg-[#020b18]/80 border border-[#1e2b40] text-cyan-400 hover:bg-[#020b18] hover:text-cyan-300 hover:border-cyan-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed" 
              aria-label="Refresh content" 
              title="Refresh content"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {lastUpdated && (
              <span className="text-xs text-gray-400">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={scrollPrev} disabled={!canScrollPrev} className="p-2 rounded-full bg-[#020b18]/80 border border-[#1e2b40] text-cyan-400 hover:bg-[#020b18] hover:text-cyan-300 hover:border-cyan-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Previous" title="Previous">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button onClick={scrollNext} disabled={!canScrollNext} className="p-2 rounded-full bg-[#020b18]/80 border border-[#1e2b40] text-cyan-400 hover:bg-[#020b18] hover:text-cyan-300 hover:border-cyan-500/50 transition-all disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Next" title="Next">
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
              <CarouselItem key={item.id} className="pl-4 basis-[85%] sm:basis-[45%] md:basis-[30%] lg:basis-[30%]">
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
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="default" className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                        {item.badge}
                      </Badge>
                      {/* SmartContentActions - uses global action handler */}
                      <SmartContentActions
                        modalities={item.modalities}
                        context="card"
                        showExpand={false}
                        showShare={true}
                        size="sm"
                        onAction={createHandler({
  ...item,
  section: 'latest-news'
})}
                      />
                    </div>
                    <h3 className={`text-xl font-semibold mb-2 ${
                      item.isPremium ? 'text-amber-400' : 'text-[#d0f6ff]'
                    }`}>
                      {item.title}
                    </h3>
                    <p className="text-[#8fb3c0] text-sm mb-4">
                      {item.description}
                    </p>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        {/* VideoModal and ArticleReader are now handled globally by SmartContentActionProvider */}
      </div>
    </div>;
}