/**
 * Constitutional role validation tests — Operation Chrysalis Phase 0
 *
 * Enforces the invariants of the AgentiQ Constitution of Aigents:
 * - Four canonical roles exist with correct properties
 * - Authority matrix is complete and consistent
 * - Escalation paths are valid
 * - Aigent classification logic is correct
 * - Constitutional principles are complete
 * - Governance decisions are well-formed
 */

import {
  CONSTITUTIONAL_PRINCIPLES,
  SOVEREIGN_ROLES,
  METAME_GUARDIAN,
  AIGENT_ME,
  AIGENT_C,
  AIGENT_Z,
  ESCALATION_MATRIX,
  getSovereignRole,
  getRoleByRuntimeId,
  getEscalationPaths,
  hasAuthority,
  classifyAgent,
  GOVERNANCE_DECISIONS,
  getDecision,
  getDecisionsByDomain,
  getActiveDecisions,
  CONSTITUTIONAL_ENTITIES,
  getConstitutionalEntity,
} from '@/services/governance';

// ─── Constitutional principles ──────────────────────────────────────────────

describe('Constitutional Principles', () => {
  it('has exactly 7 ratified principles', () => {
    expect(CONSTITUTIONAL_PRINCIPLES).toHaveLength(7);
  });

  it('sovereignty_first is the first principle', () => {
    expect(CONSTITUTIONAL_PRINCIPLES[0].id).toBe('sovereignty_first');
    expect(CONSTITUTIONAL_PRINCIPLES[0].statement).toBe('Sovereignty precedes fulfillment.');
  });

  it('all principles have non-empty id and statement', () => {
    for (const p of CONSTITUTIONAL_PRINCIPLES) {
      expect(p.id).toBeTruthy();
      expect(p.statement).toBeTruthy();
      expect(p.statement.endsWith('.')).toBe(true);
    }
  });
});

// ─── Sovereign roles ────────────────────────────────────────────────────────

describe('Sovereign Agent Roles', () => {
  it('registry contains exactly 4 constitutional roles', () => {
    expect(Object.keys(SOVEREIGN_ROLES)).toHaveLength(4);
  });

  const expectedRoles: string[] = ['metame_guardian', 'aigentMe', 'aigentC', 'aigentZ'];

  it.each(expectedRoles)('role %s exists in the registry', (roleId) => {
    const role = getSovereignRole(roleId);
    expect(role).toBeDefined();
    expect(role.constitutionalId).toBe(roleId);
    expect(role.purpose).toBeTruthy();
    expect(role.primaryQuestion).toBeTruthy();
    expect(role.responsibilities.length).toBeGreaterThan(0);
    expect(role.authority.length).toBeGreaterThan(0);
  });

  it('metaMe Guardian is the only role with veto authority', () => {
    expect(METAME_GUARDIAN.canVeto).toBe(true);
    expect(AIGENT_ME.canVeto).toBe(false);
    expect(AIGENT_C.canVeto).toBe(false);
    expect(AIGENT_Z.canVeto).toBe(false);
  });

  it('metaMe Guardian has no escalation target (top of hierarchy)', () => {
    expect(METAME_GUARDIAN.escalatesTo).toBeNull();
  });

  it('all non-guardian roles escalate to metaMe Guardian', () => {
    expect(AIGENT_ME.escalatesTo).toBe('metame_guardian');
    expect(AIGENT_C.escalatesTo).toBe('metame_guardian');
    expect(AIGENT_Z.escalatesTo).toBe('metame_guardian');
  });

  it('metaMe Guardian has all absolute-scope authority', () => {
    for (const grant of METAME_GUARDIAN.authority) {
      expect(grant.scope).toBe('absolute');
      expect(grant.requires_guardian_approval).toBe(false);
    }
  });

  it('non-guardian roles have bounded-scope authority', () => {
    for (const role of [AIGENT_ME, AIGENT_C, AIGENT_Z]) {
      for (const grant of role.authority) {
        expect(grant.scope).toBe('bounded');
      }
    }
  });

  it('brands match constitutional spec', () => {
    expect(METAME_GUARDIAN.brand).toBe('myGuard');
    expect(AIGENT_ME.brand).toBe('metaMe');
    expect(AIGENT_C.brand).toBe('aigentC');
    expect(AIGENT_Z.brand).toBe('AgentiQ');
  });

  it('primary questions match constitutional spec', () => {
    expect(METAME_GUARDIAN.primaryQuestion).toBe('Is this action compatible with sovereignty?');
    expect(AIGENT_ME.primaryQuestion).toBe('What is best for this individual?');
    expect(AIGENT_C.primaryQuestion).toBe('What is best for the collective?');
    expect(AIGENT_Z.primaryQuestion).toBe('What is best for the ecosystem?');
  });
});

// ─── Authority matrix ───────────────────────────────────────────────────────

describe('Authority Matrix', () => {
  it('guardian has veto_authority', () => {
    const result = hasAuthority('metame_guardian', 'veto_authority');
    expect(result.authorized).toBe(true);
    expect(result.scope).toBe('absolute');
  });

  it('aigentZ has platform_operations', () => {
    const result = hasAuthority('aigentZ', 'platform_operations');
    expect(result.authorized).toBe(true);
    expect(result.scope).toBe('bounded');
  });

  it('aigentZ does NOT have veto_authority', () => {
    const result = hasAuthority('aigentZ', 'veto_authority');
    expect(result.authorized).toBe(false);
  });

  it('aigentC does NOT have platform_operations', () => {
    const result = hasAuthority('aigentC', 'platform_operations');
    expect(result.authorized).toBe(false);
  });

  it('aigentMe does NOT have registry_stewardship', () => {
    const result = hasAuthority('aigentMe', 'registry_stewardship');
    expect(result.authorized).toBe(false);
  });

  it('aigentZ infrastructure_continuity requires guardian approval', () => {
    const result = hasAuthority('aigentZ', 'infrastructure_continuity');
    expect(result.authorized).toBe(true);
    expect(result.requiresGuardian).toBe(true);
  });
});

// ─── Escalation matrix ──────────────────────────────────────────────────────

describe('Escalation Matrix', () => {
  it('has escalation paths defined', () => {
    expect(ESCALATION_MATRIX.length).toBeGreaterThan(0);
  });

  it('all escalation paths reference valid roles', () => {
    const validRoles = new Set(Object.keys(SOVEREIGN_ROLES));
    for (const path of ESCALATION_MATRIX) {
      expect(validRoles.has(path.from)).toBe(true);
      expect(validRoles.has(path.to)).toBe(true);
    }
  });

  it('aigentZ can escalate to metame_guardian', () => {
    const paths = getEscalationPaths('aigentZ');
    const toGuardian = paths.find(p => p.to === 'metame_guardian');
    expect(toGuardian).toBeDefined();
    expect(toGuardian!.resolution).toBe('veto');
  });

  it('no role escalates FROM metame_guardian (top of hierarchy)', () => {
    const paths = getEscalationPaths('metame_guardian');
    expect(paths).toHaveLength(0);
  });
});

// ─── Runtime role mapping ───────────────────────────────────────────────────

describe('Runtime Role Mapping', () => {
  it('maps metame-guardian runtime id to metaMe Guardian', () => {
    const role = getRoleByRuntimeId('metame-guardian');
    expect(role).toBeDefined();
    expect(role!.constitutionalId).toBe('metame_guardian');
  });

  it('maps aigent-z runtime id to aigentZ', () => {
    const role = getRoleByRuntimeId('aigent-z');
    expect(role).toBeDefined();
    expect(role!.constitutionalId).toBe('aigentZ');
  });

  it('returns undefined for unknown runtime ids', () => {
    const role = getRoleByRuntimeId('specialist');
    expect(role).toBeUndefined();
  });
});

// ─── Aigent classification ──────────────────────────────────────────────────

describe('Aigent Classification', () => {
  it('fully passported agent is classified as aigent', () => {
    const result = classifyAgent({
      hasPassport: true,
      hasRootDid: true,
      hasReputationRecord: true,
      aigentHandle: '@marketa.aigent',
    });
    expect(result.isAigent).toBe(true);
    expect(result.standing).toBe('recognized_participant');
    expect(result.handle).toBe('@marketa.aigent');
  });

  it('agent without passport is NOT an aigent', () => {
    const result = classifyAgent({
      hasPassport: false,
      hasRootDid: true,
      hasReputationRecord: true,
      aigentHandle: '@test.aigent',
    });
    expect(result.isAigent).toBe(false);
    expect(result.standing).toBe('none');
  });

  it('agent without handle is NOT an aigent', () => {
    const result = classifyAgent({
      hasPassport: true,
      hasRootDid: true,
      hasReputationRecord: true,
      aigentHandle: null,
    });
    expect(result.isAigent).toBe(false);
    expect(result.standing).toBe('none');
  });

  it('agent missing any single requirement is NOT an aigent', () => {
    const incomplete = [
      { hasPassport: false, hasRootDid: true, hasReputationRecord: true, aigentHandle: '@x.aigent' },
      { hasPassport: true, hasRootDid: false, hasReputationRecord: true, aigentHandle: '@x.aigent' },
      { hasPassport: true, hasRootDid: true, hasReputationRecord: false, aigentHandle: '@x.aigent' },
      { hasPassport: true, hasRootDid: true, hasReputationRecord: true, aigentHandle: null },
    ];
    for (const params of incomplete) {
      expect(classifyAgent(params).isAigent).toBe(false);
    }
  });
});

// ─── Governance decision log ────────────────────────────────────────────────

describe('Governance Decision Log', () => {
  it('has Operation Chrysalis founding decisions', () => {
    const chrysalis = GOVERNANCE_DECISIONS.filter(d => d.initiative === 'Operation Chrysalis');
    expect(chrysalis.length).toBeGreaterThanOrEqual(7);
  });

  it('all decisions have required fields', () => {
    for (const d of GOVERNANCE_DECISIONS) {
      expect(d.id).toMatch(/^GD-\d{3}$/);
      expect(d.title).toBeTruthy();
      expect(d.domain).toBeTruthy();
      expect(d.status).toBeTruthy();
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(d.summary).toBeTruthy();
      expect(d.rationale).toBeTruthy();
    }
  });

  it('GD-001 ratifies agency as constitutional principle', () => {
    const d = getDecision('GD-001');
    expect(d).toBeDefined();
    expect(d!.status).toBe('ratified');
    expect(d!.domain).toBe('constitutional');
  });

  it('constitutional decisions are retrievable by domain', () => {
    const constitutional = getDecisionsByDomain('constitutional');
    expect(constitutional.length).toBeGreaterThanOrEqual(3);
  });

  it('all founding decisions are active (ratified)', () => {
    const active = getActiveDecisions();
    expect(active.length).toBe(GOVERNANCE_DECISIONS.length);
  });

  it('all decisions have sovereignty impact classification', () => {
    const validLevels = new Set(['benefits', 'neutral', 'constrains']);
    for (const d of GOVERNANCE_DECISIONS) {
      expect(d.sovereigntyImpact).toBeDefined();
      expect(validLevels.has(d.sovereigntyImpact.me)).toBe(true);
      expect(validLevels.has(d.sovereigntyImpact.c)).toBe(true);
      expect(validLevels.has(d.sovereigntyImpact.z)).toBe(true);
    }
  });

  it('all decisions have constitutional basis', () => {
    for (const d of GOVERNANCE_DECISIONS) {
      expect(d.constitutionalBasis).toBeTruthy();
    }
  });

  it('all founding decisions are registry-ready', () => {
    for (const d of GOVERNANCE_DECISIONS) {
      expect(d.registryReady).toBe(true);
    }
  });
});

// ─── Sovereignty Impact Classification ────────────────────────────────────

describe('Sovereignty Impact Classification', () => {
  it('GD-001 constrains Z (prevents agency as runtime principal)', () => {
    const d = getDecision('GD-001');
    expect(d!.sovereigntyImpact.z).toBe('constrains');
    expect(d!.sovereigntyImpact.me).toBe('benefits');
  });

  it('GD-002 benefits all agencies (establishes representation for each)', () => {
    const d = getDecision('GD-002');
    expect(d!.sovereigntyImpact.me).toBe('benefits');
    expect(d!.sovereigntyImpact.c).toBe('benefits');
    expect(d!.sovereigntyImpact.z).toBe('benefits');
  });

  it('GD-003 constrains Z (passport requirement on aigents)', () => {
    const d = getDecision('GD-003');
    expect(d!.sovereigntyImpact.z).toBe('constrains');
  });
});

// ─── Constitutional Registry Integration Stub ─────────────────────────────

describe('Constitutional Entity Registry', () => {
  it('has exactly 4 constitutional entities', () => {
    expect(CONSTITUTIONAL_ENTITIES).toHaveLength(4);
  });

  it('all constitutional roles have corresponding entities', () => {
    const roleIds: string[] = ['metame_guardian', 'aigentMe', 'aigentC', 'aigentZ'];
    for (const id of roleIds) {
      const entity = getConstitutionalEntity(id);
      expect(entity).toBeDefined();
      expect(entity!.constitutionalId).toBe(id);
      expect(entity!.registryRegistered).toBe(true);
    }
  });

  it('all entities have @aigent handles', () => {
    for (const entity of CONSTITUTIONAL_ENTITIES) {
      expect(entity.aigentHandle).toMatch(/^@\w+\.aigent$/);
    }
  });

  it('sovereign roles are not passport-required (they are foundational)', () => {
    for (const entity of CONSTITUTIONAL_ENTITIES) {
      expect(entity.passportRequired).toBe(false);
    }
  });

  it('entity handles match expected values', () => {
    expect(getConstitutionalEntity('metame_guardian')!.aigentHandle).toBe('@myguard.aigent');
    expect(getConstitutionalEntity('aigentMe')!.aigentHandle).toBe('@metame.aigent');
    expect(getConstitutionalEntity('aigentC')!.aigentHandle).toBe('@aigentc.aigent');
    expect(getConstitutionalEntity('aigentZ')!.aigentHandle).toBe('@agentz.aigent');
  });
});
