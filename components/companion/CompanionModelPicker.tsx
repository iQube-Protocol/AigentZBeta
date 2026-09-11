/**
 * CompanionModelPicker — Companion copilot model-provider control (2026-07-29,
 * operator-directed).
 *
 * REUSE, NOT REINVENTION: the provider icon set and the
 * `getAgentLlmProviders` / `/api/metame/agent-llm-options` data source are
 * the SAME ones `components/metame/MetaMeRuntimeClient.tsx`'s `agentSelector`
 * already uses (which itself sources from `services/metame/agentLlmOrchestra`,
 * the canonical per-agent LLM ModelQube registry `/api/codex/chat` reads to
 * resolve `provider_id`/`llm_id`). No new provider list, no new icon set, no
 * new server route — this file only adds the UI affordance the Companion's
 * footer row was missing.
 *
 * TWO-LEVEL DROPDOWN (operator's own words: "Clicking a provider shows that
 * provider's available models as the next level of the dropdown"): the
 * trigger opens a provider list (Anthropic / OpenAI / Venice, whichever the
 * agent has ModelQubes for); clicking a provider swaps the SAME popover to
 * that provider's model list; picking a model calls `onChange` and closes.
 *
 * FUNCTIONALLY REAL: `onChange`'s `{ providerId, modelId }` is threaded by
 * the Companion embed page into `CodexCopilotLayer`'s `modelSelection` prop,
 * which every `/api/codex/chat` call from that copilot now sends as
 * `provider_id` / `llm_id` — the exact fields `route.ts` already resolves
 * against the agent's configured providers. This is not cosmetic: the server
 * actually serves the requested provider/model when available.
 *
 * Styling: canonical SLATE house style for the popover (new chrome) —
 * `border-slate-800` / `bg-slate-900/95`, no white hairlines.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { Brain, ChevronDown, ChevronLeft } from "lucide-react";

import {
  getStaticAgentLlmProviders,
  type AgentProviderOption,
} from "@/services/metame/agentLlmOrchestra";

export interface CompanionModelSelection {
  providerId: string;
  modelId: string;
}

export interface CompanionModelPickerProps {
  /** The agent whose ModelQube roster is offered — the Companion always
   *  passes "aigent-me" (SCOPE-MMC-004: Agent Me is the Companion). */
  agentId: string;
  value: CompanionModelSelection | null;
  onChange: (selection: CompanionModelSelection) => void;
}

const PROVIDER_ICON_URL: Record<string, string> = {
  anthropic: "/llm_model_logos/anthropic.png",
  openai: "/llm_model_logos/openai.png",
  venice: "/llm_model_logos/venice.png",
  chaingpt: "/llm_model_logos/chaingpt.png",
  thirdweb: "/llm_model_logos/thirdweb.png",
};

function providerIconClass(providerId: string): string {
  // Same dark-surface treatment MetaMeRuntimeClient/SmartTriadCopilotLayer
  // already apply — the OpenAI/Anthropic marks are dark glyphs by default.
  return providerId === "openai" || providerId === "anthropic" ? "invert brightness-200" : "";
}

export function CompanionModelPicker({ agentId, value, onChange }: CompanionModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [expandedProviderId, setExpandedProviderId] = useState<string | null>(null);
  const [providers, setProviders] = useState<AgentProviderOption[]>(
    () => getStaticAgentLlmProviders()[agentId] || [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/metame/agent-llm-options", { cache: "no-store" });
        if (!res.ok) return;
        const body = await res.json();
        const liveMap = body?.providerMap as Record<string, AgentProviderOption[]> | undefined;
        if (!cancelled && liveMap && typeof liveMap === "object" && liveMap[agentId]) {
          setProviders(liveMap[agentId]);
        }
      } catch {
        // Static fallback (already seeded above) stands.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const activeProvider = useMemo(
    () => providers.find((p) => p.id === value?.providerId) ?? null,
    [providers, value?.providerId],
  );
  const expandedProvider = useMemo(
    () => providers.find((p) => p.id === expandedProviderId) ?? null,
    [providers, expandedProviderId],
  );

  const close = () => {
    setOpen(false);
    setExpandedProviderId(null);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        title={
          value
            ? `${activeProvider?.label ?? value.providerId} · ${value.modelId}`
            : "Choose model provider"
        }
        aria-label="Choose model provider"
        className="flex items-center gap-1 rounded-md px-1.5 py-1 text-white/50 transition-all hover:bg-white/10 hover:text-white/80"
      >
        {value ? (
          <img
            src={PROVIDER_ICON_URL[value.providerId]}
            alt={value.providerId}
            className={`h-3.5 w-3.5 rounded-[2px] object-contain ${providerIconClass(value.providerId)}`}
            loading="lazy"
          />
        ) : (
          <Brain className="h-3.5 w-3.5 text-white/40" aria-hidden="true" />
        )}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-9 left-0 z-50 min-w-[180px] rounded-xl border border-slate-800 bg-slate-900/95 p-2 shadow-xl backdrop-blur">
          {!expandedProvider ? (
            providers.length === 0 ? (
              <div className="px-2 py-1.5 text-[11px] text-slate-500">No model providers configured.</div>
            ) : (
              providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setExpandedProviderId(provider.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${
                    provider.id === value?.providerId ? "bg-cyan-500/15 text-cyan-200" : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  <img
                    src={PROVIDER_ICON_URL[provider.id]}
                    alt={provider.id}
                    className={`h-3.5 w-3.5 rounded-[2px] object-contain ${providerIconClass(provider.id)}`}
                    loading="lazy"
                  />
                  <span>{provider.label}</span>
                </button>
              ))
            )
          ) : (
            <>
              <button
                type="button"
                onClick={() => setExpandedProviderId(null)}
                className="mb-1 flex w-full items-center gap-1 rounded-md px-1 py-1 text-[10px] uppercase tracking-wide text-slate-500 hover:text-slate-300"
              >
                <ChevronLeft className="h-3 w-3" /> {expandedProvider.label}
              </button>
              {expandedProvider.models.length === 0 ? (
                <div className="px-2 py-1.5 text-[11px] text-slate-500">No models for this provider.</div>
              ) : (
                expandedProvider.models.map((model) => {
                  const selected = value?.providerId === expandedProvider.id && value?.modelId === model.id;
                  return (
                    <button
                      key={`${expandedProvider.id}-${model.id}`}
                      type="button"
                      onClick={() => {
                        onChange({ providerId: expandedProvider.id, modelId: model.id });
                        close();
                      }}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px] transition ${
                        selected ? "bg-cyan-500/20 text-cyan-100" : "text-slate-200 hover:bg-white/10"
                      }`}
                    >
                      <span className="truncate">{model.label}</span>
                      {selected ? <span className="text-[10px] uppercase tracking-wide text-cyan-200">Active</span> : null}
                    </button>
                  );
                })
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default CompanionModelPicker;
