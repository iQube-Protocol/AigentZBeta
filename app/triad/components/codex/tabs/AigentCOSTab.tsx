"use client";

import React from "react";
import { Bot, Sparkles, Shield, BookOpen, Package, Database, Globe } from "lucide-react";

interface AigentCOSTabProps {
  personaId?: string;
  onOpenCopilot?: () => void;
}

const MODES = [
  { icon: BookOpen, label: "Learn", desc: "Understand AgentiQ OS protocols and concepts" },
  { icon: Package, label: "Build", desc: "Get guidance through SDK and cartridge creation" },
  { icon: Bot, label: "Persona", desc: "Create and manage your developer persona and Root DiD" },
  { icon: Database, label: "Registry", desc: "Explore asset publishing and trust band progression" },
  { icon: Globe, label: "Ecosystem", desc: "Open/proprietary governance and contribution flow" },
];

export function AigentCOSTab({ onOpenCopilot }: AigentCOSTabProps) {
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-green-500/20 border border-green-500/30">
          <Bot className="h-6 w-6 text-green-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Aigent C-OS</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Developer guide for AgentiQ OS — grounded in this KB, bounded by policy.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/60 bg-slate-900/40 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Agent Identity</p>
        <div className="grid grid-cols-1 gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Root DiD</span>
            <code className="text-xs text-green-300 bg-green-500/10 px-2 py-0.5 rounded">
              did:iqube:aigent-c-os-root
            </code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Bounded persona</span>
            <code className="text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded">aigent-c-os</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Cartridge scope</span>
            <code className="text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded">agentiq-os-cartridge</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">KB source</span>
            <code className="text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded">codexes/packs/agentiq-os</code>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 pt-1 italic">
          Personas may vary. Accountability does not. — Aigent DiDQube Identity Upgrade Note
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Operating Modes</p>
        <div className="space-y-2">
          {MODES.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-lg border border-slate-700/40 bg-slate-900/30 px-3 py-2.5"
            >
              <Icon className="h-4 w-4 flex-shrink-0 text-green-400" />
              <div>
                <span className="text-sm font-medium text-slate-200">{label}</span>
                <span className="text-xs text-slate-400 ml-2">{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-4 w-4 flex-shrink-0 text-green-400 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-green-300">Policy-enforced</p>
            <p className="text-xs text-slate-400">
              All responses are grounded in the AgentiQ OS KB. Requests outside cartridge scope,
              injection attempts, and forbidden actions are blocked at the API boundary before
              reaching the LLM. See the Delegation tab for the full audit trail.
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          if (onOpenCopilot) {
            onOpenCopilot();
          } else {
            window.dispatchEvent(new CustomEvent('aigent-c-os:open-copilot'));
          }
        }}
        className="inline-flex items-center gap-2 rounded-xl border border-green-500/40 bg-green-500/10 px-5 py-2.5 text-sm font-semibold text-green-200 hover:bg-green-500/20 transition-colors"
      >
        <Sparkles className="h-4 w-4" />
        Open Aigent C-OS Copilot
      </button>
    </div>
  );
}
