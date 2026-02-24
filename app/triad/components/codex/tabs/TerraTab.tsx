/**
 * TerraTab Component
 * 
 * Displays physical world locations and territories
 */

"use client";

import React from "react";
import { Mountain, Globe } from "lucide-react";

interface TerraTabProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
}

export function TerraTab({ theme = 'dark', density = 'wide' }: TerraTabProps) {
  return (
    <div className="p-4 space-y-6">
      <h3 className="text-lg font-semibold">Terra Locations</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 rounded-lg p-6 border border-green-700/50">
          <Mountain className="w-8 h-8 text-green-400 mb-4" />
          <h4 className="text-lg font-bold mb-2">The Highlands</h4>
          <p className="text-sm text-slate-300">Ancient mountains where the Order was founded</p>
        </div>
        <div className="bg-gradient-to-br from-blue-900/20 to-teal-900/20 rounded-lg p-6 border border-blue-700/50">
          <Globe className="w-8 h-8 text-blue-400 mb-4" />
          <h4 className="text-lg font-bold mb-2">The Coastal Cities</h4>
          <p className="text-sm text-slate-300">Bustling hubs of trade and innovation</p>
        </div>
      </div>
    </div>
  );
}
