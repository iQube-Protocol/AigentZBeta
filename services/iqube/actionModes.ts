/**
 * Constitutional Action Mode ↔ Role map, and the archetype → default
 * mode-set seed — Founder Office Action Modes amendment §2.0/§3
 * (`codexes/packs/agentiq/updates/2026-07-22_founder-office-action-modes-amendment.md`),
 * ratified 2026-07-22, built as Increment 1 of
 * `codexes/packs/agentiq/updates/2026-07-22_prd-foi-001-implementation-plan.md`.
 *
 * A new, standalone module rather than folding into `experienceQube.ts`
 * (qube persistence) or `standingScore.ts` (standing computation): this
 * mapping is read by at least three unrelated call sites once later
 * increments ship — the setup wizard's default-seed logic, the aigentMe
 * observer's session seed (`app/hooks/useSmartTriadContext.ts`), and the
 * NBE reranker's weighting pass — none of which owns this concern. A single
 * source-of-truth module avoids a hand-duplicated mapping table at each read
 * site, per CLAUDE.md's source-of-truth-parity discipline
 * (`inv.engineering.036`/`037`).
 *
 * Non-negotiable per the amendment's ratification record:
 *   - This is a WEIGHTING SIGNAL / UX seed only. It does not replace, gate,
 *     or narrow `OperatorArchetype`, Standing, billing, entitlements, or the
 *     Research SKU.
 *   - `citizen` has no default Action Mode — it is the baseline identity
 *     every persona already has, not a peer of the five modes (amendment §3).
 */

import type { ConstitutionalActionMode, OperatorArchetype } from '@/services/iqube/experienceQube';

/**
 * The Role a citizen occupies while executing or intending to act along a
 * given Action Mode (amendment §2.0's three-layer model: Citizen → Action
 * Mode → Role). Derived from the active mode — not a separately-set field.
 */
export type ConstitutionalActionRole = 'Builder' | 'Creator' | 'Developer' | 'Researcher' | 'Protector';

/** Action Mode → Role. Exhaustive over `ConstitutionalActionMode` (amendment §2.0/§3). */
export const ACTION_MODE_ROLE: Record<ConstitutionalActionMode, ConstitutionalActionRole> = {
  Build: 'Builder',
  Create: 'Creator',
  Develop: 'Developer',
  Research: 'Researcher',
  Safeguard: 'Protector',
};

/**
 * Archetype → default Action Mode set — the read-time seed a persona's
 * first session in the new UX derives from (amendment §6.1: "Archetype
 * remains the default/derived mode-set seed... a read-time derivation, not
 * a write to the archetype record itself"). `citizen` seeds an empty set
 * per §3's own row: a citizen with no other mode active is simply not
 * currently doing Founder-Office-scoped work.
 *
 * Exhaustive over `OperatorArchetype` — see `tests/action-modes-parity.test.ts`
 * for the runtime canary guarding against a manually-broken map (and against
 * `OperatorArchetype` itself silently widening).
 */
export const ARCHETYPE_DEFAULT_ACTION_MODES: Record<OperatorArchetype, ConstitutionalActionMode[]> = {
  citizen: [],
  entrepreneurial: ['Build'],
  technical: ['Develop'],
  creative: ['Create'],
  research: ['Research'],
};
