/**
 * aigentMe role resolution — Homecoming Phase II WP-A Increment 2.
 *
 * "aigentMe" is a ROLE, not a fixed identity (operator-directed three-axis
 * model, codexes/packs/agentiq/updates/2026-08-16_homecoming-phase-ii-activation-pack.md
 * WP-A Amendment). WHO fulfils that role for a given persona is already
 * resolved, server-side, by the existing `currentAigentMe` field on
 * `ConstitutionalContext` (services/identity/constitutionalContext.ts) —
 * itself derived from `persona_agent_assignments` (role='aigentMe'), falling
 * back to the legacy `agent_root_identity.is_aigent_me` flag. This module
 * adds NO new persistence and NO new authority check — it only translates
 * that already-resolved assignment into the specialist identity whose
 * system prompt should back the aigentMe Copilot's response for this turn.
 *
 * Why the translation is a display-name match, not a lookup table: the
 * assignment stores an `agent_root_identity` row id, which carries a
 * `display_name` but no specialist-id column (adding one would be a schema
 * change, out of scope for this increment). `specialistIdForLabel` derives
 * from the specialist router's own label map, so this stays in sync with it
 * automatically rather than hand-duplicating a second registry.
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
 * any resolution gap (no assignment, assignment doesn't map to a wired
 * specialist yet, or resolution errors) rather than failing the chat turn:
 * this is a voice/routing choice, not a security gate, so failing open here
 * is correct — the security gate is bounded delegation, resolved separately.
 */
export async function resolveAigentMeIdentity(request: NextRequest): Promise<ResolvedAigentMeIdentity> {
  try {
    const ctx = await resolveConstitutionalContext(request);
    if (!ctx.currentAigentMe) return DEFAULT_AIGENT_ME_IDENTITY;
    const bound = ctx.boundAgents.find((a) => a.agentId === ctx.currentAigentMe);
    if (!bound) return DEFAULT_AIGENT_ME_IDENTITY;
    const specialistId = specialistIdForLabel(bound.displayName);
    if (!specialistId) return DEFAULT_AIGENT_ME_IDENTITY;
    const personaKey = personaKeyForSpecialist(specialistId);
    if (!personaKey) return DEFAULT_AIGENT_ME_IDENTITY;
    return {
      personaKey,
      specialistId,
      displayLabel: bound.displayName,
      agentRootId: bound.agentId,
    };
  } catch {
    return DEFAULT_AIGENT_ME_IDENTITY;
  }
}
