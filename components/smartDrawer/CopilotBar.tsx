import React, { useState } from 'react';
import { Send, Sparkles, CheckCircle } from 'lucide-react';
import type { SmartTriadSet, TriadDrawerSlotConfig } from '@/src/smartTriad';

interface Props {
  triadSet: SmartTriadSet;
  onChange: (updated: SmartTriadSet) => void;
  selectedDrawerId?: string | null;
  onAddDrawer?: () => void;
  onDeleteDrawer?: (drawerId: string) => void;
}

export function CopilotBar({ triadSet, onChange, selectedDrawerId, onAddDrawer, onDeleteDrawer }: Props) {
  const [input, setInput] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const suggestions = ['Add hero slot', 'Add drawer', 'Delete drawer', 'Remove last slot', 'Add compact card'];

  const handleSubmit = () => {
    if (!input.trim()) return;
    const cmd = input.toLowerCase();
    const drawer = triadSet.drawers.find(d => d.id === selectedDrawerId);
    
    // Drawer management commands
    if (cmd.includes('add') && cmd.includes('drawer') && onAddDrawer) {
      onAddDrawer();
      setFeedback('✓ Drawer created');
      setInput('');
      setTimeout(() => setFeedback(null), 2000);
      return;
    }
    
    if ((cmd.includes('delete') || cmd.includes('remove')) && cmd.includes('drawer') && selectedDrawerId && onDeleteDrawer) {
      if (triadSet.drawers.length <= 1) {
        setFeedback('✗ Cannot delete last drawer');
        setTimeout(() => setFeedback(null), 3000);
        return;
      }
      onDeleteDrawer(selectedDrawerId);
      setFeedback('✓ Drawer deleted');
      setInput('');
      setTimeout(() => setFeedback(null), 2000);
      return;
    }
    
    // Slot commands
    if (cmd.includes('add') && cmd.includes('slot') && drawer) {
      const newSlot: TriadDrawerSlotConfig = {
        id: `slot-${Date.now()}`,
        label: cmd.includes('hero') ? 'Hero Slot' : 'New Slot',
        modality: 'content-card',
        variantId: cmd.includes('hero') ? 'hero' : 'standard',
      };
      const updated = {
        ...triadSet,
        drawers: triadSet.drawers.map(d => d.id === selectedDrawerId ? {
          ...d,
          tabs: d.tabs.map((t, i) => i === 0 ? { ...t, slots: [...t.slots, newSlot] } : t)
        } : d)
      };
      onChange(updated);
      setFeedback('✓ Slot added');
      setInput('');
      setTimeout(() => setFeedback(null), 2000);
    } else if (cmd.includes('remove') && drawer) {
      const updated = {
        ...triadSet,
        drawers: triadSet.drawers.map(d => d.id === selectedDrawerId ? {
          ...d,
          tabs: d.tabs.map(t => ({ ...t, slots: t.slots.slice(0, -1) }))
        } : d)
      };
      onChange(updated);
      setFeedback('✓ Slot removed');
      setInput('');
      setTimeout(() => setFeedback(null), 2000);
    } else {
      setFeedback('Command not recognized');
      setTimeout(() => setFeedback(null), 2000);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300"
      style={{ transform: isHovered ? 'translateY(0)' : 'translateY(calc(100% - 12px))' }}
      onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-3 bg-gradient-to-b from-transparent to-purple-500/20 rounded-t-full" />
      <div className="border-t border-white/10 bg-black/60 backdrop-blur-xl p-4">
        <div className="max-w-[1800px] mx-auto">
          {feedback && (
            <div className="mb-2 px-3 py-1 rounded-lg bg-green-500/20 text-green-300 text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> {feedback}
            </div>
          )}
          <div className="flex gap-2 mb-3 overflow-x-auto">
            {suggestions.map(s => (
              <button key={s} onClick={() => setInput(s)}
                className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/60 hover:bg-white/10 hover:text-white/80 whitespace-nowrap transition-colors">
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Ask Copilot to adjust your drawer configuration..."
                className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-4 py-3 text-white placeholder:text-white/40 focus:border-purple-500/50 focus:outline-none transition-colors" />
            </div>
            <button onClick={handleSubmit}
              className="px-4 py-3 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
