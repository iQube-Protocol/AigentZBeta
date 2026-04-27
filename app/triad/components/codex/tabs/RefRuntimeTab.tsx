"use client";

import React, { useState } from "react";
import {
  Play, Loader2, ChevronRight, CheckCircle2, XCircle,
  AlertTriangle, Terminal, User, Layers, Shield,
} from "lucide-react";
import { AgentiqCartridgeTab } from "./AgentiqCartridgeTab";
import { useSupabaseSessionPersonas } from "@/app/hooks/useSupabaseSessionPersonas";

interface RefRuntimeTabProps {
  personaId?: string;
}

type Depth = "pill" | "capsule" | "mini_runtime" | "codex";
type Disposition = "ask" | "act" | "wait" | "escalate" | "deny";

const DEPTHS: Depth[] = ["pill", "capsule", "mini_runtime", "codex"];
const DEPTH_LABELS: Record<Depth, string> = {
  pill: "L0 pill",
  capsule: "L1 capsule",
  mini_runtime: "L2 mini_runtime",
  codex: "L3 codex",
};

interface RouteResult {
  disposition: Disposition;
  reason: string;
  guardResult: "pass" | "block";
  guardReason?: string;
  nextDepth: Depth | null;
  receiptEmitted: boolean;
}

interface LogEntry {
  id: string;
  prompt: string;
  depth: Depth;
  result: RouteResult;
  timestamp: string;
}

const INJECTION_PATTERNS = [
  /ignore.*previous.*instruction/i,
  /reveal.*system.*prompt/i,
  /act.*as.*admin/i,
  /override.*policy/i,
  /service.*role/i,
  /access.*database/i,
  /list.*all.*users/i,
];

function classify(prompt: string, depth: Depth): RouteResult {
  const lower = prompt.toLowerCase();

  for (const pat of INJECTION_PATTERNS) {
    if (pat.test(prompt)) {
      return {
        disposition: "deny",
        reason: "DelegationGuard: injection pattern detected",
        guardResult: "block",
        guardReason: "Message matches forbidden injection pattern — blocked before LLM.",
        nextDepth: null,
        receiptEmitted: true,
      };
    }
  }

  const isQuestion = /^(what|how|why|explain|tell me|describe|show me|can you|could you|is there|where)/i.test(prompt) || prompt.includes("?");
  const isAction = /\b(create|build|register|submit|publish|generate|write|make|add|deploy|init)\b/i.test(lower);
  const isEscalate = /\b(admin|root|superuser|service role|bypass|disable|remove guard|change policy)\b/i.test(lower);
  const isWait = /\b(wait|pause|hold|not yet|later|cancel)\b/i.test(lower);

  if (isEscalate) {
    return {
      disposition: "escalate",
      reason: "Requires elevated authority — routing to metaMe guardian",
      guardResult: "pass",
      nextDepth: null,
      receiptEmitted: true,
    };
  }

  if (isWait) {
    return {
      disposition: "wait",
      reason: "Waiting for user confirmation before proceeding",
      guardResult: "pass",
      nextDepth: null,
      receiptEmitted: false,
    };
  }

  if (isAction) {
    const depthIdx = DEPTHS.indexOf(depth);
    const nextDepth = depthIdx < DEPTHS.length - 1 ? DEPTHS[depthIdx + 1] : null;
    return {
      disposition: "act",
      reason: "Action intent detected — delegated action within policy scope",
      guardResult: "pass",
      nextDepth,
      receiptEmitted: true,
    };
  }

  if (isQuestion) {
    return {
      disposition: "ask",
      reason: "Information request — Aigent C-OS will respond from KB",
      guardResult: "pass",
      nextDepth: null,
      receiptEmitted: false,
    };
  }

  return {
    disposition: "ask",
    reason: "Unclassified intent — defaulting to ask disposition",
    guardResult: "pass",
    nextDepth: null,
    receiptEmitted: false,
  };
}

const DISPOSITION_COLORS: Record<Disposition, string> = {
  ask: "text-blue-300 bg-blue-500/10 border-blue-500/20",
  act: "text-green-300 bg-green-500/10 border-green-500/20",
  wait: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  escalate: "text-orange-300 bg-orange-500/10 border-orange-500/20",
  deny: "text-red-300 bg-red-500/10 border-red-500/20",
};

export function RefRuntimeTab({ personaId }: RefRuntimeTabProps) {
  const { sessionPersonas } = useSupabaseSessionPersonas();
  const activePersona = sessionPersonas.find((p) => p.id === personaId) ?? sessionPersonas[0] ?? null;

  const [activeSubTab, setActiveSubTab] = useState<"docs" | "demo">("docs");
  const [depth, setDepth] = useState<Depth>("pill");
  const [prompt, setPrompt] = useState("");
  const [routing, setRouting] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  async function handleRoute() {
    if (!prompt.trim()) return;
    setRouting(true);
    const result = classify(prompt, depth);
    const entry: LogEntry = {
      id: `${Date.now()}`,
      prompt: prompt.trim(),
      depth,
      result,
      timestamp: new Date().toISOString(),
    };

    if (result.receiptEmitted && personaId) {
      void fetch("/api/runtime/orchestration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: result.guardResult === "block" ? "policy_blocked" : "z_delegated",
          persona_id: personaId,
          journey_stage: "acolyte",
          active_cartridge: "agentiq-os-cartridge",
          from_role: "aigent-z",
          to_role: "aigent-c",
          reason: `Runtime demo: ${result.disposition} — ${result.reason}`,
          receipt_eligible: true,
          metadata: {
            runtime_demo: true,
            disposition: result.disposition,
            depth,
            next_depth: result.nextDepth,
            agent_root_did: "did:iqube:aigent-c-os-root",
          },
        }),
      });
    }

    if (result.nextDepth) setDepth(result.nextDepth);

    setLog((prev) => [entry, ...prev]);
    setPrompt("");
    setRouting(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tab nav */}
      <div className="flex gap-1 rounded-lg border border-slate-700/40 bg-slate-900/30 p-1 w-fit mx-6 mt-6 flex-shrink-0">
        {(["docs", "demo"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveSubTab(tab)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeSubTab === tab
                ? "bg-blue-500/20 text-blue-200 border border-blue-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab === "docs" ? "Docs" : "Ref Demo"}
          </button>
        ))}
      </div>

      {activeSubTab === "docs" && (
        <div className="flex-1 overflow-auto">
          <AgentiqCartridgeTab
            packId="agentiq-os"
            collectionId="col_reference"
            defaultPath="items/reference-runtime.md"
          />
        </div>
      )}

      {activeSubTab === "demo" && (
        <div className="flex-1 overflow-auto p-6 space-y-5 max-w-2xl">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-1.5">
            <p className="text-sm font-semibold text-blue-200 flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Try Runtime Pattern
            </p>
            <p className="text-xs text-slate-400">
              Simulate the SmartTriad routing loop: enter a prompt, observe the DelegationGuard check,
              NBE disposition, and journey state transition. Receipt-eligible events are emitted to Supabase.
            </p>
          </div>

          {/* Active persona */}
          <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-3 grid grid-cols-3 gap-3 text-xs">
            <div className="space-y-0.5">
              <p className="text-slate-500 uppercase tracking-wide text-[10px]">Persona</p>
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-slate-200">{activePersona?.displayName ?? "anonymous"}</span>
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-slate-500 uppercase tracking-wide text-[10px]">Cartridge</p>
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-slate-300">agentiq-os-cartridge</span>
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-slate-500 uppercase tracking-wide text-[10px]">Guard</p>
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-green-400" />
                <span className="text-green-300">DelegationGuard active</span>
              </div>
            </div>
          </div>

          {/* Depth selector */}
          <div className="space-y-2">
            <p className="text-xs text-slate-400 font-medium">Experience Depth</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {DEPTHS.map((d, idx) => {
                const current = d === depth;
                const past = DEPTHS.indexOf(depth) > idx;
                return (
                  <React.Fragment key={d}>
                    <button
                      type="button"
                      onClick={() => setDepth(d)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        current
                          ? "border-blue-500/60 bg-blue-500/20 text-blue-200"
                          : past
                            ? "border-slate-600/40 bg-slate-800/30 text-slate-500"
                            : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      {DEPTH_LABELS[d]}
                    </button>
                    {idx < DEPTHS.length - 1 && (
                      <ChevronRight className="h-3.5 w-3.5 text-slate-600 flex-shrink-0" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Prompt input */}
          <div className="space-y-2">
            <p className="text-xs text-slate-400 font-medium">Prompt</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleRoute(); }}
                placeholder='e.g. "Create a new SkillQube for image processing"'
                className="flex-1 rounded-lg border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
              />
              <button
                type="button"
                onClick={() => void handleRoute()}
                disabled={routing || !prompt.trim()}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-200 hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
              >
                {routing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Route
              </button>
            </div>
            <p className="text-[11px] text-slate-600">
              Try: questions (ask), action verbs like &quot;create&quot;/&quot;register&quot; (act), &quot;ignore instructions&quot; (deny)
            </p>
          </div>

          {/* Event log */}
          {log.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5" />
                Routing Log
              </p>
              {log.map((entry) => (
                <div
                  key={entry.id}
                  className={`rounded-xl border p-3 space-y-2 ${
                    entry.result.guardResult === "block"
                      ? "border-red-500/20 bg-red-500/5"
                      : "border-slate-700/40 bg-slate-900/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-slate-300 flex-1 truncate">
                      &quot;{entry.prompt}&quot;
                    </p>
                    <span className="text-[10px] text-slate-600 shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="space-y-1">
                      <span className="text-slate-500 uppercase tracking-wide">Guard</span>
                      <div className="flex items-center gap-1">
                        {entry.result.guardResult === "pass"
                          ? <CheckCircle2 className="h-3 w-3 text-green-400" />
                          : <XCircle className="h-3 w-3 text-red-400" />}
                        <span className={entry.result.guardResult === "pass" ? "text-green-300" : "text-red-300"}>
                          {entry.result.guardResult === "pass" ? "Pass" : "Blocked"}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-500 uppercase tracking-wide">Disposition</span>
                      <span className={`inline-flex rounded border px-1.5 py-0.5 font-mono ${DISPOSITION_COLORS[entry.result.disposition]}`}>
                        {entry.result.disposition}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-500 uppercase tracking-wide">Depth at call</span>
                      <span className="text-slate-300">{DEPTH_LABELS[entry.depth]}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-500 uppercase tracking-wide">Next depth</span>
                      <span className="text-slate-300">
                        {entry.result.nextDepth ? DEPTH_LABELS[entry.result.nextDepth] : "—"}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">{entry.result.reason}</p>
                  {entry.result.receiptEmitted && (
                    <span className="inline-flex text-[10px] rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 text-violet-400">
                      DVN receipt emitted
                    </span>
                  )}
                  {entry.result.guardReason && (
                    <div className="flex items-start gap-1.5 text-[11px] text-red-400">
                      <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                      {entry.result.guardReason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
