/**
 * CharactersTab Component
 * 
 * Displays character profiles and bios
 */

"use client";

import React from "react";
import { Users, Shield, Zap } from "lucide-react";

interface CharactersTabProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
}

const MOCK_CHARACTERS = [
  { id: '1', name: 'Nakamoto', role: 'Founder', faction: 'Order', avatar: '🧙‍♂️' },
  { id: '2', name: 'KNOW1', role: 'Guardian', faction: 'Order', avatar: '🛡️' },
  { id: '3', name: 'MoneyPenny', role: 'Chronicler', faction: 'Order', avatar: '📜' },
  { id: '4', name: 'Aigent Z', role: 'Architect', faction: 'Order', avatar: '⚡' },
];

export function CharactersTab({ theme = 'dark', density = 'wide' }: CharactersTabProps) {
  return (
    <div className="p-4 space-y-6">
      <h3 className="text-lg font-semibold">Characters</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MOCK_CHARACTERS.map((char) => (
          <div key={char.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 hover:border-indigo-500/50 transition-colors">
            <div className="flex items-start gap-4">
              <div className="text-4xl">{char.avatar}</div>
              <div className="flex-1">
                <h4 className="font-semibold">{char.name}</h4>
                <p className="text-sm text-slate-400">{char.role}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Shield className="w-3 h-3 text-indigo-400" />
                  <span className="text-xs text-indigo-300">{char.faction}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
