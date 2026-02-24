/**
 * CodexHomeTab - Dynamic AI-driven content curation
 */

import { Sparkles, BookOpen, Scroll, Users, Gamepad2, Globe, Crown } from 'lucide-react';

interface CodexHomeTabProps {
  onNavigate: (tab: string) => void;
}

export function CodexHomeTab({ onNavigate }: CodexHomeTabProps) {
  const sections = [
    {
      id: 'scrolls',
      title: 'Scrolls',
      description: 'Digital episodes and motion comics from the metaKnyts saga',
      icon: BookOpen,
      color: 'cyan',
      bgGradient: 'from-cyan-900/30 to-blue-900/30',
    },
    {
      id: 'characters',
      title: 'Characters',
      description: 'Meet the heroes and villains of the metaKnyts universe',
      icon: Users,
      color: 'purple',
      bgGradient: 'from-purple-900/30 to-pink-900/30',
    },
    {
      id: 'lore',
      title: 'Lore',
      description: 'Ancient texts and background mythology',
      icon: Scroll,
      color: 'amber',
      bgGradient: 'from-amber-900/30 to-orange-900/30',
    },
    {
      id: 'digiterra',
      title: 'DigiTerra',
      description: 'Game assets and Lunapunk experiences',
      icon: Gamepad2,
      color: 'violet',
      bgGradient: 'from-violet-900/30 to-purple-900/30',
    },
    {
      id: 'terra',
      title: 'Terra',
      description: 'Real-world impact and Solarpunk transformation',
      icon: Globe,
      color: 'green',
      bgGradient: 'from-green-900/30 to-emerald-900/30',
    },
    {
      id: 'order',
      title: 'Order of Metayé',
      description: 'Membership, rewards, and community',
      icon: Crown,
      color: 'yellow',
      bgGradient: 'from-yellow-900/30 to-amber-900/30',
    },
  ];

  const colorClasses: Record<string, string> = {
    cyan: 'text-cyan-400 bg-cyan-500/20 hover:border-cyan-400/50',
    purple: 'text-purple-400 bg-purple-500/20 hover:border-purple-400/50',
    amber: 'text-amber-400 bg-amber-500/20 hover:border-amber-400/50',
    violet: 'text-violet-400 bg-violet-500/20 hover:border-violet-400/50',
    green: 'text-green-400 bg-green-500/20 hover:border-green-400/50',
    yellow: 'text-yellow-400 bg-yellow-500/20 hover:border-yellow-400/50',
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          KNYT Codex
        </h3>
        <p className="text-sm text-white/60 mt-1">
          Your gateway to the metaKnyts universe. Explore scrolls, characters, lore, and more.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {sections.map((section) => {
          const Icon = section.icon;
          const colors = colorClasses[section.color];
          return (
            <div
              key={section.id}
              onClick={() => onNavigate(section.id)}
              className={`group p-4 bg-gradient-to-br ${section.bgGradient} rounded-lg border border-white/10 ${colors.split(' ').pop()} cursor-pointer transition-all`}
            >
              <div className={`w-10 h-10 rounded-lg ${colors.split(' ').slice(0, 2).join(' ')} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${colors.split(' ')[0]}`} />
              </div>
              <h4 className="font-medium text-white group-hover:text-cyan-400 transition-colors">
                {section.title}
              </h4>
              <p className="text-xs text-white/50 mt-1 line-clamp-2">
                {section.description}
              </p>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-gradient-to-r from-cyan-900/20 to-purple-900/20 rounded-lg border border-white/10">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          <div>
            <p className="text-sm text-white">AI-Powered Discovery</p>
            <p className="text-xs text-white/50">
              Ask the copilot to guide you through the Codex based on your interests
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
