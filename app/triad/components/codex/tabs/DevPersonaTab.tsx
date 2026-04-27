"use client";

import React, { useState } from "react";
import { User, Wallet, ChevronDown, ChevronUp, Info } from "lucide-react";
import { PersonaCreationForm } from "@/components/identity/PersonaCreationForm";

interface DevPersonaTabProps {
  personaId?: string;
}

export function DevPersonaTab({ personaId }: DevPersonaTabProps) {
  const [showForm, setShowForm] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [showIdentityInfo, setShowIdentityInfo] = useState(false);

  const activePersonaId = createdId ?? personaId ?? null;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-blue-500/20 border border-blue-500/30">
          <User className="h-6 w-6 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Developer Persona</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Create and manage your bounded developer identity on AgentiQ OS.
          </p>
        </div>
      </div>

      {/* Identity model explainer */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/30">
        <button
          type="button"
          onClick={() => setShowIdentityInfo((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm text-slate-300 hover:text-slate-100"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-400" />
            <span className="font-medium">Identity Model — Root DiD and Bounded Personas</span>
          </div>
          {showIdentityInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showIdentityInfo && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-700/40 pt-3">
            <p className="text-sm text-slate-300">
              Per the <strong className="text-blue-300">Aigent DiDQube Identity Upgrade Note</strong>:
            </p>
            <div className="rounded-lg bg-slate-800/60 px-3 py-2 font-mono text-xs text-slate-300">
              Root DiD ← Enduring accountability anchor<br />
              &nbsp;&nbsp;└── Bounded persona (this cartridge)<br />
              &nbsp;&nbsp;└── Bounded persona (another context)<br />
            </div>
            <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
              <li>Your <strong className="text-slate-300">Root DiD</strong> is your durable identity — trust, receipts, and reputation always trace back here</li>
              <li>A <strong className="text-slate-300">bounded persona</strong> is your context-specific presentation layer — it can vary by cartridge, client, or mission</li>
              <li>Personas may be anonymous, pseudonymous, or identified depending on your disclosure policy</li>
              <li><em>Personas may vary. Accountability does not.</em></li>
            </ul>
          </div>
        )}
      </div>

      {/* Active persona */}
      {activePersonaId ? (
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active Persona</p>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Persona ID</span>
              <code className="text-xs text-green-300 bg-green-500/10 px-2 py-0.5 rounded break-all max-w-[240px]">
                {activePersonaId}
              </code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Cartridge scope</span>
              <code className="text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                agentiq-os-cartridge
              </code>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            This persona is your presentation layer in the AgentiQ OS Cartridge context.
            Your Root DiD anchors trust and receipts across all contexts.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/20 p-4">
          <p className="text-sm text-slate-400">No active developer persona detected for this session.</p>
          <p className="text-xs text-slate-500 mt-1">
            Create one below to enable bounded delegation and mission tracking.
          </p>
        </div>
      )}

      {/* Wallet state placeholder */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-900/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-slate-400" />
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SmartWallet</p>
        </div>
        {activePersonaId ? (
          <p className="text-sm text-slate-400">
            Wallet balances load from your active SmartWalletQube in Phase 2 (live wallet integration).
          </p>
        ) : (
          <p className="text-sm text-slate-400 italic">Create a persona to see wallet state.</p>
        )}
      </div>

      {/* Create persona form */}
      <div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 px-5 py-2.5 text-sm font-semibold text-blue-200 hover:bg-blue-500/20 transition-colors"
        >
          <User className="h-4 w-4" />
          {showForm ? "Hide" : "Create Developer Persona"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-slate-700/60 bg-slate-900/30 p-4">
          <PersonaCreationForm
            onSuccess={(id) => {
              setCreatedId(id);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}
    </div>
  );
}
