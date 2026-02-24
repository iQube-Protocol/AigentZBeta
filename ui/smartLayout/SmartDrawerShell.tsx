"use client";

import React from "react";
import { X } from "lucide-react";
import { DrawerSize } from "./types";
import { getDrawerClasses } from "./drawerStyles";

export interface SmartDrawerShellProps {
  isOpen: boolean;
  size: DrawerSize;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
  headerActions?: React.ReactNode;
  heroSlot?: React.ReactNode;
  feedSlot?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SmartDrawerShell({
  isOpen,
  size,
  onClose,
  title,
  subtitle,
  showHeader = true,
  headerActions,
  heroSlot,
  feedSlot,
  children,
  className = "",
}: SmartDrawerShellProps) {
  if (!isOpen) return null;
  
  const isModalCentered = size === "modal-centered";
  const isImmersive3q = size === "immersive-3q";
  const isFullImmersive = size === "full-immersive";
  
  const drawerContent = (
    <>
      {showHeader && (title || onClose) && (
        <div className="flex-shrink-0 border-b border-border/30 bg-background/60 backdrop-blur-sm px-4 md:px-6 py-4 md:py-6">
          <div className="flex items-start justify-between">
            <div>
              {title && <h2 id="drawer-title" className="text-xl md:text-2xl font-bold">{title}</h2>}
              {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
              {headerActions}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {isImmersive3q && heroSlot ? (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex-shrink-0 min-h-[60vh] relative">{heroSlot}</div>
          <div className="flex-1 overflow-y-auto p-4 md:p-6">{feedSlot || children}</div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
      )}
    </>
  );
  
  return (
    <>
      {!isFullImmersive && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}
      
      <div className={`${getDrawerClasses(size)} ${className}`}>
        {isModalCentered ? (
          <div className="bg-background/95 backdrop-blur-xl rounded-2xl border border-border/30 shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
            {drawerContent}
          </div>
        ) : (
          drawerContent
        )}
      </div>
    </>
  );
}
