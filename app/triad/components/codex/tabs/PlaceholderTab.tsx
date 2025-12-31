/**
 * PlaceholderTab Component
 * 
 * Generic placeholder for tabs that are not yet implemented
 */

"use client";

import React from "react";
import { Construction } from "lucide-react";

interface PlaceholderTabProps {
  title?: string;
  description?: string;
  theme?: 'light' | 'dark';
}

export function PlaceholderTab({ title = "Coming Soon", description, theme = 'dark' }: PlaceholderTabProps) {
  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto text-center space-y-4">
        <Construction className="w-16 h-16 mx-auto text-indigo-400" />
        <h3 className="text-2xl font-bold">{title}</h3>
        {description && (
          <p className="text-slate-400">{description}</p>
        )}
        <p className="text-sm text-slate-500">
          This tab is under construction and will be available soon.
        </p>
      </div>
    </div>
  );
}
