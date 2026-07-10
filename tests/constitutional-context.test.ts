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
import {
  mapBoundAgentRow,
  mapGrantToAssignment,
  projectConstitutionalContextT1,
} from '@/services/identity/constitutionalContext';
import type { DelegationGrantRow } from '@/services/delegation/delegationGrantStore';

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

describe('CFS-024 — pure resolver mappers (row → contract)', () => {
  it('mapBoundAgentRow marks a bound agent binding + reflects passport binding', () => {
    const bound = mapBoundAgentRow({
      id: 'agent-uuid',
      did_uri: 'did:agent:root:aletheon',
      display_name: 'Aletheon',
      agent_class: 'polity_bound',
      bound_passport_id: 'pp_123',
    });
    expect(bound.relationship).toBe('binding');
    expect(bound.passportBound).toBe(true);
    expect(bound.agentId).toBe('agent-uuid');
    expect(bound.agentDid).toBe('did:agent:root:aletheon');
  });

  it('mapBoundAgentRow: no bound passport ⇒ passportBound false', () => {
    expect(mapBoundAgentRow({ id: 'x', display_name: 'Marketa' }).passportBound).toBe(false);
  });

  it('mapGrantToAssignment derives a temporary assignment from the active grant', () => {
    const grant = {
      grant_id: 'g1',
      agent_root_did: 'did:agent:root:metaye',
      allowed_actions: ['knowledge_retrieval', 'draft_document'],
      status: 'active',
      created_at: '2026-07-10T00:00:00Z',
      expires_at: '2026-07-10T04:00:00Z',
    } as DelegationGrantRow;
    const a = mapGrantToAssignment(grant, 'persona-1', 'aigentMe');
    expect(a.relationship).toBe('assignment');
    expect(a.role).toBe('aigentMe');
    expect(a.active).toBe(true);
    expect(a.personaId).toBe('persona-1');
    expect(a.delegatedAuthority).toEqual(['knowledge_retrieval', 'draft_document']);
    expect(a.validUntil).toBe('2026-07-10T04:00:00Z');
  });

  it('projectConstitutionalContextT1 strips T0 persona/auth ids, keeps public shape', () => {
    const ctx = emptyConstitutionalContext();
    ctx.citizen.personId = 'auth-profile-T0';
    ctx.persona.personaId = 'persona-T0';
    ctx.persona.displayLabel = 'Mansa Meta';
    ctx.passport.passportId = 'pp_1';
    ctx.currentAigentMe = 'did:agent:root:metaye';
    const t1 = projectConstitutionalContextT1(ctx);
    const serialized = JSON.stringify(t1);
    expect(serialized).not.toContain('auth-profile-T0');
    expect(serialized).not.toContain('persona-T0');
    expect(t1.persona.displayLabel).toBe('Mansa Meta');
    expect(t1.passport.passportId).toBe('pp_1');
    expect(t1.currentAigentMe).toBe('did:agent:root:metaye');
    // T1 shape exposes no personaId key at all
    expect((t1 as Record<string, unknown>).persona).not.toHaveProperty('personaId');
  });
});
