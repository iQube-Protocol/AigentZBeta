/**
 * Constitutional Identity Hierarchy — contract canaries (CFS-024).
 *
 * Pins the order-constant constitutional data (the identity hierarchy, the two
 * agent relationships + their permanence, the three invariants' statements) and
 * the PURE helpers (hierarchyIndexOf, isBinding, emptyConstitutionalContext).
 * The resolver (services/identity/constitutionalContext.ts) is not exercised
 * here — it composes the impure spine and is a later phase.
 */

import { describe, it, expect } from 'vitest';
import {
  CONSTITUTIONAL_IDENTITY_HIERARCHY,
  DELEGATION_LEVEL,
  hierarchyIndexOf,
  AGENT_RELATIONSHIPS,
  RELATIONSHIP_PERMANENCE,
  isBinding,
  CONSTITUTIONAL_IDENTITY_INVARIANTS,
  emptyConstitutionalContext,
} from '@/types/constitutionalContext';

describe('CFS-024 — the constitutional identity hierarchy (order pinned)', () => {
  it('sequences citizen → passport → personhood → person → persona → agent → session → task', () => {
    expect([...CONSTITUTIONAL_IDENTITY_HIERARCHY]).toEqual([
      'citizen',
      'passport',
      'personhood',
      'person',
      'persona',
      'delegated-agent',
      'session',
      'task',
    ]);
  });

  it('places the person above personas above agents (authority flows down)', () => {
    const i = (l: string) => CONSTITUTIONAL_IDENTITY_HIERARCHY.indexOf(l as never);
    expect(i('citizen')).toBeLessThan(i('passport'));
    expect(i('passport')).toBeLessThan(i('person'));
    expect(i('person')).toBeLessThan(i('persona'));
    expect(i('persona')).toBeLessThan(i('delegated-agent'));
  });

  it('pins delegation at the PERSONA level — not citizen, not passport', () => {
    expect(DELEGATION_LEVEL).toBe('persona');
  });

  it('hierarchyIndexOf returns depth (0 = citizen) or -1 for unknown', () => {
    expect(hierarchyIndexOf('citizen')).toBe(0);
    expect(hierarchyIndexOf('delegated-agent')).toBe(5);
    expect(hierarchyIndexOf('task')).toBe(CONSTITUTIONAL_IDENTITY_HIERARCHY.length - 1);
    expect(hierarchyIndexOf('nonexistent')).toBe(-1);
  });
});

describe('CFS-024 — the two agent relationships (binding vs assignment)', () => {
  it('pins the two relationships and their permanence', () => {
    expect([...AGENT_RELATIONSHIPS]).toEqual(['binding', 'assignment']);
    expect(RELATIONSHIP_PERMANENCE.binding).toBe('permanent');
    expect(RELATIONSHIP_PERMANENCE.assignment).toBe('temporary');
  });

  it('isBinding distinguishes the permanent Citizen↔Agent relationship', () => {
    expect(isBinding('binding')).toBe(true);
    expect(isBinding('assignment')).toBe(false);
    expect(isBinding('anything-else')).toBe(false);
  });
});

describe('CFS-024 — the three constitutional invariants (statements pinned)', () => {
  it('pins the three invariant ids in order', () => {
    expect(CONSTITUTIONAL_IDENTITY_INVARIANTS.map((i) => i.id)).toEqual([
      'constitutional-agent-binding',
      'constitutional-agent-assignment',
      'constitutional-authority',
    ]);
  });

  it('binding invariant: agents permanently bound to persons via passport + personhood', () => {
    const inv = CONSTITUTIONAL_IDENTITY_INVARIANTS.find((i) => i.id === 'constitutional-agent-binding');
    expect(inv?.statement).toContain('permanently bound');
    expect(inv?.statement).toContain('Passport');
    expect(inv?.statement).toContain('Personhood');
  });

  it('authority invariant: originates from citizen, exercised through personas', () => {
    const inv = CONSTITUTIONAL_IDENTITY_INVARIANTS.find((i) => i.id === 'constitutional-authority');
    expect(inv?.statement).toContain('originates from the citizen');
    expect(inv?.statement).toContain('exercised through Personas');
  });
});

describe('CFS-024 — emptyConstitutionalContext (honest nulls, never faked)', () => {
  it('returns fully-null context with empty rosters', () => {
    const ctx = emptyConstitutionalContext();
    expect(ctx.citizen.personId).toBeNull();
    expect(ctx.passport.passportId).toBeNull();
    expect(ctx.standing.overall).toBeNull();
    expect(ctx.persona.personaId).toBeNull();
    expect(ctx.boundAgents).toEqual([]);
    expect(ctx.assignedAgent).toBeNull();
    expect(ctx.currentAigentMe).toBeNull();
    expect(ctx.session.sessionId).toBeNull();
  });

  it('a fresh empty context has no shared mutable roster (new array each call)', () => {
    const a = emptyConstitutionalContext();
    const b = emptyConstitutionalContext();
    expect(a.boundAgents).not.toBe(b.boundAgents);
  });
});
