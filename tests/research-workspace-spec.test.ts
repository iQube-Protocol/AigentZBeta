/**
 * SPEC-IRL-WORKSPACE-001 canaries — the IRL Research Workspace.
 *
 * WHAT THIS FILE IS FOR. The spec names nine required canaries and twelve
 * acceptance criteria. Both lists exist because the workspace is an ACCESS
 * surface over research in progress: the failure modes are "a reviewer could
 * edit the thing they were reviewing", "a cohort saw another cohort's work",
 * and "a draft was mistaken for the record" — none of which throw, and all of
 * which look fine on screen.
 *
 * TWO DISCIPLINES CARRIED FROM THE EXISTING WORKSPACE CANARIES.
 *
 *  1. EXACT SETS, NEVER COUNTS, and always through the REAL filter
 *     (`getEnabledTabs`). A `toBeGreaterThan(0)` stays green while the wrong
 *     tabs survive.
 *  2. EVERY DENIAL SUITE CARRIES A POSITIVE REACHABILITY PATH (ruling C,
 *     2026-07-28: "a denial-only suite proves exclusion, not availability" — a
 *     surface reachable by NOBODY passes every denial canary at its maximum).
 *     Each denial block below opens with the caller who MUST get through.
 *
 * AND ONE THE OPERATOR ADDED AFTER FOUR FALSE SURVIVORS ON THIS CODEBASE:
 * EXERCISE GATES, DO NOT GREP FOR THEM. Where a source assertion is genuinely
 * the only way to pin something (a derivation being derived, a document saying
 * what the code says), it is paired with a behavioural assertion that drives
 * the real function.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  tabPassesAccessGates,
  satisfiesParticipationGate,
  satisfiesWorkspaceScope,
  scopesGrantedIn,
  type ParticipationAccessState,
} from '../services/passport/participationTabGate';
import {
  DOMAIN_ROLES,
  DOMAIN_STEWARD_ROLES,
  resolveInvitationAuthority,
  issuableRoles,
} from '../services/passport/participationAccess';
import {
  RESEARCH_WORKSPACES,
  ASSIGNABLE_RESEARCH_WORKSPACES,
  researchWorkspaceLabel,
  researchWorkspaceChildren,
  researchWorkspaceParticipationRoles,
} from '../services/research/researchWorkspace';
import {
  RESEARCH_WORKSPACE_VIEWS,
  RESEARCH_WORKSPACE_ADMIN_VIEW,
  RESEARCH_WORKSPACE_ROLE_IDS,
} from '../services/research/researchWorkspaceViews';
import {
  RESEARCH_WORKSPACE_ROLE_AUTHORITY,
  SPEC_ROLE_TO_SUBSTRATE,
} from '../services/research/researchWorkspaceRoles';
import {
  lockerAdmissionRefusals,
  isLockerAdmissible,
  partitionMaterials,
  workspaceSurfaceAuthority,
  WORKSPACE_SURFACE_AUTHORITY,
  type WorkspaceMaterial,
} from '../services/research/workspaceMaterials';
import {
  WORKSPACE_LIFECYCLE_TEMPLATES,
  getLifecycleTemplate,
  WORKSPACE_TYPES,
  DEFAULT_WORKSPACE_VISIBILITY,
} from '../services/experiments/workspaceLifecycle';
import {
  experimentWorkspaceFromResearch,
  experimentWorkspaceFromPartner,
  listExperimentWorkspaces,
} from '../services/experiments/experimentWorkspace';
import { PARTNER_WORKSPACES, PARTNER_WORKSPACE_PHASES } from '../services/venture/partnerWorkspace';
import {
  evaluateStudentContribution,
  PERMITTED_RESEARCH_STANDING_BASES,
  STANDING_ACCRUAL_DEPENDENCY,
} from '../services/research/studentContribution';
import {
  evaluateTradingStandingSignal,
  PERMITTED_STANDING_BASES,
} from '../services/venture/trading/standingAdmission';
import { readSource, stripComments } from './_lib/sourceAuthority';

const SPEC_PATH = 'codexes/packs/irl/foundation/SPEC-IRL-WORKSPACE-001_research-workspace.md';
const spec = () => readFileSync(join(process.cwd(), SPEC_PATH), 'utf8');

const access = (
  grants: Array<{ accessDomain: string; role: string; allowedScopes?: string[] | null }>,
): ParticipationAccessState => ({ loaded: true, grants });

/** Every workspace-group slug this caller reaches, through the REAL filter. */
async function reachable(a: ParticipationAccessState, isAdmin = false): Promise<string[]> {
  const { IRL_CARTRIDGE } = await import('../data/codex-configs');
  const { getEnabledTabs } = await import('../app/hooks/useCodexConfig');
  return getEnabledTabs(
    IRL_CARTRIDGE,
    isAdmin,
    false,
    false,
    new Set(),
    { isGlobalAdmin: isAdmin, cartridgeSlugs: new Set() },
    a,
  )
    .filter((t) => t.group === 'workspace')
    .map((t) => t.slug)
    .sort();
}

// The three Autonomi experiment workspaces and the two Lehigh cohorts, by id.
const EXP_P1 = 'autonomi-review-exp-p1';
const EXP_P2 = 'autonomi-review-exp-p2';
const CS_COHORT = 'lehigh-cs-capstone';
const MFE_COHORT = 'lehigh-mfe-capstone';
const CS_PROJECT = 'lehigh-cs-software-build';
const OTHER_CS_PROJECT = 'lehigh-cs-agent-integration';

// ═══════════════════════════════════════════════════════════════════════════
// AC-1/2/3 — one engine, configuration-driven, Venture Lab unchanged
// ═══════════════════════════════════════════════════════════════════════════

describe('AC-1..3 — one workspace engine, configured not forked', () => {
  it('both Labs project onto the SAME spine type, from their own registries', () => {
    const venture = PARTNER_WORKSPACES.map(experimentWorkspaceFromPartner);
    const research = RESEARCH_WORKSPACES.map(experimentWorkspaceFromResearch);
    expect(venture.length).toBeGreaterThan(0);
    expect(research.length).toBeGreaterThan(0);
    // Every field of the shared primitive is present on both halves — the test
    // that the engine is genuinely common rather than a research-shaped type
    // with a venture branch bolted on.
    for (const ws of [...venture, ...research]) {
      expect(WORKSPACE_TYPES, `${ws.id} has an unknown workspaceType`).toContain(ws.workspaceType);
      expect(getLifecycleTemplate(ws.lifecycleTemplateId), `${ws.id}'s lifecycle does not resolve`).toBeTruthy();
      expect(Array.isArray(ws.institutionRefs)).toBe(true);
      expect(['private', 'invited', 'public']).toContain(ws.visibility);
      expect(ws.parentWorkspaceId === null || typeof ws.parentWorkspaceId === 'string').toBe(true);
    }
    // And one list holds them both.
    const all = listExperimentWorkspaces().map((w) => w.id);
    for (const ws of [...venture, ...research]) expect(all).toContain(ws.id);
  });

  it('AC-3 — the Venture Lab projection is unchanged in every field it had', () => {
    // The criterion the operator gated this work on. Asserted on VALUES, not on
    // the absence of a diff: these are the fields the venture projection
    // produced before the primitive grew, and every one must still hold.
    for (const partner of PARTNER_WORKSPACES) {
      const ws = experimentWorkspaceFromPartner(partner);
      expect(ws.id).toBe(partner.id);
      expect(ws.label).toBe(`${partner.partnerName} — Pilot Series ${partner.series}`);
      expect(ws.domain).toBe('venture');
      expect(ws.experimentClass).toBe('hybrid');
      expect(ws.objectives).toEqual(partner.objectives);
      expect(ws.participation.domain).toBe('venture-lab');
      expect([...ws.participation.roles].sort()).toEqual(
        [
          'workspace-steward', 'partner-operator', 'technical-contributor',
          'communications-contributor', 'observer', 'agent-participant',
        ].sort(),
      );
      expect(ws.evidence.cartridge).toBe('venture-lab');
      // The NEW fields must be derived from what the partner registry already
      // said — never newly authored, or the "unchanged" claim is hollow.
      expect(ws.workspaceType).toBe('pilot');
      expect(ws.parentWorkspaceId).toBeNull();
      expect(ws.institutionRefs).toEqual([partner.partnerName]);
      expect(ws.visibility).toBe('private');
      // The stage must be a real member of the template it names.
      const template = getLifecycleTemplate(ws.lifecycleTemplateId)!;
      expect(template.stages, `${ws.id}'s stage is not in its own template`).toContain(ws.currentStage);
    }
  });

  it('the venture lifecycle template is DERIVED from the phase ladder, not transcribed', () => {
    const template = getLifecycleTemplate('venture-pilot')!;
    expect(template.stages.length).toBe(PARTNER_WORKSPACE_PHASES.length);
    // Same members, same ORDER — a template that reordered the ladder would
    // narrate the pilot's progress wrongly while every count stayed right.
    expect(template.stages.map((s) => s.toLowerCase().replace(/ /g, '-'))).toEqual([
      ...PARTNER_WORKSPACE_PHASES,
    ]);
    const src = stripComments(readSource('services/experiments/workspaceLifecycle.ts'));
    expect(src, 'the venture ladder was hand-listed').toMatch(/PARTNER_WORKSPACE_PHASES\.map/);
  });

  it('AC-2 — research behaviour is configuration: no research branch in the spine', () => {
    const src = stripComments(readSource('services/experiments/experimentWorkspace.ts'));
    // The spine may PROJECT each half; it must not decide research policy.
    // Roles, lifecycle, hierarchy and institutions all come from the registry.
    expect(src).toMatch(/researchWorkspaceParticipationRoles\(research\)/);
    expect(src).toMatch(/lifecycleTemplateId: research\.lifecycleTemplateId/);
    expect(src).toMatch(/workspaceType: research\.workspaceType/);
    // Behavioural half: changing the registry's type changes the projection,
    // with no edit to the spine.
    const cohort = RESEARCH_WORKSPACES.find((w) => w.workspaceType === 'cohort')!;
    const experiment = RESEARCH_WORKSPACES.find((w) => w.workspaceType === 'experiment')!;
    expect(experimentWorkspaceFromResearch(cohort).participation.roles).toEqual(
      researchWorkspaceParticipationRoles(cohort),
    );
    expect(experimentWorkspaceFromResearch(experiment).participation.roles).toEqual(
      researchWorkspaceParticipationRoles(experiment),
    );
    expect(researchWorkspaceParticipationRoles(cohort)).not.toEqual(
      researchWorkspaceParticipationRoles(experiment),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE FIRST ACCEPTANCE CASE — end to end, in one test
// ═══════════════════════════════════════════════════════════════════════════

describe('the first acceptance case — an invited Autonomi reviewer', () => {
  const reviewer = access([
    { accessDomain: 'research-lab', role: 'reviewer', allowedScopes: [EXP_P1] },
  ]);

  it('reaches EXP-P1: review package, scoped QubeTalk, and the Locker artefacts', async () => {
    // POSITIVE REACHABILITY FIRST (ruling C). Every denial below is only
    // meaningful because this passes.
    const slugs = await reachable(reviewer);
    expect(slugs).toContain('irl-workspace-review');
    expect(slugs).toContain('irl-workspace-qubetalk');
    expect(slugs).toContain('irl-workspace-locker');
    expect(slugs).toContain('irl-workspace-overview');
    // …and the workspace behind those tabs actually opens for the SAME caller.
    // Passing the tab gate and then finding an empty picker is the same
    // invisible surface from the reviewer's seat.
    expect(satisfiesWorkspaceScope(reviewer, 'research-lab', EXP_P1, false)).toBe(true);
    expect(scopesGrantedIn(reviewer, 'research-lab', false)).toEqual([EXP_P1]);
  });

  it('WITHOUT gaining authority to alter, freeze or canonise the experiment', async () => {
    // The other half of the same sentence, from three independent directions.
    // 1 — the role authority table.
    const authority = RESEARCH_WORKSPACE_ROLE_AUTHORITY.reviewer;
    expect(authority.mayEditWorkingMaterials).toBe(false);
    expect(authority.mayFreeze).toBe(false);
    expect(authority.mayCanonize).toBe(false);
    expect(authority.mayPublish).toBe(false);
    expect(authority.mayGrantStanding).toBe(false);
    expect(authority.mayEditSourceAssets).toBe(false);
    // 2 — the navigation: no Working Materials entrance at all (MS-9).
    const slugs = await reachable(reviewer);
    expect(slugs, 'a reviewer reached the mutable working area').not.toContain('irl-workspace-materials');
    expect(slugs, 'a reviewer reached access administration').not.toContain('irl-workspace-participants');
    expect(slugs, 'a reviewer reached the Tier-0 internal space').not.toContain(
      RESEARCH_WORKSPACE_ADMIN_VIEW.slug,
    );
    // 3 — the gate itself refuses, not merely the filter.
    const { IRL_CARTRIDGE } = await import('../data/codex-configs');
    const materials = IRL_CARTRIDGE.tabs.find(
      (t: { slug: string }) => t.slug === 'irl-workspace-materials',
    )!;
    expect(satisfiesParticipationGate(materials, reviewer, false)).toBe(false);
  });

  it('AC-4 — and reaches ONLY the experiment they were assigned', () => {
    // Sibling experiments, the parent programme, and an unrelated cohort are
    // all denied by the SAME scope check the route enforces server-side.
    for (const other of [EXP_P2, 'autonomi-review-exp-p3', 'autonomi-independent-review-programme', CS_COHORT]) {
      expect(
        satisfiesWorkspaceScope(reviewer, 'research-lab', other, false),
        `an EXP-P1 reviewer opened '${other}'`,
      ).toBe(false);
    }
    // The picker must not even LIST what it cannot open (MS-9).
    expect(scopesGrantedIn(reviewer, 'research-lab', false)).not.toContain(EXP_P2);
  });

  it('the three experiments are SEPARATE workspaces — or AC-4 would be unstateable', () => {
    // If the programme were one workspace, "assigned to EXP-P1 but not EXP-P2"
    // could not be expressed and the canary above would be vacuous.
    const children = researchWorkspaceChildren('autonomi-independent-review-programme');
    expect(children.map((c) => c.id).sort()).toEqual([EXP_P1, EXP_P2, 'autonomi-review-exp-p3'].sort());
    for (const c of children) {
      expect(c.workspaceType).toBe('experiment');
      expect(c.experimentId, `${c.id} names no experiment`).toBeTruthy();
    }
    // Each names a DISTINCT experiment — three workspaces onto one experiment
    // would isolate nothing.
    expect(new Set(children.map((c) => c.experimentId)).size).toBe(children.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-6 / AC-7 — Faculty Lead and Student isolation
// ═══════════════════════════════════════════════════════════════════════════

describe('AC-6 — a Faculty Lead administers their own programme only', () => {
  const facultyCs = access([
    { accessDomain: 'research-lab', role: 'faculty-lead', allowedScopes: [CS_COHORT, CS_PROJECT, OTHER_CS_PROJECT] },
  ]);

  it('POSITIVE — reaches their own cohort and its projects, and the admin surfaces', async () => {
    const slugs = await reachable(facultyCs);
    expect(slugs).toContain('irl-workspace-participants');
    expect(slugs).toContain('irl-workspace-materials');
    expect(slugs).toContain('irl-workspace-review');
    expect(satisfiesWorkspaceScope(facultyCs, 'research-lab', CS_COHORT, false)).toBe(true);
    expect(satisfiesWorkspaceScope(facultyCs, 'research-lab', CS_PROJECT, false)).toBe(true);
  });

  it('DENIAL — cannot enter the other capstone, its projects, or any experiment', () => {
    for (const other of [MFE_COHORT, 'lehigh-mfe-pricing', EXP_P1, 'irl-validation-programme-vp1']) {
      expect(
        satisfiesWorkspaceScope(facultyCs, 'research-lab', other, false),
        `the CS Faculty Lead entered '${other}'`,
      ).toBe(false);
    }
    expect(scopesGrantedIn(facultyCs, 'research-lab', false).sort()).toEqual(
      [CS_COHORT, CS_PROJECT, OTHER_CS_PROJECT].sort(),
    );
  });

  it('their INVITATION authority is bounded to their own scopes, both directions', () => {
    // The one gate this work widens. Driven through the real resolver.
    const authority = resolveInvitationAuthority(false, facultyCs.grants);
    expect(authority.tier).toBe('delegated');
    expect(authority.domains).toEqual(['research-lab']);
    expect(authority.scopes['research-lab']).toEqual([CS_COHORT, CS_PROJECT, OTHER_CS_PROJECT]);
    // Not 'all' — a delegated authority that resolved to 'all' would be a
    // platform admin wearing a cohort's name.
    expect(authority.scopes['research-lab']).not.toBe('all');
    // And no reach into any other domain.
    expect(authority.domains).not.toContain('venture-lab');
    expect(authority.scopes['venture-lab']).toBeUndefined();
  });

  it('a Faculty Lead cannot confer a steward role — nor another Faculty Lead', () => {
    const issuable = issuableRoles('research-lab', 'delegated');
    expect(issuable, 'a delegated inviter can appoint a Faculty Lead').not.toContain('faculty-lead');
    expect(issuable, 'a delegated inviter can appoint a Research Steward').not.toContain('research-steward');
    // They CAN invite the roles they exist to invite, or the widening bought
    // nothing and this suite would pass with the authority removed entirely.
    expect(issuable).toContain('student-researcher');
    expect(issuable).toContain('research-participant');
    // Both steward roles are declared, so the subtraction above has something
    // to subtract.
    expect([...DOMAIN_STEWARD_ROLES['research-lab']].sort()).toEqual(
      ['faculty-lead', 'research-steward'].sort(),
    );
  });

  it('a Faculty Lead CANNOT write Standing — grading and Standing do not collapse', () => {
    // Operator ruling: a grade is an institutional judgement, Standing is a
    // constitutional one. The Faculty Lead is the ONLY role that grades, and
    // still holds no Standing authority.
    const faculty = RESEARCH_WORKSPACE_ROLE_AUTHORITY['faculty-lead'];
    expect(faculty.mayAwardGrade).toBe(true);
    expect(faculty.mayGrantStanding).toBe(false);
    // Exactly one grading role, or "the Faculty Lead grades" means nothing.
    const graders = RESEARCH_WORKSPACE_ROLE_IDS.filter(
      (r) => RESEARCH_WORKSPACE_ROLE_AUTHORITY[r].mayAwardGrade,
    );
    expect(graders).toEqual(['faculty-lead']);
    // NO role may grant Standing — the literal `false` on all seven.
    for (const role of RESEARCH_WORKSPACE_ROLE_IDS) {
      expect(
        RESEARCH_WORKSPACE_ROLE_AUTHORITY[role].mayGrantStanding,
        `'${role}' can grant Standing by an act of authority`,
      ).toBe(false);
    }
    // And no grading path may reach the admission gate.
    const src = stripComments(readSource('services/research/studentContribution.ts'));
    expect(src, 'the contribution gate accepts a grade').not.toMatch(/\bgrade\b\s*[:?]/);
  });
});

describe('AC-7 — a student reaches only their assigned project', () => {
  const student = access([
    { accessDomain: 'research-lab', role: 'student-researcher', allowedScopes: [CS_PROJECT] },
  ]);

  it('POSITIVE — reaches their project and the surfaces they work in', async () => {
    const slugs = await reachable(student);
    expect(slugs).toContain('irl-workspace-materials');
    expect(slugs).toContain('irl-workspace-locker');
    expect(slugs).toContain('irl-workspace-qubetalk');
    expect(satisfiesWorkspaceScope(student, 'research-lab', CS_PROJECT, false)).toBe(true);
  });

  it('DENIAL — cannot enter a sibling project, the cohort, or the other capstone', () => {
    for (const other of [OTHER_CS_PROJECT, CS_COHORT, MFE_COHORT, 'lehigh-mfe-pricing', EXP_P1]) {
      expect(
        satisfiesWorkspaceScope(student, 'research-lab', other, false),
        `a student scoped to one project opened '${other}'`,
      ).toBe(false);
    }
    // NO SCOPE DESCENT: being scoped to a project does not confer the parent,
    // and a parent scope does not confer the children. Both directions.
    const cohortScoped = access([
      { accessDomain: 'research-lab', role: 'student-researcher', allowedScopes: [CS_COHORT] },
    ]);
    expect(satisfiesWorkspaceScope(cohortScoped, 'research-lab', CS_PROJECT, false)).toBe(false);
  });

  it('DENIAL — a student never reaches Review or access administration', async () => {
    const slugs = await reachable(student);
    expect(slugs).not.toContain('irl-workspace-review');
    expect(slugs).not.toContain('irl-workspace-participants');
    expect(slugs).not.toContain(RESEARCH_WORKSPACE_ADMIN_VIEW.slug);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-5 — the unauthorised observer, and the fail-closed floor
// ═══════════════════════════════════════════════════════════════════════════

describe('an unauthorised observer is denied — with a positive path beside it', () => {
  it('POSITIVE — a correctly scoped Institutional Observer reaches the agreed views', async () => {
    const observer = access([
      { accessDomain: 'research-lab', role: 'research-participant', allowedScopes: [EXP_P1] },
    ]);
    const slugs = await reachable(observer);
    expect(slugs.length, 'the observer path is reachable by nobody').toBeGreaterThan(0);
    expect(slugs).toContain('irl-workspace-overview');
    expect(slugs).toContain('irl-workspace-qubetalk');
    expect(satisfiesWorkspaceScope(observer, 'research-lab', EXP_P1, false)).toBe(true);
  });

  it('DENIAL — an observer changes nothing, and never reaches Review, Materials or Locker', async () => {
    const observer = access([
      { accessDomain: 'research-lab', role: 'research-participant', allowedScopes: [EXP_P1] },
    ]);
    const slugs = await reachable(observer);
    for (const denied of ['irl-workspace-review', 'irl-workspace-materials', 'irl-workspace-locker', 'irl-workspace-participants']) {
      expect(slugs, `an observer reached '${denied}'`).not.toContain(denied);
    }
    const authority = RESEARCH_WORKSPACE_ROLE_AUTHORITY['research-participant'];
    for (const power of ['mayDefineExperiments', 'mayAdministerAccess', 'maySubmitReviewDecision', 'mayEditWorkingMaterials', 'mayAwardGrade'] as const) {
      expect(authority[power], `an observer holds ${power}`).toBe(false);
    }
  });

  it('DENIAL — no grant, an unloaded grant, and a foreign domain all reach nothing', async () => {
    expect(await reachable(access([]))).toEqual([]);
    expect(await reachable({ loaded: false, grants: [] })).toEqual([]);
    expect(
      await reachable(access([{ accessDomain: 'venture-lab', role: 'workspace-steward', allowedScopes: [EXP_P1] }])),
    ).toEqual([]);
    // …and an UNSCOPED research grant opens zero workspaces (deny-by-default).
    const unscoped = access([{ accessDomain: 'research-lab', role: 'reviewer' }]);
    expect(scopesGrantedIn(unscoped, 'research-lab', false)).toEqual([]);
    expect(satisfiesWorkspaceScope(unscoped, 'research-lab', EXP_P1, false)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-8 — Working Materials and Locker state remain distinct
// ═══════════════════════════════════════════════════════════════════════════

describe('AC-8 — Working Materials cannot masquerade as Locker artefacts', () => {
  const base: Omit<WorkspaceMaterial, 'materialClass' | 'frozen' | 'contentCommitment'> = {
    id: 'm1',
    workspaceId: CS_PROJECT,
    label: 'Capstone analysis',
  };

  it('POSITIVE — a frozen, committed, authoritative artefact IS admitted', () => {
    // Without this the whole block would pass with a gate that refuses
    // everything, which is the "reachable by nobody" defect in artefact form.
    const record: WorkspaceMaterial = {
      ...base,
      materialClass: 'authoritative',
      frozen: true,
      contentCommitment: 'a'.repeat(64),
    };
    expect(lockerAdmissionRefusals(record)).toEqual([]);
    expect(isLockerAdmissible(record)).toBe(true);
  });

  it('a working material is refused FOR WHAT IT IS, even dressed as a record', () => {
    // THE MASQUERADE. Not a draft that forgot a field — a draft carrying every
    // field a record carries. It must still be refused, and refused for its
    // class specifically.
    const masquerade: WorkspaceMaterial = {
      ...base,
      materialClass: 'working',
      frozen: true,
      contentCommitment: 'b'.repeat(64),
    };
    expect(isLockerAdmissible(masquerade)).toBe(false);
    expect(lockerAdmissionRefusals(masquerade)).toContain(
      'working-material-is-not-an-authoritative-artefact:working',
    );
  });

  it('an authoritative artefact that is unfrozen or uncommitted is refused too', () => {
    expect(
      lockerAdmissionRefusals({ ...base, materialClass: 'authoritative', frozen: false, contentCommitment: 'c'.repeat(64) }),
    ).toEqual(['not-frozen']);
    expect(
      lockerAdmissionRefusals({ ...base, materialClass: 'authoritative', frozen: true }),
    ).toEqual(['no-content-commitment']);
  });

  it('the partition fails toward the MUTABLE side — a draft never renders as the record', () => {
    const materials: WorkspaceMaterial[] = [
      { ...base, id: 'draft', materialClass: 'working', frozen: false },
      { ...base, id: 'masquerade', materialClass: 'working', frozen: true, contentCommitment: 'd'.repeat(64) },
      { ...base, id: 'unfrozen', materialClass: 'authoritative', frozen: false },
      { ...base, id: 'record', materialClass: 'authoritative', frozen: true, contentCommitment: 'e'.repeat(64) },
    ];
    const { working, locker } = partitionMaterials(materials);
    expect(locker.map((m) => m.id)).toEqual(['record']);
    expect(working.map((m) => m.id).sort()).toEqual(['draft', 'masquerade', 'unfrozen'].sort());
    // No material is lost or duplicated by the split.
    expect(working.length + locker.length).toBe(materials.length);
  });

  it('the Working Materials surface cannot promote its own contents', () => {
    expect(workspaceSurfaceAuthority('working-materials').mayAdmitToLocker).toBe(false);
    // Exactly one surface may admit, or "only the Locker admits" is not a rule.
    const admitting = Object.keys(WORKSPACE_SURFACE_AUTHORITY).filter(
      (s) => WORKSPACE_SURFACE_AUTHORITY[s].mayAdmitToLocker,
    );
    expect(admitting).toEqual(['locker']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-9 — QubeTalk cannot directly change governed state
// ═══════════════════════════════════════════════════════════════════════════

describe('AC-9 — QubeTalk is deliberation, never a decision', () => {
  it('the QubeTalk surface may not mutate governed state, nor admit to the Locker', () => {
    const qubetalk = workspaceSurfaceAuthority('qubetalk');
    expect(qubetalk.mayMutateGovernedState).toBe(false);
    expect(qubetalk.mayAdmitToLocker).toBe(false);
  });

  it('POSITIVE — some surface CAN mutate governed state, or the rule is vacuous', () => {
    // A table where nothing may act would pass the canary above and mean
    // nothing. The surfaces that own governed acts must really own them.
    const mutating = Object.keys(WORKSPACE_SURFACE_AUTHORITY)
      .filter((s) => WORKSPACE_SURFACE_AUTHORITY[s].mayMutateGovernedState)
      .sort();
    expect(mutating).toEqual(['administration', 'participants', 'review'].sort());
  });

  it('every declared view has a declared authority — no surface falls through', () => {
    const views = [...RESEARCH_WORKSPACE_VIEWS.map((v) => v.id), RESEARCH_WORKSPACE_ADMIN_VIEW.id].sort();
    expect(Object.keys(WORKSPACE_SURFACE_AUTHORITY).sort()).toEqual(views);
  });

  it('an UNKNOWN surface fails closed rather than returning undefined', () => {
    const unknown = workspaceSurfaceAuthority('not-a-surface');
    expect(unknown.mayMutateGovernedState).toBe(false);
    expect(unknown.mayAdmitToLocker).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-10 / AC-11 — receipts, and publication as an explicit act
// ═══════════════════════════════════════════════════════════════════════════

describe('AC-10/11 — receipts exist, and nothing is public by default', () => {
  it('the workspace’s evidence action types are all DVN-anchorable', () => {
    const pipeline = readSource('services/dvn/activityReceiptDvnPipeline.ts');
    for (const rw of RESEARCH_WORKSPACES) {
      const ws = experimentWorkspaceFromResearch(rw);
      for (const actionType of ws.evidence.actionTypes) {
        expect(
          pipeline,
          `'${actionType}' is workspace evidence but is not in ANCHORABLE_ACTION_TYPES`,
        ).toContain(`'${actionType}'`);
      }
    }
    // The independent-review receipt — the consequential decision of the first
    // acceptance case — is anchorable too.
    expect(pipeline).toContain("'independent_review_completed'");
  });

  it('AC-11 — no research workspace is public, and the default is the closed end', () => {
    expect(DEFAULT_WORKSPACE_VISIBILITY).not.toBe('public');
    for (const rw of RESEARCH_WORKSPACES) {
      const ws = experimentWorkspaceFromResearch(rw);
      expect(ws.visibility, `${rw.id} is public without a publication act`).not.toBe('public');
    }
    // And a workspace that declares nothing gets the default, not 'public'.
    const undeclared = RESEARCH_WORKSPACES.find((w) => w.visibility === undefined)!;
    expect(experimentWorkspaceFromResearch(undeclared).visibility).toBe(DEFAULT_WORKSPACE_VISIBILITY);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-12 — no workspace joins navigation without a reachable entrance
// ═══════════════════════════════════════════════════════════════════════════

describe('AC-12 — every workspace has a reachable entrance', () => {
  it('every registered workspace is grantable AND opens for a real caller', async () => {
    // Ruling C, generalised over the whole registry: a workspace that no grant
    // can be scoped to is reachable by nobody, and every denial canary in this
    // file would still pass at its maximum.
    const assignable = new Set(ASSIGNABLE_RESEARCH_WORKSPACES.map((w) => w.id));
    for (const rw of RESEARCH_WORKSPACES) {
      expect(assignable, `${rw.id} cannot be scoped to by any invitation`).toContain(rw.id);
      // Pick a role the workspace's own TYPE admits, scope it, and open it.
      const role = researchWorkspaceParticipationRoles(rw)[0];
      expect(role, `${rw.id} admits no role at all`).toBeTruthy();
      const a = access([{ accessDomain: 'research-lab', role, allowedScopes: [rw.id] }]);
      expect(
        satisfiesWorkspaceScope(a, 'research-lab', rw.id, false),
        `${rw.id} cannot be opened by a caller scoped to it`,
      ).toBe(true);
      expect(
        (await reachable(a)).length,
        `${rw.id}'s admitted role '${role}' reaches no view`,
      ).toBeGreaterThan(0);
      // And it renders a name rather than its id.
      expect(researchWorkspaceLabel(rw)).not.toBe(rw.id);
    }
  });

  it('the shipped IRL tab group IS the eight views plus Tier 0, in spec order', async () => {
    const { IRL_CARTRIDGE } = await import('../data/codex-configs');
    const tabs = IRL_CARTRIDGE.tabs.filter((t: { group?: string }) => t.group === 'workspace');
    expect(tabs.map((t: { slug: string }) => t.slug)).toEqual([
      ...RESEARCH_WORKSPACE_VIEWS.map((v) => v.slug),
      RESEARCH_WORKSPACE_ADMIN_VIEW.slug,
    ]);
    // Every view carries the domain gate; only Tier 0 carries adminOnly.
    for (const t of tabs as Array<{ slug: string; adminOnly?: boolean; participationDomain?: string; participationRoles?: string[] }>) {
      if (t.slug === RESEARCH_WORKSPACE_ADMIN_VIEW.slug) {
        expect(t.adminOnly).toBe(true);
        continue;
      }
      expect(t.adminOnly, `${t.slug} took an admin gate`).toBeFalsy();
      expect(t.participationDomain, `${t.slug} lost its domain gate`).toBe('research-lab');
      expect((t.participationRoles ?? []).length, `${t.slug} admits every role`).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SPEC-DOCUMENT PARITY — the code and the ruling cannot drift apart
// ═══════════════════════════════════════════════════════════════════════════

describe('spec parity — the document and the implementation say the same thing', () => {
  it('the two pipeline templates match the spec’s §7 stage lists exactly', () => {
    // Derivation is impossible here — the spec IS the upstream — so this is the
    // parity canary CLAUDE.md prescribes in that case. Parsed from the arrow
    // lists in the document, not from a copy in this file.
    const doc = spec();
    // Scoped to §7 and to INLINE spans: the document also contains fenced
    // blocks with arrows (the hierarchy, the public-extension path), and an
    // unscoped backtick match pairs a fence delimiter with an inline one and
    // swallows whole sections.
    const section = doc.slice(doc.indexOf('**Pipeline templates.**'), doc.indexOf('## 8 —'));
    const arrows = [...section.matchAll(/`([^`]*→[^`]*)`/g)].map((m) =>
      m[1]
        .replace(/\s+/g, ' ') // the lists wrap across lines in the document
        .split('→')
        .map((s) => s.trim())
        .filter(Boolean),
    );
    const experiment = arrows.find((a) => a[0] === 'Concept');
    const capstone = arrows.find((a) => a[0] === 'Brief');
    expect(experiment, 'the experiment pipeline is not in the spec document').toBeTruthy();
    expect(capstone, 'the capstone pipeline is not in the spec document').toBeTruthy();
    expect(getLifecycleTemplate('research-experiment')!.stages).toEqual(experiment);
    expect(getLifecycleTemplate('capstone')!.stages).toEqual(capstone);
  });

  it('the eight views match the spec’s §7 table, by name', () => {
    const doc = spec();
    const section = doc.slice(doc.indexOf('## 7 — The eight views'), doc.indexOf('## 8 —'));
    const named = [...section.matchAll(/^\| \*\*([^*]+)\*\* \|/gm)].map((m) => m[1].trim());
    expect(named.length, 'the spec §7 table did not parse').toBe(8);
    expect(RESEARCH_WORKSPACE_VIEWS.map((v) => v.label)).toEqual(named);
  });

  it('the six roles match the spec’s §8 table, and all resolve to real substrate roles', () => {
    const doc = spec();
    const section = doc.slice(doc.indexOf('## 8 — Six roles'), doc.indexOf('## 9 —'));
    const named = [...section.matchAll(/^\| \*\*([^*]+)\*\* \|/gm)].map((m) => m[1].trim());
    expect(named.length, 'the spec §8 table did not parse').toBe(6);
    expect(Object.keys(SPEC_ROLE_TO_SUBSTRATE).sort()).toEqual([...named].sort());
    for (const [specName, substrate] of Object.entries(SPEC_ROLE_TO_SUBSTRATE)) {
      expect(DOMAIN_ROLES['research-lab'], `'${specName}' maps to a role that does not exist`).toContain(substrate);
      expect(RESEARCH_WORKSPACE_ROLE_AUTHORITY[substrate], `'${substrate}' has no authority record`).toBeTruthy();
    }
  });

  it('the constitutional rule is recorded verbatim', () => {
    // Blockquote prefixes and line wrapping normalised away — the RULE is the
    // sentence, not its typography.
    const doc = spec().replace(/^>\s?/gm, '').replace(/\s+/g, ' ');
    expect(doc).toContain(
      'must not fork the underlying access, communication, artefact, receipt or workspace machinery',
    );
    expect(doc).toContain('they do not confer authority to freeze, canonise or publish');
  });

  it('the spec is registered in the IRL pack index — or nobody can read it', () => {
    const collections = JSON.parse(
      readFileSync(join(process.cwd(), 'codexes/packs/irl/collections.json'), 'utf8'),
    ) as { collections: Array<{ id: string; items: string[] }> };
    const foundation = collections.collections.find((c) => c.id === 'col_foundation')!;
    expect(foundation.items).toContain('foundation/SPEC-IRL-WORKSPACE-001_research-workspace.md');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// STANDING — the V-10 gate, extended to research contributions
// ═══════════════════════════════════════════════════════════════════════════

describe('student contributions earn Standing — through the ONE V-10 gate', () => {
  const rigorous = () =>
    evaluateStudentContribution({
      contributionId: 'c-1',
      workspaceId: CS_PROJECT,
      contributorRef: 'a1b2c3d4e5f60718',
      proposedBases: ['correctness', 'veracity', 'reproducibility'],
      evidenceRefs: ['ev-1'],
      verdict: { complete: true, outcomeClass: 'executed-complete', unauthorisedExpansion: false },
    });

  const negativeResult = () =>
    evaluateStudentContribution({
      contributionId: 'c-neg',
      workspaceId: CS_PROJECT,
      contributorRef: 'a1b2c3d4e5f60718',
      proposedBases: ['negative-result-reporting', 'veracity'],
      evidenceRefs: ['ev-2'],
      verdict: { complete: true, outcomeClass: 'executed-complete', unauthorisedExpansion: false },
    });

  const voluminousUnverified = () =>
    evaluateStudentContribution({
      contributionId: 'c-vol',
      workspaceId: CS_PROJECT,
      contributorRef: 'a1b2c3d4e5f60718',
      proposedBases: ['submission-count', 'artefact-count', 'page-count', 'commit-count'],
      evidenceRefs: ['ev-3'],
      verdict: { complete: false, outcomeClass: 'executed-incomplete', unauthorisedExpansion: false },
    });

  it('POSITIVE — a rigorous, evidenced, verified contribution is admitted', () => {
    const d = rigorous();
    expect(d.admissible).toBe(true);
    expect(d.weight ?? 0).toBeGreaterThan(0);
    expect(d.lane).toBe('personal');
  });

  it('THE PAIRED CANARY — volume never outranks rigour, including a NEGATIVE result', () => {
    // The academic form of V-10's own paired canary. Stated as an ORDERING, so
    // re-scaling the weight table cannot invert it silently.
    const volume = voluminousUnverified().weight ?? 0;
    expect(volume).toBe(0);
    expect(voluminousUnverified().admissible).toBe(false);
    expect(rigorous().weight ?? 0).toBeGreaterThan(volume);
    // A correctly reported negative result outranks the voluminous submission
    // too — the outcome the conventional incentive punishes.
    expect(negativeResult().admissible).toBe(true);
    expect(negativeResult().weight ?? 0).toBeGreaterThan(volume);
  });

  it('honest negative reporting sits at PARITY with the best positive basis', () => {
    // Publication bias is the research analogue of "profit outranks a correct
    // refusal". A negative-result claim must not be structurally cheaper.
    const negOnly = evaluateStudentContribution({
      contributionId: 'c-n', workspaceId: CS_PROJECT, contributorRef: 'a1b2c3d4e5f60718',
      proposedBases: ['negative-result-reporting'], evidenceRefs: ['ev'],
    });
    const correctOnly = evaluateStudentContribution({
      contributionId: 'c-c', workspaceId: CS_PROJECT, contributorRef: 'a1b2c3d4e5f60718',
      proposedBases: ['correctness'], evidenceRefs: ['ev'],
    });
    expect(negOnly.admissible).toBe(true);
    expect(negOnly.weight).toBe(correctOnly.weight);
  });

  it('each research volume metric is refused BY NAME, not merely unrecognised', () => {
    for (const basis of ['submission-count', 'artefact-count', 'resubmission-count', 'page-count', 'word-count', 'commit-count', 'hours-logged']) {
      const d = evaluateStudentContribution({
        contributionId: 'c', workspaceId: CS_PROJECT, contributorRef: 'a1b2c3d4e5f60718',
        proposedBases: [basis], evidenceRefs: ['ev'],
      });
      expect(d.admissible, `'${basis}' was admitted into Standing`).toBe(false);
      expect(d.refusalReasons).toContain(`prohibited-basis:${basis}`);
    }
  });

  it('a volume metric adds ZERO weight to an otherwise-good claim', () => {
    const clean = evaluateStudentContribution({
      contributionId: 'c', workspaceId: CS_PROJECT, contributorRef: 'a1b2c3d4e5f60718',
      proposedBases: ['correctness'], evidenceRefs: ['ev'],
    });
    const padded = evaluateStudentContribution({
      contributionId: 'c', workspaceId: CS_PROJECT, contributorRef: 'a1b2c3d4e5f60718',
      proposedBases: ['correctness', 'submission-count', 'page-count'], evidenceRefs: ['ev'],
    });
    expect(padded.weight).toBe(clean.weight);
    expect(padded.refusalReasons).toContain('prohibited-basis:submission-count');
  });

  it('attribution is a COMMITMENT — a raw persona id is refused, not sanitised', () => {
    const d = evaluateStudentContribution({
      contributionId: 'c', workspaceId: CS_PROJECT,
      contributorRef: '9e5b0c73-1d84-42af-b607-8c25f31a94d6',
      proposedBases: ['correctness'], evidenceRefs: ['ev'],
    });
    expect(d.admissible).toBe(false);
    expect(d.refusalReasons).toContain('agentRef-is-a-raw-identifier-not-a-commitment');
  });

  it('an unevidenced claim is inadmissible however good its bases', () => {
    const d = evaluateStudentContribution({
      contributionId: 'c', workspaceId: CS_PROJECT, contributorRef: 'a1b2c3d4e5f60718',
      proposedBases: ['correctness', 'veracity'], evidenceRefs: [],
    });
    expect(d.admissible).toBe(false);
    expect(d.refusalReasons).toContain('no-evidence');
  });

  it('ONE GATE — the research path is the same function the venture path calls', () => {
    // Behavioural, not a grep: the same claim through both entry points must
    // produce an identical decision. A forked research gate would drift the
    // moment either side changed, and this is what would catch it.
    const viaResearch = evaluateStudentContribution({
      contributionId: 'opp-1', workspaceId: CS_PROJECT, contributorRef: 'a1b2c3d4e5f60718',
      proposedBases: ['correctness', 'proof-quality'], evidenceRefs: ['ev-1'], lane: 'personal',
    });
    const viaVenture = evaluateTradingStandingSignal({
      opportunityId: 'opp-1', agentRef: 'a1b2c3d4e5f60718',
      proposedBases: ['correctness', 'proof-quality'], lane: 'personal', evidenceRefs: ['ev-1'],
    });
    expect(viaResearch).toEqual(viaVenture);
    // And there is no second gate module.
    const src = stripComments(readSource('services/research/studentContribution.ts'));
    expect(src, 'the research path re-implements the gate').toMatch(/evaluateStandingSignal\(/);
    for (const forbidden of ['PROHIBITED_STANDING_BASES =', 'refusalReasons.push', 'MAX_STANDING_SIGNAL_WEIGHT']) {
      expect(src, `studentContribution.ts re-implements ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('the research basis list is DERIVED from the gate’s table, never a second list', () => {
    const src = stripComments(readSource('services/research/studentContribution.ts'));
    expect(src).toMatch(/Object\.keys\(PERMITTED_STANDING_BASES\)/);
    expect(PERMITTED_RESEARCH_STANDING_BASES.length).toBeGreaterThan(0);
    // Narrower than the full table — the fail-closed direction.
    expect(PERMITTED_RESEARCH_STANDING_BASES.length).toBeLessThan(
      Object.keys(PERMITTED_STANDING_BASES).length,
    );
    // A venture-shaped basis is not offered to a research claim.
    expect(PERMITTED_RESEARCH_STANDING_BASES).not.toContain('correct-refusal');
    expect(PERMITTED_RESEARCH_STANDING_BASES).toContain('negative-result-reporting');
  });

  it('ADMITTED IS NOT ACCRUED — the Slice C dependency is recorded, not stubbed', () => {
    expect(STANDING_ACCRUAL_DEPENDENCY).toMatch(/Slice C/);
    const src = stripComments(readSource('services/research/studentContribution.ts'));
    // No write path, no score, no accrual — an admitted-but-unaccrued signal is
    // honest; a fake accrual that appears to work is the harder defect.
    for (const forbidden of ['getSupabaseServer', 'crm_persona_reputation', 'accrueStanding', 'insert(']) {
      expect(src, `studentContribution.ts performs an accrual (${forbidden})`).not.toContain(forbidden);
    }
  });

  it('only the roles that DO the work may earn — an observer and a grader cannot', () => {
    expect(RESEARCH_WORKSPACE_ROLE_AUTHORITY['student-researcher'].mayEarnStanding).toBe(true);
    expect(RESEARCH_WORKSPACE_ROLE_AUTHORITY['research-participant'].mayEarnStanding).toBe(false);
    expect(RESEARCH_WORKSPACE_ROLE_AUTHORITY['faculty-lead'].mayEarnStanding).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// REUSE — no second anything
// ═══════════════════════════════════════════════════════════════════════════

describe('SPEC §16 — the reuse register holds', () => {
  it('the research workspace surface is the SHARED component, not a second one', async () => {
    const { IRL_CARTRIDGE } = await import('../data/codex-configs');
    const tabs = IRL_CARTRIDGE.tabs.filter((t: { group?: string }) => t.group === 'workspace');
    for (const t of tabs as Array<{ slug: string; config: { component: string; props?: Record<string, unknown> } }>) {
      expect(t.config.component, `${t.slug} mounts a second implementation`).toBe('PartnerProgrammesTab');
      expect(t.config.props?.workspaceDomain).toBe('research');
    }
  });

  it('the IRL tab group is BUILT from the view registry, not hand-listed', () => {
    const src = stripComments(readSource('data/codex-configs.ts'));
    expect(src, 'the workspace group was hand-listed again').toMatch(
      /\.\.\.RESEARCH_WORKSPACE_VIEWS\.map\(/,
    );
    // The behavioural half is the tab-order assertion in AC-12 above: adding a
    // view to the registry moves the shipped config, with no edit here.
  });

  it('no research-only Locker, chat, role engine or task engine was introduced', () => {
    const materials = stripComments(readSource('services/research/workspaceMaterials.ts'));
    // The boundary module decides admissibility; it must not store anything.
    for (const forbidden of ['getSupabaseServer', 'createOrGetChannel', 'from(']) {
      expect(materials, `workspaceMaterials.ts became a store (${forbidden})`).not.toContain(forbidden);
    }
    // The surface mounts the existing capabilities.
    const surface = stripComments(readSource('app/triad/components/codex/tabs/PartnerProgrammesTab.tsx'));
    expect(surface).toMatch(/<LockerTab \/>/);
    expect(surface).toMatch(/<QubeTalkInboxTab domainFilter=\{accessDomain\}/);
    expect(surface).toMatch(/<StewardParticipationTab initialDomain=\{accessDomain\}/);
  });

  it('every lifecycle template id a workspace names resolves in the ONE registry', () => {
    const ids = new Set(WORKSPACE_LIFECYCLE_TEMPLATES.map((t) => t.id));
    for (const rw of RESEARCH_WORKSPACES) {
      expect(ids, `${rw.id} names lifecycle '${rw.lifecycleTemplateId}'`).toContain(rw.lifecycleTemplateId);
      if (rw.currentStage) {
        expect(
          getLifecycleTemplate(rw.lifecycleTemplateId)!.stages,
          `${rw.id}'s stage '${rw.currentStage}' is not in its template`,
        ).toContain(rw.currentStage);
      }
    }
  });
});
