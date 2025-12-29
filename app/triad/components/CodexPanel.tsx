"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Users,
  Scroll,
  Gamepad2,
  Globe,
  Crown,
  Sparkles,
  Library,
  Play,
  Eye,
  Lock,
  Unlock,
} from "lucide-react";

interface CodexPanelProps {
  theme?: 'light' | 'dark';
  density?: 'narrow' | 'wide';
  initialTab?: string;
}

type CodexTab = 'scrolls' | 'characters' | 'lore' | 'digiterra' | 'terra' | 'order';

const TAB_CONFIG: Array<{ 
  id: CodexTab; 
  label: string; 
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  { id: 'scrolls', label: 'Scrolls', icon: BookOpen, description: 'Digital comic scrolls and episodes' },
  { id: 'characters', label: 'Characters', icon: Users, description: 'Character profiles and bios' },
  { id: 'lore', label: 'Lore', icon: Scroll, description: 'World-building and backstory' },
  { id: 'digiterra', label: 'DigiTerra', icon: Gamepad2, description: 'Digital realm content' },
  { id: 'terra', label: 'Terra', icon: Globe, description: 'Physical realm content' },
  { id: 'order', label: 'Order', icon: Crown, description: 'Knights of the Order' },
];

// Mock content data
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
];

export default function CodexPanel({ theme = 'dark', density = 'wide', initialTab = 'scrolls' }: CodexPanelProps) {
  const [activeTab, setActiveTab] = useState<CodexTab>(initialTab as CodexTab);

  const getRarityColor = (rarity: string) => {
    switch (rarity.toUpperCase()) {
      case 'RARE': return 'border-amber-600 bg-amber-900/20';
      case 'EPIC': return 'border-purple-600 bg-purple-900/20';
      case 'LEGENDARY': return 'border-yellow-500 bg-yellow-900/20';
      default: return 'border-slate-600 bg-slate-800/20';
    }
  };

  return (
    <div className={`flex flex-col h-full w-full ${theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-700/50 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Library className="w-5 h-5 text-purple-400" />
            KNYT Codex
          </h2>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Sparkles className="w-4 h-4" />
            <span>Liquid UI</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-slate-700/50 px-4">
        <div className="flex gap-1 overflow-x-auto">
          {TAB_CONFIG.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === id
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {density === 'wide' && label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'scrolls' && (
          <div className="space-y-6">
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
                        <div className="bg-slate-700/50 border border-slate-600 rounded-full p-1">
                          <Lock className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                    </div>

                    {/* Rarity Badge */}
                    <div className="absolute bottom-2 left-2">
                      <div className={`px-2 py-1 rounded text-xs font-bold ${
                        scroll.coverType === 'RARE' ? 'bg-amber-600 text-white' :
                        scroll.coverType === 'EPIC' ? 'bg-purple-600 text-white' :
                        'bg-yellow-500 text-black'
                      }`}>
                        {scroll.coverType}
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 bg-slate-800/50">
                    <h4 className="text-sm font-medium line-clamp-2 mb-2">{scroll.title}</h4>
                    
                    {scroll.status === 'owned' ? (
                      <div className="flex gap-2">
                        <button className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/50 rounded text-xs font-medium transition-colors">
                          <Eye className="w-3 h-3" />
                          Read
                        </button>
                        <button className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded text-xs font-medium transition-colors">
                          <Play className="w-3 h-3" />
                          Watch
                        </button>
                      </div>
                    ) : (
                      <button className="w-full flex items-center justify-center gap-1 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded text-xs font-medium transition-colors">
                        <Lock className="w-3 h-3" />
                        Unlock
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'characters' && (
          <div className="text-center py-12 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Character Profiles</p>
            <p className="text-sm">Meet the heroes and villains of The Qriptopian</p>
          </div>
        )}

        {activeTab === 'lore' && (
          <div className="text-center py-12 text-slate-500">
            <Scroll className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">World Lore</p>
            <p className="text-sm">Discover the history and secrets of the realms</p>
          </div>
        )}

        {activeTab === 'digiterra' && (
          <div className="text-center py-12 text-slate-500">
            <Gamepad2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">DigiTerra Realm</p>
            <p className="text-sm">Explore the digital dimension</p>
          </div>
        )}

        {activeTab === 'terra' && (
          <div className="text-center py-12 text-slate-500">
            <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Terra Realm</p>
            <p className="text-sm">The physical world and its mysteries</p>
          </div>
        )}

        {activeTab === 'order' && (
          <div className="text-center py-12 text-slate-500">
            <Crown className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Knights of the Order</p>
            <p className="text-sm">Join the ranks of the legendary knights</p>
          </div>
        )}
      </div>
    </div>
  );
}
