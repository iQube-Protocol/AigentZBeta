/**
 * EmbedLayout - Minimal layout for embeddable SmartTriad views
 * 
 * No global navbar or footer - just the content with dark theme.
 * Uses h-full w-full min-h-screen so it fills any container (iframe, drawer, etc.)
 * rather than assuming it owns the whole viewport.
 */

import React from 'react';

interface EmbedLayoutProps {
  children: React.ReactNode;
}

export function EmbedLayout({ children }: EmbedLayoutProps) {
  return (
    <div className="h-full w-full min-h-screen bg-[#050816]">
      {children}
    </div>
  );
}
