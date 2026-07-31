/**
 * Voice persona resolution — the voice co-pilot speaks as the SURFACE'S agent.
 *
 * ── THE DEFECT THIS REPLACES (operator, 2026-07-26) ────────────────────────
 *
 * `CodexCopilotLayer`'s voice session was hardcoded to Marketa in four places
 * at once: the session `name`, the spoken greeting ("Hey! I'm Marketa, your
 * voice co-pilot"), the system prompt ("You are Marketa…"), and the button
 * tooltips. Every mount of the copilot inherited it — so in the Companion,
 * where the agent is **Agent Me**, pressing the mic introduced a different
 * agent than the one the citizen was talking to in text.
 *
 * That is not a cosmetic slip. The copilot is one conversation rendered three
 * ways (text, avatar, voice — SCOPE-MMC-004 D-8); an agent that changes
 * identity when the citizen switches modality breaks the premise that they are
 * addressing one agent at all.
 *
 * ── DERIVED, NOT LISTED ────────────────────────────────────────────────────
 *
 * Name and description come from the SAME canonical profile registry the
 * registry cards read (`getAigentQubeSource` → `PROFILES`, keyed by
 * `RUNTIME_AGENT_IDS`). No second table of agent names is introduced here —
 * a hand-copied one would be the `inv.engineering.036` duplicate that drifts
 * the first time an agent is renamed.
 *
 * The module is client-safe by construction: its only runtime dependency
 * resolves to `RUNTIME_AGENT_IDS`, and everything else is type-only.
 */

import { getAigentQubeSource } from '@/services/iqube/legibility/sources/aigentQubeSource';

export interface VoicePersona {
  /** Who the voice says it is. */
  name: string;
  /** Spoken first line. */
  greeting: string;
  /** The voice session's system prompt. */
  systemPrompt: string;
  /** Cartesia voice id. */
  voiceId: string;
}

/**
 * The one voice currently provisioned.
 *
 * Per-agent voices are NOT configured — there is a single Cartesia voice id in
 * this codebase, and it was Marketa's. Rather than pretend otherwise, every
 * agent speaks with it until distinct voices are provisioned; what changes
 * today is WHO THE AGENT SAYS IT IS, which is what the operator reported.
 * Add entries to `VOICE_IDS` as voices are commissioned.
 */
export const DEFAULT_VOICE_ID = '694f9389-aac1-45b6-b726-9d9369183238';

/** Per-agent voice overrides. Empty until distinct voices are provisioned. */
export const VOICE_IDS: Readonly<Record<string, string>> = {};

/** The identity used when a mount passes no agent at all. */
export const FALLBACK_AGENT_ID = 'aigent-marketa';

/** Accepts 'kn0w1' or 'aigent-kn0w1'; leaves an already-canonical id alone. */
export function canonicalAgentId(id: string | null | undefined): string | null {
  const trimmed = id?.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.startsWith('aigent-') ? trimmed : `aigent-${trimmed}`;
}

/**
 * Resolve the voice identity for a copilot mount.
 *
 * `agent` is the prop the copilot already receives from its host, so the voice
 * follows the surface without any mount needing to opt in. A mount that passes
 * no agent keeps today's behaviour exactly — the fallback is Marketa — so this
 * change cannot silently alter a surface that never named its agent.
 */
export function resolveVoicePersona(
  agent?: { id?: string | null; name?: string | null } | null,
): VoicePersona {
  const id = canonicalAgentId(agent?.id) ?? FALLBACK_AGENT_ID;
  const profile = getAigentQubeSource(id);

  // Precedence: the host's own label wins (it is what the citizen SEES in the
  // header), then the canonical profile, then the id itself. Never a hardcoded
  // agent name.
  const name = agent?.name?.trim() || profile?.name?.trim() || id.replace(/^aigent-/, '');

  const role =
    profile?.description?.trim() ||
    'an AI co-pilot in the iQube platform';

  return {
    name,
    greeting: `Hey! I'm ${name}, your voice co-pilot. What would you like to do?`,
    // Same shape and brevity constraint as the prompt this replaces — only the
    // identity is now derived rather than fixed.
    systemPrompt:
      `You are ${name}. ${role} ` +
      'Help the user with their questions and tasks. Be concise, helpful, and friendly. ' +
      'Keep responses to 2-3 sentences max.',
    voiceId: VOICE_IDS[id] ?? DEFAULT_VOICE_ID,
  };
}
