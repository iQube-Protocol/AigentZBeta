/**
 * ScrollsTab Component
 * 
 * Displays digital scrolls/comics with rarity and ownership status
 */

"use client";

import React from "react";
import { BookOpen, Lock, Unlock, Play, Eye } from "lucide-react";

interface ScrollsTabProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
}

const MOCK_SCROLLS = [
  {
    id: '1',
    title: 'The Qriptopian Chronicles: Issue #0',
    coverType: 'RARE',
    status: 'owned',
    thumbnail: '/api/placeholder/200/300',
  },
  {
    id: '2',
    title: 'The Qriptopian Chronicles: Issue #1',
    coverType: 'EPIC',
    status: 'locked',
    thumbnail: '/api/placeholder/200/300',
  },
  {
    id: '3',
    title: 'The Qriptopian Chronicles: Issue #2',
    coverType: 'LEGENDARY',
    status: 'locked',
    thumbnail: '/api/placeholder/200/300',
  },
  {
    id: '4',
    title: 'The Qriptopian Chronicles: Issue #3',
    coverType: 'RARE',
    status: 'locked',
    thumbnail: '/api/placeholder/200/300',
  },
];

const getRarityColor = (rarity: string) => {
  switch (rarity.toUpperCase()) {
    case 'RARE': return 'border-amber-600 bg-amber-900/20';
    case 'EPIC': return 'border-purple-600 bg-purple-900/20';
    case 'LEGENDARY': return 'border-yellow-500 bg-yellow-900/20';
    default: return 'border-slate-600 bg-slate-800/20';
  }
};

export function ScrollsTab({ theme = 'dark', density = 'wide' }: ScrollsTabProps) {
  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Digital Scrolls</h3>
        <div className="text-sm text-slate-400">
          {MOCK_SCROLLS.filter(s => s.status === 'owned').length} / {MOCK_SCROLLS.length} owned
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {MOCK_SCROLLS.map((scroll) => (
          <div
            key={scroll.id}
            className={`relative rounded-lg border-2 overflow-hidden transition-all hover:scale-105 ${getRarityColor(scroll.coverType)}`}
          >
            {/* Cover Image */}
            <div className="aspect-[2/3] bg-slate-800 flex items-center justify-center relative">
              <BookOpen className="w-12 h-12 text-slate-600" />
              
              {/* Status Badge */}
              <div className="absolute top-2 right-2">
                {scroll.status === 'owned' ? (
                  <div className="bg-green-500/20 border border-green-500 rounded-full p-1">
                    <Unlock className="w-4 h-4 text-green-400" />
                  </div>
                ) : (
                  <div className="bg-red-500/20 border border-red-500 rounded-full p-1">
                    <Lock className="w-4 h-4 text-red-400" />
                  </div>
                )}
              </div>

              {/* Rarity Badge */}
              <div className="absolute top-2 left-2">
                <div className="px-2 py-1 bg-black/50 rounded text-xs font-bold">
                  {scroll.coverType}
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="p-3 bg-slate-800/50">
              <h4 className="text-sm font-medium line-clamp-2">{scroll.title}</h4>
              
              {/* Actions */}
              <div className="mt-2 flex gap-2">
                {scroll.status === 'owned' ? (
                  <>
                    <button className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/50 rounded text-xs transition-colors">
                      <Play className="w-3 h-3" />
                      Read
                    </button>
                    <button className="flex items-center justify-center px-2 py-1 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded text-xs transition-colors">
                      <Eye className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <button className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-slate-700/30 border border-slate-600/50 rounded text-xs text-slate-500 cursor-not-allowed">
                    <Lock className="w-3 h-3" />
                    Locked
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
