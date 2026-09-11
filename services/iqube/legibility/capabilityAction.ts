/**
 * Capability-driven action derivation — the ONE place that turns "what can
 * this agent do" into "what button should render" (Agent Bench / aigentMe
 * Specialist Orchestration brief: chat → "Open Chat", invocable capability →
 * "Invoke <capability>", read-only capability → "Ask/Research/Analyze/
 * Preview", nothing declared → "No interactive capability declared").
 *
 * Three shapes already describe agent/asset capability in this codebase, at
 * three different layers, and none of them decide a UI action today:
 *   - `CapabilityDescriptor` (types/registryIngestion.ts) — a ToolQube/asset's
 *     declared tool schema (name + optional input/output schema + tags).
 *   - `AgentCapability` (types/aigentQube.ts) — an aigentQube's categorical
 *     capability ('chat' | 'content' | 'wallet' | ... ) with an enabled flag.
 *   - `IQubeCard.agent_permissions.allowed_actions` (cardBuilder.ts) — content
 *     GOVERNANCE verbs (discover/read_meta/mint_derivative/...), a distinct
 *     axis (can this agent touch this asset) from "how do I interact with
 *     this agent's capability" and deliberately NOT reused here.
 *
 * This module does not replace any of them (inv.engineering.036/037 — extend,
 * don't duplicate): it adds the missing derivation step, fed by a normalized
 * `CapabilitySignal` that thin adapters build from either of the first two
 * shapes. Every surface that needs a capability-derived action (Agent Bench
 * cards, the Financial Services agent selector, aigentMe specialist chips)
 * calls `deriveCapabilityAction` on the SAME signal shape instead of hand-
 * rolling its own chat/invoke/read-only decision.
 */

import type { CapabilityDescriptor } from '@/types/registryIngestion';
import type { AgentCapability } from '@/types/aigentQube';

export type CapabilityActionKind = 'chat' | 'invoke' | 'inspect' | 'none';

export interface CapabilityAction {
  kind: CapabilityActionKind;
  /** The exact button copy the brief specifies. */
  label: string;
  /** The capability this action targets — absent when kind is 'none'. */
  capabilityName?: string;
}

/**
 * A capability source reduced to the three questions that decide the button:
 * can you talk to it, can you invoke something on it, can you only query it.
 * `invocable`/`readOnly` are ordered — the first entry is the one the action
 * label names.
 */
export interface CapabilitySignal {
  hasChat: boolean;
  invocable: string[];
  readOnly: string[];
}

const READ_ONLY_VERB_BY_TAG: Record<string, string> = {
  research: 'Research',
  analyze: 'Analyze',
  analysis: 'Analyze',
  preview: 'Preview',
};

function readOnlyLabel(name: string, tags: string[] | undefined): string {
  const tag = (tags ?? []).find((t) => READ_ONLY_VERB_BY_TAG[t.toLowerCase()]);
  const verb = tag ? READ_ONLY_VERB_BY_TAG[tag.toLowerCase()] : 'Ask';
  return `${verb} ${name}`;
}

/**
 * The core derivation (brief's exact four-way split). Chat outranks invoke
 * outranks read-only outranks none — a chat-capable agent is always "Open
 * Chat" regardless of what else it declares, since chat already subsumes
 * ad-hoc invocation from the operator's point of view.
 */
export function deriveCapabilityAction(signal: CapabilitySignal): CapabilityAction {
  if (signal.hasChat) {
    return { kind: 'chat', label: 'Open Chat' };
  }
  if (signal.invocable.length > 0) {
    const name = signal.invocable[0];
    return { kind: 'invoke', label: `Invoke ${name}`, capabilityName: name };
  }
  if (signal.readOnly.length > 0) {
    const name = signal.readOnly[0];
    return { kind: 'inspect', label: readOnlyLabel(name, undefined), capabilityName: name };
  }
  return { kind: 'none', label: 'No interactive capability declared' };
}

/** Adapter: `AgentCapability[]` (types/aigentQube.ts) → `CapabilitySignal`. */
export function capabilitySignalFromAgentCapabilities(capabilities: AgentCapability[]): CapabilitySignal {
  const enabled = capabilities.filter((c) => c.enabled);
  return {
    hasChat: enabled.some((c) => c.category === 'chat'),
    invocable: enabled.filter((c) => c.category !== 'chat').map((c) => c.label),
    readOnly: [],
  };
}

/**
 * Adapter: `CapabilityDescriptor[]` (types/registryIngestion.ts, the shape
 * `registry_assets.capabilities` carries) → `CapabilitySignal`. A descriptor
 * is read-only when tagged 'read-only' (or one of the read-only-verb tags
 * above); chat when tagged 'chat'; invocable otherwise — the same default
 * every ToolQube-style capability gets today (it IS invocable, just not yet
 * explicitly tagged read-only).
 */
export function capabilitySignalFromDescriptors(descriptors: CapabilityDescriptor[]): CapabilitySignal {
  const isReadOnly = (d: CapabilityDescriptor) =>
    (d.tags ?? []).some((t) => t.toLowerCase() === 'read-only' || Boolean(READ_ONLY_VERB_BY_TAG[t.toLowerCase()]));
  const isChat = (d: CapabilityDescriptor) => (d.tags ?? []).some((t) => t.toLowerCase() === 'chat');

  return {
    hasChat: descriptors.some(isChat),
    invocable: descriptors.filter((d) => !isChat(d) && !isReadOnly(d)).map((d) => d.name),
    readOnly: descriptors.filter((d) => !isChat(d) && isReadOnly(d)).map((d) => d.name),
  };
}
