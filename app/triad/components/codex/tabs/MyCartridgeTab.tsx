"use client";

/**
 * MyCartridgeTab — owner-side view of the user's cartridge engagement estate.
 *
 * Phase 2 stub per myCartridge PRD v0.2 (codexes/packs/agentiq/updates/2026-06-01_mycartridge-prd-draft.md).
 *
 * Renders one of two states:
 *   1. Unconfigured — CTA to open CartridgeSetupWizard (wizard ships in Phase 6).
 *   2. Configured — external-facing summary card (identity, primary tab,
 *      copilot stance, wallet stance) + link to runtime + Activation
 *      Requests sub-pane (ships in Phase 11).
 *
 * MVP wiring deferred:
 *   - /api/mycartridge/owner-summary (Phase 7) — currently stubbed to return
 *     `{ configured: false }`.
 *   - CartridgeSetupWizard CTA (Phase 6) — currently shows placeholder.
 */

import React from "react";
import { Boxes, Sparkles, Wand2 } from "lucide-react";

interface Props {
  personaId?: string;
  theme?: "light" | "dark";
}

export function MyCartridgeTab({ personaId, theme: _theme }: Props) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-400/30">
        <Boxes className="h-8 w-8 text-violet-300" aria-hidden="true" />
      </div>
      <h2 className="mb-2 text-2xl font-semibold text-slate-100">myCartridge</h2>
      <p className="mb-8 max-w-lg text-sm text-slate-400">
        Your owned engagement estate. Spin up a cartridge to organize a venture,
        community, project, knowledge domain, or creative universe. Configure
        public/private boundaries, integrate wallet primitives, and let aigentMe
        operate it on your behalf.
      </p>

      <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Sparkles className="h-3.5 w-3.5" /> Status
          </div>
          <p className="text-sm text-slate-300">
            {personaId ? "No cartridge configured yet." : "Sign in with an active persona to begin."}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <Wand2 className="h-3.5 w-3.5" /> Setup wizard
          </div>
          <p className="text-sm text-slate-300">
            CartridgeSetupWizard ships in Phase 6 — 5 steps covering identity,
            purpose, tabs, audience, and the Triad (Cartridge + Copilot + Wallet).
          </p>
        </div>
      </div>

      <p className="mt-8 text-xs text-slate-500">
        Phase 2 stub · See <code className="rounded bg-white/5 px-1 py-0.5">codexes/packs/agentiq/updates/2026-06-01_mycartridge-prd-draft.md</code>
      </p>
    </div>
  );
}

export default MyCartridgeTab;
