/**
 * Constitutional Action Modes — source-of-truth parity canary.
 *
 * Founder Office Action Modes amendment
 * (`codexes/packs/agentiq/updates/2026-07-22_founder-office-action-modes-amendment.md`),
 * ratified 2026-07-22, built as Increment 1 of
 * `codexes/packs/agentiq/updates/2026-07-22_prd-foi-001-implementation-plan.md`.
 *
 * Mirrors the pattern in `tests/source-of-truth-parity.test.ts`
 * (`inv.engineering.036`/`037` enforcement): a `Record<K, V>` mapping is
 * exhaustive over its key union at COMPILE time, but nothing stops someone
 * from hand-editing the object literal to drop or corrupt an entry without
 * TypeScript catching it if the type annotation is loosened or the object is
 * later re-typed as `Partial<...>`. These runtime checks pin the exhaustive
 * shape so that regression is caught by the test suite, not discovered in
 * production. They also pin `OperatorArchetype`'s own union as an explicit
 * literal-regression guard — the exact silent-widening mistake this
 * discipline exists to prevent (amendment §6.1: "no deletion, no renaming,
 * no narrowing" of the existing archetype enum).
 */

import { describe, it, expect } from 'vitest';
import type { OperatorArchetype, ConstitutionalActionMode } from '../services/iqube/experienceQube';
import { VALID_ACTION_MODES } from '../services/iqube/experienceQube';
import { ACTION_MODE_ROLE, ARCHETYPE_DEFAULT_ACTION_MODES } from '../services/iqube/actionModes';

// `OperatorArchetype`'s validation set (`VALID_ARCHETYPES` in
// experienceQube.ts) is module-private by design — not exported, so it
// can't be imported here. This literal list is this test's own pinned copy
// of the ratified five values (deliberately duplicated, not derived, since
// there is no exported source to derive it from) — the point of the first
// `it()` below is to catch drift between this literal and the real enum.
const KNOWN_ARCHETYPES: OperatorArchetype[] = [
  'citizen',
  'entrepreneurial',
  'technical',
  'creative',
  'research',
];

const KNOWN_ACTION_MODES: ConstitutionalActionMode[] = [
  'Build',
  'Create',
  'Develop',
  'Research',
  'Safeguard',
];

/**
 * Compile-time exhaustiveness guard against `OperatorArchetype` silently
 * widening (e.g. promoting `protector` to a live archetype value, which the
 * amendment §3/§8.1 explicitly leaves open, NOT decided). If a future edit
 * adds a sixth literal to the real union, the `default` branch's `value`
 * stops being typed `never` and this file fails to type-check — the
 * intended enforcement point (`tsc`/CI type-check), since vitest's
 * transpile-only runner does not itself re-verify types. The runtime
 * `it()` below exercises every branch so the switch is live code, not
 * dead code a bundler could tree-shake away before type-check ever sees it.
 */
function assertArchetypeExhaustive(value: never): never {
  throw new Error(`Unhandled OperatorArchetype: ${String(value)}`);
}
function classifyArchetype(a: OperatorArchetype): true {
  switch (a) {
    case 'citizen':
    case 'entrepreneurial':
    case 'technical':
    case 'creative':
    case 'research':
      return true;
    default:
      return assertArchetypeExhaustive(a);
  }
}

describe('Constitutional Action Modes — source-of-truth parity (inv.engineering.036/037 enforcement)', () => {
  it("OperatorArchetype's own union is untouched — exactly the five ratified values, no more, no fewer", () => {
    // Regression guard against exactly the silent-widening mistake this
    // amendment's own §6.1 forbids ("no deletion, no renaming, no
    // narrowing" of the existing archetype enum). This must be updated
    // deliberately if the enum ever legitimately grows — it should never
    // pass silently on a drift.
    expect(new Set(KNOWN_ARCHETYPES).size).toBe(5);
    expect(KNOWN_ARCHETYPES.sort()).toEqual(
      ['citizen', 'creative', 'entrepreneurial', 'research', 'technical'].sort(),
    );
    for (const a of KNOWN_ARCHETYPES) {
      expect(classifyArchetype(a)).toBe(true);
    }
  });

  it('ARCHETYPE_DEFAULT_ACTION_MODES covers every OperatorArchetype value exhaustively', () => {
    const mapKeys = Object.keys(ARCHETYPE_DEFAULT_ACTION_MODES).sort();
    expect(mapKeys).toEqual([...KNOWN_ARCHETYPES].sort());
    // Every value must itself be a valid ConstitutionalActionMode (or the
    // empty set, for `citizen` — amendment §3: "citizen... maps to no
    // default mode").
    for (const archetype of KNOWN_ARCHETYPES) {
      const modes = ARCHETYPE_DEFAULT_ACTION_MODES[archetype];
      expect(Array.isArray(modes)).toBe(true);
      for (const mode of modes) {
        expect(VALID_ACTION_MODES.has(mode)).toBe(true);
      }
    }
    // Pin the exact ratified mapping (amendment §3's "Exact" rows) —
    // catches a hand-edit that swaps two archetypes' default modes.
    expect(ARCHETYPE_DEFAULT_ACTION_MODES.citizen).toEqual([]);
    expect(ARCHETYPE_DEFAULT_ACTION_MODES.entrepreneurial).toEqual(['Build']);
    expect(ARCHETYPE_DEFAULT_ACTION_MODES.technical).toEqual(['Develop']);
    expect(ARCHETYPE_DEFAULT_ACTION_MODES.creative).toEqual(['Create']);
    expect(ARCHETYPE_DEFAULT_ACTION_MODES.research).toEqual(['Research']);
  });

  it('ACTION_MODE_ROLE covers every ConstitutionalActionMode value exhaustively', () => {
    const mapKeys = Object.keys(ACTION_MODE_ROLE).sort();
    expect(mapKeys).toEqual([...KNOWN_ACTION_MODES].sort());
    expect(new Set(Object.values(ACTION_MODE_ROLE)).size).toBe(5); // no two modes share a role
    // Pin the exact ratified mode↔role names (amendment §2.0/§3).
    expect(ACTION_MODE_ROLE.Build).toBe('Builder');
    expect(ACTION_MODE_ROLE.Create).toBe('Creator');
    expect(ACTION_MODE_ROLE.Develop).toBe('Developer');
    expect(ACTION_MODE_ROLE.Research).toBe('Researcher');
    expect(ACTION_MODE_ROLE.Safeguard).toBe('Protector');
  });

  it('VALID_ACTION_MODES matches the ConstitutionalActionMode union exactly', () => {
    expect([...VALID_ACTION_MODES].sort()).toEqual([...KNOWN_ACTION_MODES].sort());
  });
});
