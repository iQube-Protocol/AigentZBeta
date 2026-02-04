/**
 * Kn0wdZDrawer - Knowledge Resources
 * 3-Column Layout: Featured Card | Framework Panel | Resources Panel
 * Bottom: Thumbnail Carousel (4/row)
 */

import { useState } from "react";
import { DrawerLayer } from "@agentiq/smarttriad";
import { useLiquidUIContent } from "@/hooks/useLiquidUIContent";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures";
import { Terminal, Palette, Building2, TrendingUp, BookOpen, Github, MessageCircle, Video, FileText, Users, Layers, Briefcase, BarChart3 } from "lucide-react";
import { SmartContentActions, type ContentModalities } from "@/components/content/SmartContentActions";
import { useSmartContentAction } from "@/contexts/SmartContentActionContext";

interface Kn0wdZDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Tab-specific panel content
const devPanel = {
  title: "Quick Start",
  icon: Terminal,
  color: "cyan",
  content: `// Initialize QIRI SDK
import { QIRI } from '@qriptopian/sdk';

const qiri = new QIRI({
  network: 'mainnet',
  apiKey: process.env.QIRI_KEY
});

// Create a transaction
const tx = await qiri.send({
  to: 'did:qiri:recipient',
  amount: 100, // Q¢
  memo: 'Payment for services'
});`,
  resources: [
    { label: "Documentation", desc: "Full API reference", icon: BookOpen },
    { label: "GitHub Repos", desc: "Open source examples", icon: Github },
    { label: "Discord", desc: "Developer community", icon: MessageCircle },
    { label: "Video Tutorials", desc: "Step-by-step guides", icon: Video },
  ]
};

const creativePanel = {
  title: "Creative Framework",
  icon: Palette,
  color: "purple",
  description: "Build compelling narratives that resonate with your audience through our mythos storytelling framework.",
  structure: ["Establish world & characters", "Define central conflict", "Build tension & stakes", "Resolution & transformation"],
  coreElements: ["Visual Narrative Design"],
  resources: [
    { label: "Style Guide", desc: "Visual standards & templates", icon: FileText },
    { label: "Asset Library", desc: "Logos, characters & props", icon: Layers },
    { label: "Creative Community", desc: "Share & collaborate", icon: Users },
    { label: "Tutorial Series", desc: "Comics, animation & more", icon: Video },
  ]
};

const execPanel = {
  title: "Strategic Impact & Business Development",
  icon: Building2,
  color: "orange",
  description: "Drive measurable impact through iQube infrastructure while building sustainable business models and strategic partnerships.",
  imperatives: ["Impact measurement & reporting frameworks", "Enterprise integration & revenue models", "Operational scaling & efficiency", "Market positioning & ecosystem growth"],
  resources: [
    { label: "Strategic Playbooks", desc: "Business model templates", icon: Briefcase },
    { label: "Partner Portal", desc: "Integration resources", icon: Users },
    { label: "Ops Dashboard", desc: "Metrics & analytics", icon: BarChart3 },
    { label: "Market Intelligence", desc: "Competitive insights", icon: TrendingUp },
  ]
};

export function Kn0wdZDrawer({ isOpen, onClose }: Kn0wdZDrawerProps) {
  const [activeTab, setActiveTab] = useState('dev');
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Use global SmartContent action handler
  const { createHandler } = useSmartContentAction();
  
  // Get 21knowdz content from Liquid UI Issue Package v1.4
  // Using admin portal tab names: 'dev', 'creative', 'exec'
  const { content: devContentLiquid } = useLiquidUIContent('21knowdz', 'dev');
  const { content: creativeContentLiquid } = useLiquidUIContent('21knowdz', 'creative');
  const { content: execContentLiquid } = useLiquidUIContent('21knowdz', 'exec');
  
  // Transform Liquid UI content to component format
  const kn0wdZContent = [...devContentLiquid, ...creativeContentLiquid, ...execContentLiquid].map(item => ({
    id: item.id,
    title: item.title,
    description: item.excerpt || '',
    image: item.image || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800',
    badge: item.badge || 'KNOW',
    tab: item.badge === 'DEV' ? 'dev' : item.badge === 'CREATIVE' ? 'creative' : item.badge === 'EXEC' ? 'exec' : 'dev',
    position: item.position,
    modalities: item.modalities || {},
  }));

  const tabs = [
    { id: 'dev', label: 'Dev' },
    { id: 'creative', label: 'Creative' },
    { id: 'exec', label: 'Exec' },
  ];

  const subtitles: Record<string, string> = {
    dev: 'Builder & Developer Knowledge - How It Works',
    creative: 'Creative Storytelling & Visual Content',
    exec: 'Impact Imperatives & Business Development - Strategic Insights',
  };

  const filteredContent = kn0wdZContent.filter(item => item.tab === activeTab).sort((a, b) => a.position - b.position);
  const currentContent = filteredContent;
  const actionItems = currentContent.map((item) => ({ ...item }));
  const panel = activeTab === 'dev' ? devPanel : activeTab === 'creative' ? creativePanel : execPanel;
  const colorClass = activeTab === 'dev' ? 'cyan' : activeTab === 'creative' ? 'purple' : 'orange';

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSelectedIndex(0);
  };

  return (
    <DrawerLayer
      isOpen={isOpen}
      onClose={onClose}
      title="Kn0wdZ"
      subtitle={subtitles[activeTab]}
      columns={3}
      tabs={tabs}
      activeTabId={activeTab}
      onTabChange={handleTabChange}
      className="md:right-16 md:top-[88px] md:bottom-auto md:h-[calc(100vh-104px)] md:w-[calc(100vw-80px-64px)]"
    >
      <div className="col-span-3 h-full flex flex-col">
        {/* 3-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 flex-1">
          {/* Col 1: Featured */}
          {currentContent.length > 0 && (
          <div className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-black">
            <img src={currentContent[selectedIndex]?.image} alt={currentContent[selectedIndex]?.title} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute top-2 right-2">
              <SmartContentActions
                modalities={currentContent[selectedIndex]?.modalities as ContentModalities || null}
                context="card"
                showExpand={false}
                showShare={true}
                size="sm"
                onAction={currentContent[selectedIndex] ? createHandler(currentContent[selectedIndex], actionItems) : () => {}}
              />
            </div>
            <div className="absolute bottom-3 left-3 right-3"><p className="text-white text-base font-medium line-clamp-2">{currentContent[selectedIndex]?.title}</p></div>
          </div>
          )}

          {/* Col 2: Framework Panel */}
          <div className={`p-4 bg-${colorClass}-500/10 border border-${colorClass}-500/30 rounded-lg`}>
            <div className="flex items-center gap-2 mb-3">
              <panel.icon className={`h-5 w-5 text-${colorClass}-400`} />
              <h3 className="font-semibold text-white">{panel.title}</h3>
            </div>
            {activeTab === 'dev' && <pre className="text-xs text-cyan-300 bg-black/50 p-3 rounded overflow-auto max-h-48 font-mono">{devPanel.content}</pre>}
            {activeTab === 'creative' && (
              <>
                <p className="text-sm text-muted-foreground mb-3">{creativePanel.description}</p>
                <div className="bg-black/30 p-3 rounded mb-3">
                  <h4 className="text-xs font-semibold text-white mb-2">Story Structure</h4>
                  {creativePanel.structure.map((s, i) => <p key={i} className="text-xs text-muted-foreground">{i+1}. {s}</p>)}
                </div>
                <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-purple-400" /><span className="text-sm text-white">Core Elements</span></div>
                <p className="text-xs text-muted-foreground ml-6">▸ {creativePanel.coreElements[0]}</p>
              </>
            )}
            {activeTab === 'exec' && (
              <>
                <p className="text-sm text-muted-foreground mb-3">{execPanel.description}</p>
                <div className="bg-black/30 p-3 rounded mb-3">
                  <h4 className="text-xs font-semibold text-white mb-2">Key Imperatives</h4>
                  {execPanel.imperatives.map((s, i) => <p key={i} className="text-xs text-muted-foreground">• {s}</p>)}
                </div>
                <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-orange-400" /><span className="text-sm text-white">Focus Areas</span></div>
              </>
            )}
          </div>

          {/* Col 3: Resources */}
          <div className="p-4 bg-gray-900/50 border border-gray-700/50 rounded-lg">
            <div className="flex items-center gap-2 mb-3"><Layers className="h-5 w-5 text-cyan-400" /><h3 className="font-semibold text-white">Resources</h3></div>
            <div className="space-y-2">
              {panel.resources.map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-white/5 cursor-pointer transition-colors">
                  <r.icon className="h-4 w-4 text-muted-foreground" />
                  <div><p className="text-sm text-white">{r.label}</p><p className="text-xs text-muted-foreground">{r.desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Thumbnail Carousel */}
        {currentContent.length > 0 && (
        <Carousel opts={{ align: "start", loop: true, dragFree: true }} plugins={[WheelGesturesPlugin()]} className="w-full">
          <CarouselContent className="-ml-2">
            {currentContent.map((item, index) => (
              <CarouselItem key={item.id} className="pl-2 basis-[43%] md:basis-1/3 lg:basis-1/4">
                <div onClick={() => setSelectedIndex(index)} className={`group relative aspect-video w-full overflow-hidden rounded-md bg-black cursor-pointer transition-all ${selectedIndex === index ? 'ring-2 ring-cyan-400' : 'opacity-70 hover:opacity-100'}`}>
                  <img src={item.image} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute bottom-1 left-1 right-1"><p className="text-white text-[11px] font-medium line-clamp-1">{item.title}</p></div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
        )}
      </div>

      {/* VideoModal and ArticleReader are now handled globally by SmartContentActionProvider */}
    </DrawerLayer>
  );
}
