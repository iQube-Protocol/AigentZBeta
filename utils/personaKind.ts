/**
 * Canonical human-vs-agent persona classification (Homecoming Phase II,
 * operator brief 2026-08-16 — "Persona-Type Cleanup").
 *
 * The ONLY authoritative signal is the persisted `world_id_status` field
 * (personas table / `worldIdStatus` on the API-shaped PersonaState),
 * written at persona-creation time. `'agent_declared'` means the persona
 * was created to represent a bound/sponsored Agent; anything else
 * (`'unverified'`, `'verified_human'`, absent) is a human persona.
 *
 * Never infer kind from display name, FIO handle, FIO domain, or any other
 * naming convention — a human persona named "ArcAgent" is still human, and
 * an agent persona is still an agent regardless of what it's called. This
 * predicate replaces the duplicated `name.includes('agent')`-style
 * heuristics previously hand-maintained in PersonaSelector.tsx and
 * useSupabaseSessionPersonas.ts (both wrong) and mirrors the one already
 * correct in DiDQubeIdentityCard.tsx / admin/reputation/page.tsx (both now
 * migrated to this shared helper instead of a local copy).
 */

export type WorldIdStatus = 'unverified' | 'verified_human' | 'agent_declared' | null | undefined;

export type PersonaKind = 'human' | 'agent';

// Accepts plain `string` too (not just the narrow WorldIdStatus literal
// union) — several call sites read this off a DB row typed as `string`
// (e.g. Supabase select results before narrowing). The comparison is exact
// equality against 'agent_declared' either way, so a wider input type loses
// no precision.
export function getPersonaKind(worldIdStatus: WorldIdStatus | string): PersonaKind {
  return worldIdStatus === 'agent_declared' ? 'agent' : 'human';
}

export function isAgentPersonaKind(worldIdStatus: WorldIdStatus | string): boolean {
  return getPersonaKind(worldIdStatus) === 'agent';
}
