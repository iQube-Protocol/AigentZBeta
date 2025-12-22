/**
 * ScrollsDrawer - Chronicles from the Quantum-Ready Internet
 * Published Issue #0 v0.1
 * 
 * Tabs: metaKnyts, The SynthSims
 * Subtitle: "Chronicles from the Quantum-Ready Internet"
 * Features: Large carousel cards, pagination dots, media controls
 * 
 * NOTE: KNYT Codex has been moved to its own Codex drawer
 * NOTE: Read modality articles will require ArticleReader primitive (TBD)
 */

import { useState } from "react";
import { DrawerLayer } from "@agentiq/smarttriad";
import { useLiquidUIContent } from "@/hooks/useLiquidUIContent";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import { SmartContentActions, type ContentModalities } from "@/components/content/SmartContentActions";
import { useSmartContentAction } from "@/contexts/SmartContentActionContext";

interface ScrollsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScrollsDrawer({ isOpen, onClose }: ScrollsDrawerProps) {
  const [activeTab, setActiveTab] = useState('metaknyts');
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Use global SmartContent action handler
  const { createHandler } = useSmartContentAction();
  
  // Get scrolls content from Liquid UI Issue Package v1.4
  const { content: metaknytsContent } = useLiquidUIContent('scrolls', 'metaknyts');
  const { content: synthsimsContent } = useLiquidUIContent('scrolls', 'synthsims');
  
  // Transform Liquid UI content to component format
  const scrollsContent = [...metaknytsContent, ...synthsimsContent].map(item => ({
    id: item.id,
    title: item.title,
    description: item.excerpt || '',
    image: item.image || 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&h=600&fit=crop',
    badge: item.badge || 'SCROLLS',
    // Map 'SYNTHSIMS' badge (from memes tab) to synthsims tab in UI
    tab: item.badge === 'METAKNYTS' ? 'metaknyts' : 'synthsims',
    position: item.position,
    modalities: item.modalities || {},
  }));

  const tabs = [
    { id: 'metaknyts', label: 'metaKnyts' },
    { id: 'synthsims', label: 'The SynthSims' },
  ];

  // Filter content by active tab and sort by position
  const filteredContent = scrollsContent
    .filter(item => item.tab === activeTab)
    .sort((a, b) => a.position - b.position);
  
  // Use filtered Liquid UI content
  const currentContent = filteredContent;

  // Reset selected index when tab changes
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSelectedIndex(0);
  };


  return (
    <DrawerLayer
      isOpen={isOpen}
      onClose={onClose}
      title="Scrolls"
      subtitle="Chronicles from the Quantum-Ready Internet"
      columns={2}
      tabs={tabs}
      activeTabId={activeTab}
      onTabChange={handleTabChange}
    >
      {/* metaKnyts / SynthSims Content */}
      {(activeTab === 'metaknyts' || activeTab === 'synthsims') && (
      <div className="col-span-2 h-full flex flex-col">
        {/* Show message if no content */}
        {currentContent.length === 0 && (
          <div className="flex items-center justify-center h-64">
            <p className="text-white/50">No content for {activeTab} tab</p>
          </div>
        )}
        
        {/* Featured Large Cards Carousel (2/row) - synced with thumbnail selection */}
        {currentContent.length > 0 && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Show selected item and next item (or wrap around) */}
          {[0, 1].map((offset) => {
            const idx = (selectedIndex + offset) % currentContent.length;
            const item = currentContent[idx];
            return (
              <div key={item.id} className="group relative aspect-video overflow-hidden rounded-lg bg-black">
                <img
                  src={item.image}
                  alt={item.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                {/* SmartContentActions overlay */}
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <SmartContentActions
                    modalities={item.modalities as ContentModalities || null}
                    context="card"
                    showExpand={false}
                    showShare={true}
                    onAction={createHandler(item)}
                    size="md"
                  />
                </div>
              </div>
            );
          })}
        </div>
        )}
        
        {/* Thumbnail Carousel - carousel4: Narrow Thumbnails (4/row) */}
        {currentContent.length > 0 && (
        <div className="mt-auto">
          <Carousel
            opts={{ align: "start", loop: true }}
            plugins={[WheelGesturesPlugin()]}
            className="w-full"
          >
            <CarouselContent className="-ml-2">
              {currentContent.map((item, index) => (
                <CarouselItem key={item.id} className="pl-2 basis-1/4">
                  <div
                    onClick={() => setSelectedIndex(index)}
                    className={`group relative aspect-video w-full overflow-hidden rounded-md bg-black cursor-pointer transition-all ${
                      selectedIndex === index ? 'ring-2 ring-cyan-400' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={item.image}
                      alt={item.title}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    {/* SmartContentActions on thumbnails */}
                    <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <SmartContentActions
                        modalities={item.modalities as ContentModalities || null}
                        context="thumbnail"
                        showExpand={true}
                        showShare={false}
                        onAction={(action) => {
                          // Expand is handled locally for carousel selection
                          if (action === 'expand') {
                            setSelectedIndex(index);
                          } else {
                            // All other actions use global handler
                            createHandler(item)(action);
                          }
                        }}
                        size="sm"
                      />
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </div>
        )}
      </div>
      )}

      {/* VideoModal and ArticleReader are now handled globally by SmartContentActionProvider */}
    </DrawerLayer>
  );
}
