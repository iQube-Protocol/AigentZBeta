/**
 * aigentMe role resolution — Homecoming Phase II WP-A Increment 2, extended
 * WPA-3 (operator brief 2026-08-17, "selected aigentMe must speak as the
 * selected Agent").
 *
 * "aigentMe" is a ROLE, not a fixed identity (operator-directed three-axis
 * model, codexes/packs/agentiq/updates/2026-08-16_homecoming-phase-ii-activation-pack.md
 * WP-A Amendment). WHO fulfils that role for a given persona is already
 * resolved, server-side, by the existing `currentAigentMe` field on
 * `ConstitutionalContext` (services/identity/constitutionalContext.ts) —
 * itself derived from `persona_agent_assignments` (role='aigentMe'), falling
 * back to the legacy `agent_root_identity.is_aigent_me` flag. This module
 * adds NO new persistence and NO new authority check — it only translates
 * that already-resolved assignment into the identity whose system prompt
 * should back the aigentMe Copilot's response for this turn.
 *
 * Resolution order (WPA-3 — generic, no per-agent branching):
 *   1. GENERIC: hydrateAgentExecutionContext(bound.agentId) (P0 Item 2)
 *      resolves the assigned Agent's own agent_card_slug. If
 *      personas['aigent-' + agentCardSlug] exists — the SAME convention
 *      RUNTIME_AGENT_IDS/REGISTRABLE_AGENTS already use — that IS her own
 *      registered persona/system instructions. This is what makes an
 *      arbitrary assigned Agent (not just a fixed specialist list) speak in
 *      her own voice.
 *   2. LEGACY FALLBACK (preserved, never removed): the original
 *      display-name → specialist-id → personaKey match, for any specialist
 *      whose personas[] key doesn't follow the agentCardSlug convention
 *      (e.g. Quill: slug would be 'quill', but her real key is 'aigent-q').
 *   3. DEFAULT: the generic aigentMe identity, exactly as before — no
 *      assignment, no resolvable identity, or any resolution error.
 *
 * Before WPA-3, tier 1 didn't exist — only tier 2 ran, so any assigned
 * Agent NOT in the fixed ~10-entry specialist label map (services/agents/
 * specialistRouter.ts's SPECIALIST_LABELS) silently fell back to the
 * generic aigentMe identity regardless of having a real personas[] entry.
 * Aletheon happens to be in both today, so this was maskable — the defect
 * only became visible in practice, matching the operator's report.
 *
 * Authority discipline: this module answers ONLY "whose voice speaks as
 * aigentMe." It never reads or implies `delegation_grants` — selecting an
 * agent for this role grants it nothing. Callers that need to know what the
 * resolved agent may DO must still go through the existing bounded-delegation
 * gate (services/access/evaluateAccess.ts + delegation_grants) — unchanged
 * by this module.
 */

import type { NextRequest } from 'next/server';
import { personas } from '@/app/data/personas';
import { resolveConstitutionalContext } from '@/services/identity/constitutionalContext';
import { specialistIdForLabel, personaKeyForSpecialist, type SpecialistId } from '@/services/agents/specialistRouter';
import { hydrateAgentExecutionContext } from '@/services/agents/hydrateAgentExecutionContext';

export interface ResolvedAigentMeIdentity {
  /** The personas[] key whose systemPrompt should back this turn's response. */
  personaKey: keyof typeof personas;
  /** The specialist fulfilling the role, or null for the Default aigentMe. */
  specialistId: SpecialistId | null;
  /** Human-facing label for the resolved identity. */
  displayLabel: string;
  /** The bound agent_root_identity id currently assigned as aigentMe, or null. */
  agentRootId: string | null;
}

export const DEFAULT_AIGENT_ME_IDENTITY: ResolvedAigentMeIdentity = {
  personaKey: 'aigent-me',
  specialistId: null,
  displayLabel: 'aigentMe',
  agentRootId: null,
};

/**
 * Resolve WHO fulfils the aigentMe role for the authenticated caller,
 * server-side, from the existing `currentAigentMe` assignment — never from
 * a client-supplied agent identity. Fails open to the Default identity on
 * any resolution gap (no assignment, assignment doesn't map to a registered
 * persona, or resolution errors) rather than failing the chat turn: this is
 * a voice/routing choice, not a security gate, so failing open here is
 * correct — the security gate is bounded delegation, resolved separately.
 */
export async function resolveAigentMeIdentity(request: NextRequest): Promise<ResolvedAigentMeIdentity> {
  try {
    const ctx = await resolveConstitutionalContext(request);
    if (!ctx.currentAigentMe) return DEFAULT_AIGENT_ME_IDENTITY;
    const bound = ctx.boundAgents.find((a) => a.agentId === ctx.currentAigentMe);
    if (!bound) return DEFAULT_AIGENT_ME_IDENTITY;

    // Tier 1 — generic: any assigned Agent with her own registered persona
    // speaks with it, regardless of whether she is also a fixed specialist.
    const hydrated = await hydrateAgentExecutionContext(bound.agentId).catch(() => null);
    const candidateKey = hydrated?.agentCardSlug ? `aigent-${hydrated.agentCardSlug}` : null;
    if (candidateKey && candidateKey in personas) {
      return {
        personaKey: candidateKey as keyof typeof personas,
        specialistId: specialistIdForLabel(bound.displayName),
        displayLabel: hydrated?.displayName ?? bound.displayName,
        agentRootId: bound.agentId,
      };
    }

    // Tier 2 — legacy fallback: preserved exactly as before.
    const specialistId = specialistIdForLabel(bound.displayName);
    if (specialistId) {
      const personaKey = personaKeyForSpecialist(specialistId);
      if (personaKey) {
        return {
          personaKey,
          specialistId,
          displayLabel: bound.displayName,
          agentRootId: bound.agentId,
        };
      }
    }

    // Tier 3 — no resolvable identity for this assigned Agent yet.
    return DEFAULT_AIGENT_ME_IDENTITY;
  } catch {
    return DEFAULT_AIGENT_ME_IDENTITY;
  }
}
