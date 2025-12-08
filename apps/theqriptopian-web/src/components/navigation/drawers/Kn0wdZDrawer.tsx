/**
 * Kn0wdZDrawer - Knowledge Resources
 * Published Issue #0 v0.1
 * 
 * Tabs: Dev, Creative, Exec
 * Subtitles vary per tab:
 * - Dev: "Builder & Developer Knowledge - How It Works"
 * - Creative: "Creative Storytelling & Visual Content"
 * - Exec: "Impact Imperatives & Business Development - Strategic Insights"
 * 
 * Features: Feature viewer, content grid, Exec special panels
 * NOTE: Read modality articles will require ArticleReader primitive (TBD)
 */

import { useState } from "react";
import { DrawerLayer } from "@agentiq/smarttriad";
import { useCodex } from "@agentiq/codex";
import { Kn0w1Viewer } from "@/components/content/Kn0w1Viewer";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import { Terminal, Palette, Building2, TrendingUp } from "lucide-react";

interface Kn0wdZDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Dev content - technical tutorials and guides
const devContent = [
  {
    id: '1',
    title: 'Building with iQubes',
    description: 'Developer guide to iQube protocol',
    image: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=600&fit=crop',
    badge: 'DEV',
  },
  {
    id: '2',
    title: 'Smart Contract Patterns',
    description: 'Best practices for quantum-safe contracts',
    image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=600&fit=crop',
    badge: 'CODE',
  },
  {
    id: '3',
    title: 'Agent Integration Guide',
    description: 'Connect your app to AgentiQ',
    image: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=800&h=600&fit=crop',
    badge: 'API',
  },
];

// Creative content - storytelling and visual design
const creativeContent = [
  {
    id: '1',
    title: 'Visual Narratives',
    description: 'Crafting compelling stories with Q¢',
    image: 'https://images.unsplash.com/photo-1561998338-13ad7883b20f?w=800&h=600&fit=crop',
    badge: 'DESIGN',
  },
  {
    id: '2',
    title: 'Brand Building in Web3',
    description: 'Identity and design for quantum apps',
    image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=600&fit=crop',
    badge: 'BRAND',
  },
];

// Exec content - business strategy and growth
const execContent = [
  {
    id: '1',
    title: 'Strategic Impact',
    description: 'Business models for quantum economy',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=600&fit=crop',
    badge: 'STRATEGY',
  },
  {
    id: '2',
    title: 'Market Opportunities',
    description: 'Growth sectors in Q¢ ecosystem',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop',
    badge: 'GROWTH',
  },
];

export function Kn0wdZDrawer({ isOpen, onClose }: Kn0wdZDrawerProps) {
  const [activeTab, setActiveTab] = useState('dev');
  const { currentCodex } = useCodex();
  
  // Get live content from CodexQube
  const kn0wdZDomain = currentCodex?.domains.find(d => d.domainId === 'kn0wdz');
  const kn0wdZContent = kn0wdZDomain?.sections?.map(section => ({
    id: section.contentId,
    title: section.title,
    description: section.excerpt || '',
    image: section.media?.thumbnail || section.media?.hero || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&h=600&fit=crop',
    badge: 'KNOW',
  })) || [];

  const tabs = [
    { id: 'dev', label: 'Dev' },
    { id: 'creative', label: 'Creative' },
    { id: 'exec', label: 'Exec' },
  ];

  const subtitles = {
    dev: 'Builder & Developer Knowledge - How It Works',
    creative: 'Creative Storytelling & Visual Content',
    exec: 'Impact Imperatives & Business Development - Strategic Insights',
  };

  const currentContent = kn0wdZContent;

  return (
    <DrawerLayer
      isOpen={isOpen}
      onClose={onClose}
      title="Kn0wdZ"
      subtitle={subtitles[activeTab as keyof typeof subtitles]}
      columns={3}
      tabs={tabs}
    >
      <div className="col-span-3 h-full flex flex-col">
        {/* Main Content Grid */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature Viewer - Desktop: 1 col, Mobile: full width */}
          <div className="md:col-span-1">
            <Kn0w1Viewer
              items={currentContent.slice(0, 1)}
              domain="kn0wdz"
              hideActionIcons={false}
            />
          </div>

          {/* Content Grid - Desktop: 2 cols, Mobile: full width */}
          <div className="md:col-span-2 space-y-6">
            {/* Exec Tab Special Panels */}
            {activeTab === 'exec' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-6 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <Building2 className="h-6 w-6 text-orange-400" />
                    <h3 className="font-semibold text-foreground">
                      Strategic Impact & Business Development
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Navigate market opportunities and build sustainable growth strategies in the quantum economy.
                  </p>
                </div>

                <div className="p-6 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <TrendingUp className="h-6 w-6 text-orange-400" />
                    <h3 className="font-semibold text-foreground">
                      Focus Areas
                    </h3>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Market positioning</li>
                    <li>• Partnership strategies</li>
                    <li>• Revenue models</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Thumbnail Grid */}
            <div className="grid grid-cols-2 gap-4">
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
                      <span className={`px-2 py-1 backdrop-blur-sm text-white text-xs font-bold rounded ${
                        activeTab === 'dev' ? 'bg-blue-500/80' :
                        activeTab === 'creative' ? 'bg-purple-500/80' :
                        'bg-orange-500/80'
                      }`}>
                        {item.badge}
                      </span>
                    </div>
                  )}

                  {/* Tab Icon */}
                  <div className="absolute top-2 right-2">
                    {activeTab === 'dev' && <Terminal className="h-4 w-4 text-white/70" />}
                    {activeTab === 'creative' && <Palette className="h-4 w-4 text-white/70" />}
                    {activeTab === 'exec' && <Building2 className="h-4 w-4 text-white/70" />}
                  </div>

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
        </div>

        {/* Desktop Thumbnail Carousel */}
        <div className="hidden md:block mt-6 pt-6 border-t border-border/30">
          <Carousel
            opts={{ align: "start", loop: true }}
            plugins={[WheelGesturesPlugin()]}
            className="w-full"
          >
            <CarouselContent className="-ml-4">
              {currentContent.map((item) => (
                <CarouselItem key={item.id} className="pl-4 basis-1/4">
                  <div className="relative aspect-[47/20] overflow-hidden rounded-lg bg-black">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-1 left-1 right-1">
                      <p className="text-white text-[10px] font-medium line-clamp-1">
                        {item.title}
                      </p>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>

        {/* Mobile Thumbnail Carousel Overlay */}
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
