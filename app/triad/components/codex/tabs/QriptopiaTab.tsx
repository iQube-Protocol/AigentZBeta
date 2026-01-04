/**
 * QriptopiaTab Component
 * 
 * Displays the vision of Qriptopia - the unified future
 */

"use client";

import React from "react";
import { Sparkles, Zap, Globe, Heart } from "lucide-react";

interface QriptopiaTabProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
}

export function QriptopiaTab({ theme = 'dark', density = 'wide' }: QriptopiaTabProps) {
  return (
    <div className="p-4 space-y-6">
      <h3 className="text-lg font-semibold">The Vision of Qriptopia</h3>
      <div className="bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-indigo-900/20 rounded-lg p-8 border border-purple-700/50">
        <Sparkles className="w-16 h-16 text-purple-400 mb-6 mx-auto" />
        <h4 className="text-2xl font-bold mb-4 text-center">A World United</h4>
        <p className="text-slate-300 text-center mb-6">
          Qriptopia represents the ultimate vision: a world where digital and physical realms
          exist in perfect harmony, where value flows freely, and knowledge is shared universally.
        </p>
        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="text-center">
            <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <div className="text-sm font-semibold">Innovation</div>
          </div>
          <div className="text-center">
            <Globe className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <div className="text-sm font-semibold">Unity</div>
          </div>
          <div className="text-center">
            <Heart className="w-8 h-8 text-pink-400 mx-auto mb-2" />
            <div className="text-sm font-semibold">Community</div>
          </div>
        </div>
      </div>
    </div>
  );
}
