import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DrawerLayerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  columns?: 1 | 2 | 3;
  tabs?: { id: string; label: string }[];
  children: React.ReactNode;
}

export function DrawerLayer({ isOpen, onClose, title, subtitle, columns = 2, tabs, children }: DrawerLayerProps) {
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.id || '');

  if (!isOpen) return null;

  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer - slides from right, positioned between screen edge and nav */}
      <div className={`fixed inset-0 bg-background/95 backdrop-blur-xl md:right-[80px] md:top-[88px] md:left-auto md:h-[calc(100vh-88px)] md:w-[calc(100vw-160px)] md:bg-background/80 md:border-l md:border-border/30 shadow-[0_0_60px_rgba(0,0,0,0.5)] z-50 overflow-hidden flex flex-col transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border/30 bg-background/60 backdrop-blur-sm">
          <div className="p-4 md:p-6 flex items-center justify-between gap-4">
            <div className="flex-shrink-0">
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1">{title}</h2>
              {subtitle && <p className="hidden md:block text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            
            <div className="flex items-center gap-6">
              {/* Tabs */}
              {tabs && tabs.length > 0 && (
                <div className="flex gap-2">
                  {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${
                      activeTab === tab.id
                        ? 'text-primary border-primary'
                        : 'text-muted-foreground border-transparent hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                  ))}
                </div>
              )}
              
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent/50 ml-4"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content with column support */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className={`grid ${columnClasses[columns]} gap-4 md:gap-6`}>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
