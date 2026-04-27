"use client";

import React from "react";
import { GitBranch, Lock, Unlock, ExternalLink } from "lucide-react";

interface ComparisonRow {
  concern: string;
  nanos: string | null;
  agentiqos: string | null;
}

const COMPARISON: ComparisonRow[] = [
  { concern: "Agent spawning and lifecycle",          nanos: "✓ Handles",        agentiqos: "— Uses nanOS" },
  { concern: "Sandboxed execution",                   nanos: "✓ Handles",        agentiqos: "— Uses nanOS" },
  { concern: "Raw tool invocation",                   nanos: "✓ Handles",        agentiqos: "— Uses nanOS" },
  { concern: "Inter-agent messaging primitives",      nanos: "✓ Handles",        agentiqos: "— Uses nanOS" },
  { concern: "Identity (Root DiD, PersonaQube)",      nanos: "— Not in scope",   agentiqos: "✓ Provides" },
  { concern: "Policy enforcement (PolicyEnvelope)",   nanos: "— Not in scope",   agentiqos: "✓ Provides" },
  { concern: "Trust bands and reputation",            nanos: "— Not in scope",   agentiqos: "✓ Provides" },
  { concern: "Bounded delegation",                    nanos: "— Not in scope",   agentiqos: "✓ Provides" },
  { concern: "Registry (asset discovery)",            nanos: "— Not in scope",   agentiqos: "✓ Provides" },
  { concern: "DVN receipts and audit trail",          nanos: "— Not in scope",   agentiqos: "✓ Provides" },
  { concern: "Experience design (NBE, cartridges)",   nanos: "— Not in scope",   agentiqos: "✓ Provides" },
  { concern: "Payment and x402 settlement",           nanos: "— Not in scope",   agentiqos: "✓ Provides" },
  { concern: "Open source",                           nanos: "Proprietary",      agentiqos: "Open (iQube Protocol License)" },
  { concern: "Developer-facing docs",                 nanos: "Not published",    agentiqos: "This cartridge" },
];

const OPEN_ITEMS = [
  { label: "Protocol specs (iQube, Qripto, Aigent)", open: true },
  { label: "AgentiQ OS SDK (@agentiq/sdk)", open: true },
  { label: "Pack content (developer KB docs)", open: true },
  { label: "Registry trust band definitions", open: true },
  { label: "nanOS internals", open: false },
  { label: "AgentiQ Platform (cartridge renderer)", open: false },
  { label: "Engineering KB (architecture, PRs, decisions)", open: false },
  { label: "Supabase schema and RLS policies", open: false },
];

export function NanOSBridgeTab() {
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30">
          <GitBranch className="h-6 w-6 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">nanOS Bridge</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            How AgentiQ OS sits above nanOS — what each layer owns.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-4">
        <p className="text-sm text-slate-300 mb-3">The hourglass architecture:</p>
        <div className="rounded-lg bg-slate-800/60 px-4 py-3 font-mono text-xs text-slate-300 space-y-1">
          <p>┌─────────────────────────────────────────┐</p>
          <p>│  AgentiQ Platform (cartridges, UX)      │  ← Open participation</p>
          <p>├─────────────────────────────────────────┤</p>
          <p>│  AgentiQ OS  ← you are here             │  ← Governed waist</p>
          <p>│  (protocols, SDK, runtime, registry)    │</p>
          <p>├─────────────────────────────────────────┤</p>
          <p>│  nanOS (agent execution substrate)      │  ← Proprietary</p>
          <p>└─────────────────────────────────────────┘</p>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          AgentiQ OS provides the semantics. nanOS provides the execution mechanics. Developers work with AgentiQ OS — nanOS is an implementation detail.
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Capability Comparison</p>
        <div className="overflow-x-auto rounded-xl border border-slate-700/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/40 bg-slate-900/60">
                <th className="text-left px-4 py-2 text-xs text-slate-400 font-medium">Concern</th>
                <th className="text-left px-4 py-2 text-xs text-slate-400 font-medium">nanOS</th>
                <th className="text-left px-4 py-2 text-xs text-slate-400 font-medium">AgentiQ OS</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={i} className={`border-b border-slate-800/60 ${i % 2 === 0 ? "bg-slate-900/20" : ""}`}>
                  <td className="px-4 py-2 text-xs text-slate-300">{row.concern}</td>
                  <td className={`px-4 py-2 text-xs ${row.nanos?.startsWith("✓") ? "text-amber-300" : "text-slate-500"}`}>
                    {row.nanos}
                  </td>
                  <td className={`px-4 py-2 text-xs ${row.agentiqos?.startsWith("✓") ? "text-green-300" : "text-slate-500"}`}>
                    {row.agentiqos}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Open / Proprietary Boundary</p>
        <div className="space-y-2">
          {OPEN_ITEMS.map(({ label, open }) => (
            <div key={label} className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${open ? "border-green-500/20 bg-green-500/5" : "border-slate-700/30 bg-slate-900/20"}`}>
              {open
                ? <Unlock className="h-4 w-4 flex-shrink-0 text-green-400" />
                : <Lock className="h-4 w-4 flex-shrink-0 text-slate-500" />
              }
              <span className={open ? "text-slate-200" : "text-slate-500"}>{label}</span>
              <span className={`ml-auto text-[11px] font-medium ${open ? "text-green-400" : "text-slate-600"}`}>
                {open ? "Open" : "Proprietary"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-4">
        <p className="text-sm font-medium text-amber-300 mb-1">nanOS documentation</p>
        <p className="text-xs text-slate-400">
          nanOS internals are not documented in this cartridge. Aigent C-OS will not speculate about nanOS implementation details. When nanOS docs are published, they will appear here as a linked resource.
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <ExternalLink className="h-3.5 w-3.5" />
          <span>nanOS documentation — coming when published</span>
        </div>
      </div>
    </div>
  );
}
