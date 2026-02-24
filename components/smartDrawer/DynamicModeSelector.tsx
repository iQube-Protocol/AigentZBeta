import React from 'react';

interface Props {
  value: 'static-only' | 'copilot-suggest' | 'copilot-adaptive';
  onChange: (mode: 'static-only' | 'copilot-suggest' | 'copilot-adaptive') => void;
}

export function DynamicModeSelector({ value, onChange }: Props) {
  const modes = [
    { id: 'static-only' as const, label: 'Static', desc: 'Fixed config' },
    { id: 'copilot-suggest' as const, label: 'Suggest', desc: 'Recommends' },
    { id: 'copilot-adaptive' as const, label: 'Adaptive', desc: 'Auto-adjusts' },
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide">Dynamic Mode</h3>
      <div className="grid grid-cols-3 gap-2">
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onChange(mode.id)}
            className={`p-3 rounded-xl border-2 transition-all ${
              value === mode.id
                ? 'border-purple-500 bg-purple-500/20 text-purple-200'
                : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
            }`}
          >
            <div className="text-sm font-bold">{mode.label}</div>
            <div className="text-xs opacity-75 mt-1">{mode.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
