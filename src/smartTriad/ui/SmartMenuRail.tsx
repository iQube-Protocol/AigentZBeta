"use client";

import React, { useState, useEffect } from "react";
import { SmartMenuItem, SmartMenuBehavior } from "./types";

export interface SmartMenuRailProps {
  items: SmartMenuItem[];
  activeItemId?: string;
  behavior: SmartMenuBehavior;
  onSelect: (id: string) => void;
  className?: string;
}

export function SmartMenuRail({
  items,
  activeItemId,
  behavior,
  onSelect,
  className = "",
}: SmartMenuRailProps) {
  const [isExpanded, setIsExpanded] = useState(behavior.mode !== "collapsed-pill");
  const [isVisible, setIsVisible] = useState(behavior.mode !== "auto-hide");
  
  const side = behavior.side || "right";
  const sideClasses = side === "left" ? "left-2 md:left-4" : "right-2 md:right-[2px]";
  
  // Auto-hide logic
  useEffect(() => {
    if (behavior.mode !== "auto-hide") return;
    
    let timeout: NodeJS.Timeout;
    
    const handleActivity = () => {
      setIsVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setIsVisible(false);
      }, behavior.autoHideAfterMs || 3000);
    };
    
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
    };
  }, [behavior.mode, behavior.autoHideAfterMs]);
  
  // Base button classes
  const buttonClass = (isActive: boolean) => `
    relative w-12 h-12 flex items-center justify-center rounded-lg transition-all
    ${isActive ? "bg-cyan-500/20 text-cyan-400" : "text-white/70 hover:text-cyan-400 hover:bg-cyan-500/10"}
  `;
  
  // Collapsed pill mode
  if (behavior.mode === "collapsed-pill" && !isExpanded) {
    return (
      <div
        className={`fixed ${sideClasses} top-1/2 -translate-y-1/2 z-50 ${className}`}
        onMouseEnter={() => setIsExpanded(true)}
      >
        <button className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm border border-cyan-500/30 flex items-center justify-center text-cyan-400 hover:bg-cyan-500/20 transition-all">
          {items[0]?.icon}
        </button>
      </div>
    );
  }
  
  // Auto-hide mode
  if (behavior.mode === "auto-hide" && !isVisible) {
    return null;
  }
  
  // Standard rail layout
  const railClasses = behavior.mode === "floating-rail"
    ? "bg-black/40 backdrop-blur-sm rounded-lg shadow-lg p-1"
    : "";
  
  return (
    <nav
      className={`hidden md:flex fixed ${sideClasses} top-1/2 -translate-y-1/2 w-14 flex-col items-center py-6 z-50 ${className}`}
      onMouseLeave={() => behavior.mode === "collapsed-pill" && setIsExpanded(false)}
    >
      <div className={`flex flex-col gap-2 ${railClasses}`}>
        {items.map((item) => {
          const isActive = item.id === activeItemId;
          
          return (
            <button
              key={item.id}
              onClick={() => !item.disabled && onSelect(item.id)}
              className={buttonClass(isActive)}
              title={item.tooltip || item.label}
              disabled={item.disabled}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <div className="absolute left-0 w-1 h-6 bg-cyan-400 rounded-r" />
              )}
              {item.icon}
              {item.badge && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
