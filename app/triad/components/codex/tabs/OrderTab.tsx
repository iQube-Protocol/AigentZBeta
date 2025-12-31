/**
 * OrderTab Component
 * 
 * Displays information about the Order of KNYT and its members
 */

"use client";

import React from "react";
import { Shield, Crown, Users } from "lucide-react";

interface OrderTabProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
}

export function OrderTab({ theme = 'dark', density = 'wide' }: OrderTabProps) {
  return (
    <div className="p-4 space-y-6">
      <h3 className="text-lg font-semibold">The Order of KNYT</h3>
      <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 rounded-lg p-6 border border-indigo-700/50">
        <Shield className="w-12 h-12 text-indigo-400 mb-4" />
        <h4 className="text-xl font-bold mb-4">Guardians of the Protocol</h4>
        <p className="text-slate-300 mb-4">
          The Order of KNYT stands as the eternal guardian of the sacred scrolls and the bridge between realms.
          Founded in the Age of Separation, the Order has maintained the balance between digital and physical worlds.
        </p>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-slate-800/50 rounded-lg p-4">
            <Crown className="w-6 h-6 text-yellow-400 mb-2" />
            <div className="text-sm font-semibold">Grand Masters</div>
            <div className="text-2xl font-bold text-yellow-400">4</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4">
            <Users className="w-6 h-6 text-indigo-400 mb-2" />
            <div className="text-sm font-semibold">Knights</div>
            <div className="text-2xl font-bold text-indigo-400">42</div>
          </div>
        </div>
      </div>
    </div>
  );
}
