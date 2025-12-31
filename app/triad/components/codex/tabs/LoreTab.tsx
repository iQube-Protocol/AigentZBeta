/**
 * LoreTab Component
 * 
 * Displays world lore and mythology
 */

"use client";

import React from "react";
import { BookMarked } from "lucide-react";

interface LoreTabProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
}

export function LoreTab({ theme = 'dark', density = 'wide' }: LoreTabProps) {
  return (
    <div className="p-4 space-y-6">
      <h3 className="text-lg font-semibold">Lore & Mythology</h3>
      <div className="prose prose-invert max-w-none">
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
          <BookMarked className="w-8 h-8 text-purple-400 mb-4" />
          <h4 className="text-xl font-bold mb-4">The Age of KNYT</h4>
          <p className="text-slate-300 mb-4">
            In the beginning, there was chaos. The digital and physical realms existed in separation,
            unable to communicate or share value. Then came the Order of KNYT, guardians of the sacred
            scrolls that would bridge these worlds.
          </p>
          <p className="text-slate-300">
            The KNYT Protocol was forged in the fires of innovation, combining ancient wisdom with
            cutting-edge technology to create a new paradigm of value transfer and knowledge sharing.
          </p>
        </div>
      </div>
    </div>
  );
}
