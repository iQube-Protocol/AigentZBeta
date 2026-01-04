/**
 * DigiTerraTab Component
 * 
 * Displays digital realm content and territories
 */

"use client";

import React from "react";
import { Gamepad2, MapPin } from "lucide-react";

interface DigiTerraTabProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
}

export function DigiTerraTab({ theme = 'dark', density = 'wide' }: DigiTerraTabProps) {
  return (
    <div className="p-4 space-y-6">
      <h3 className="text-lg font-semibold">DigiTerra Realms</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 rounded-lg p-6 border border-cyan-700/50">
          <Gamepad2 className="w-8 h-8 text-cyan-400 mb-4" />
          <h4 className="text-lg font-bold mb-2">The Nexus</h4>
          <p className="text-sm text-slate-300">Central hub of digital activity and commerce</p>
        </div>
        <div className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 rounded-lg p-6 border border-purple-700/50">
          <MapPin className="w-8 h-8 text-purple-400 mb-4" />
          <h4 className="text-lg font-bold mb-2">The Void</h4>
          <p className="text-sm text-slate-300">Mysterious realm of untapped potential</p>
        </div>
      </div>
    </div>
  );
}
