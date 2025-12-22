/**
 * DrawerLayer - Base drawer component for domain content
 * Extracted from The Qriptopian and genericized for all AgentiQ franchises
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import type { DrawerTab, DrawerColumns } from './types';

export interface DrawerLayerProps {
  /** Whether drawer is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Drawer title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Column layout (1, 2, or 3) */
  columns?: DrawerColumns;
  /** Optional tabs */
  tabs?: DrawerTab[];
  /** Active tab ID (controlled) */
  activeTabId?: string;
  /** Tab change handler */
  onTabChange?: (tabId: string) => void;
  /** Drawer content */
  children: React.ReactNode;
  /** Custom class names */
  className?: string;
}

export function DrawerLayer({
  isOpen,
  onClose,
  title,
  subtitle,
  columns = 2,
  tabs,
  activeTabId,
  onTabChange,
  children,
  className,
}: DrawerLayerProps) {
  const [internalActiveTab, setInternalActiveTab] = useState(tabs?.[0]?.id || '');
  
  // Use controlled state if provided, otherwise use internal state
  const activeTab = activeTabId ?? internalActiveTab;
  const handleTabChange = (tabId: string) => {
    setInternalActiveTab(tabId);
    onTabChange?.(tabId);
  };

  if (!isOpen) return null;

  const columnClasses: Record<DrawerColumns, string> = {
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
        aria-hidden="true"
      />

      {/* Drawer - slides from right, positioned between screen edge and IconBar */}
      <div
        className={clsx(
          'fixed right-[80px] top-[88px] h-[calc(100vh-88px)] w-[calc(100vw-160px)]',
          'bg-background/80 backdrop-blur-xl',
          'border-l border-border/30',
          'shadow-[0_0_60px_rgba(0,0,0,0.5)]',
          'z-50 overflow-hidden flex flex-col',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
          className
        )}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border/30 bg-background/60 backdrop-blur-sm">
          <div className="p-6 flex items-center justify-between gap-4">
            <div className="flex-shrink-0">
              <h2 className="text-2xl font-bold text-foreground mb-1">{title}</h2>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>

            <div className="flex items-center gap-6">
              {/* Tabs */}
              {tabs && tabs.length > 0 && (
                <div className="flex gap-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={clsx(
                        'px-4 py-2 text-sm font-medium transition-all whitespace-nowrap border-b-2',
                        activeTab === tab.id
                          ? 'text-primary border-primary'
                          : 'text-muted-foreground border-transparent hover:text-foreground'
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={onClose}
                aria-label="Close drawer"
                className="flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent/50 ml-4 p-2 rounded-md transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content with column support */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className={`grid ${columnClasses[columns]} gap-6`}>{children}</div>
        </div>
      </div>
    </>
  );
}
