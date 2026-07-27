/**
 * ExperimentWorkspace spine canaries — Horizen Phase 2 (audit Amendment A §A.5,
 * Amendment B §B.5, Amendment D Principle 3).
 *
 * The base audit named the failure mode this spine exists to avoid:
 *
 *   "a second programme-management system"
 *
 * Every check below is a different way that failure would show up in source:
 *
 *  1. REFERENCE-ONLY — the spine stores no copies of participants, agents,
 *     evidence or channels; it stores where to resolve them.
 *  2. THE ONLY NEW STATE is milestones and blockers. Actions and decisions are
 *     PROJECTED (operator's "Hybrid" ruling, 2026-07-27) — the store refuses
 *     them by name, and says which substrate owns each.
 *  3. NO HAND-AUTHORED INVARIANT IDS. Amendment D Principle 3: "It stores
 *     Resolved Invariants with provenance. Exactly like Blueprint Handoff
 *     already does." A literal `inv.*` id array on a workspace record would
 *     make the workspace a second source of truth for canon and would rot
 *     silently on the next renumbering — the exact defect the EXP-P2/P3
 *     renumbering exposed.
 *  4. ONE PARTNER LIST — the venture variant is DERIVED from
 *     `PARTNER_WORKSPACES`, so instantiating the next partner stays one new
 *     entry there and zero here (inv.engineering.036 / .037).
 *  5. REFERENCE INTEGRITY — every declared participation role exists in the
 *     participation substrate. A role declared here that DOMAIN_ROLES does not
 *     have is a role invented at the wrong layer.
 */

import { describe, it, expect } from 'vitest';
import { readSource, stripComments } from './_lib/sourceAuthority';
import {
  WORKSPACE_DOMAINS,
  EXPERIMENT_CLASSES,
  experimentWorkspaceFromPartner,
  listExperimentWorkspaces,
  getExperimentWorkspace,
  workspaceReferenceIssues,
} from '../services/experiments/experimentWorkspace';
import {
  TRACKABLE_KINDS,
  assertTrackableKind,
  isLegalStatus,
  authorCommitment,
} from '../services/experiments/workspaceTracking';
import { PARTNER_WORKSPACES, PARTNER_WORKSPACE_LAYERS } from '../services/venture/partnerWorkspace';
import { DOMAIN_ROLES } from '../services/passport/participationAccess';

const SPINE_PATH = 'services/experiments/experimentWorkspace.ts';
const STORE_PATH = 'services/experiments/workspaceTracking.ts';
const MIGRATION_PATH = 'supabase/migrations/20260824000000_experiment_workspace_tracking.sql';

describe('the spine is a seam, not a second system', () => {
  it('derives the venture variant from the one authoritative partner list', () => {
    // If the spine ever grew its own workspace array, this count would drift.
    expect(listExperimentWorkspaces()).toHaveLength(PARTNER_WORKSPACES.length);
    for (const partner of PARTNER_WORKSPACES) {
      const ws = getExperimentWorkspace(partner.id);
      expect(ws, `${partner.id} is missing from the spine`).not.toBeNull();
      expect(ws!.domain).toBe('venture');
      // The partner record is carried BY REFERENCE — the same object, not a
      // reshaped copy that could drift from the registry.
      expect(ws!.partner).toBe(partner);
      expect(ws!.objectives).toBe(partner.objectives);
    }

    const src = stripComments(readSource(SPINE_PATH));
    // A literal workspace registry in the spine is the duplication defect.
    expect(
      /export const [A-Z_]*WORKSPACES\s*[:=]/.test(src),
      'the spine declares its own workspace array — derive from PARTNER_WORKSPACES instead',
    ).toBe(false);
    expect(src).toMatch(/PARTNER_WORKSPACES\.map\(/);
  });

  it('references the substrate rather than copying it', () => {
    const src = stripComments(readSource(SPINE_PATH));
    // Each concern must be reached through the module that owns it.
    const requiredSeams: Array<[string, string]> = [
      ['participants', 'participationAccess'],
      ['agents/decisions', 'constitutionalAgreement'],
      ['actions', 'intentQube'],
      ['invariants', 'invariants/store'],
      ['ontology resolution', 'ontologyResolver'],
    ];
    for (const [concern, module] of requiredSeams) {
      expect(src, `${concern} is not resolved through ${module}`).toContain(module);
    }
  });

  it('carries no hand-authored invariant ids — resolved with provenance only', () => {
    // Amendment D Principle 3. A literal seed id anywhere in the spine's
    // executable source means someone pinned canon into a workspace record.
    const src = stripComments(readSource(SPINE_PATH));
    const literalIds = src.match(/["'`]inv\.[a-z]+\.\d+["'`]/g) ?? [];
    expect(
      literalIds,
      `the spine hard-codes invariant ids (${literalIds.join(', ')}) — resolve them instead`,
    ).toEqual([]);
    // And the resolution must actually record its provenance, not just the ids.
    expect(src).toMatch(/canonVersion/);
    expect(src).toMatch(/resolutionSource/);
    expect(src).toMatch(/unresolved/);
  });

  it('the venture variant declares only roles the participation substrate has', () => {
    for (const partner of PARTNER_WORKSPACES) {
      const ws = experimentWorkspaceFromPartner(partner);
      const known = DOMAIN_ROLES[ws.participation.domain];
      expect(known, `DOMAIN_ROLES has no ${ws.participation.domain}`).toBeDefined();
      for (const role of ws.participation.roles) {
        expect(known, `role "${role}" is declared on the workspace but absent from the substrate`).toContain(role);
      }
      // The integrity checker must agree — it is what a surface renders.
      expect(workspaceReferenceIssues(ws)).toEqual([]);
    }
  });

  it('working groups compose existing layers and hold channel references only', () => {
    for (const ws of listExperimentWorkspaces()) {
      expect(ws.workingGroups.length).toBeGreaterThan(0);
      for (const group of ws.workingGroups) {
        for (const layer of group.layers) {
          expect(PARTNER_WORKSPACE_LAYERS, `unknown layer "${layer}"`).toContain(layer);
        }
        // Channel ids are references into peerChannel. An empty set is honest
        // (not yet convened); a message or member array here would be a
        // parallel messaging system.
        expect(Array.isArray(group.channelIds)).toBe(true);
      }
    }
    const src = stripComments(readSource(SPINE_PATH));
    expect(
      /messages\s*:/.test(src),
      'the spine models messages — QubeTalk peer channels already own them',
    ).toBe(false);
  });

  it('every experiment class and domain is a real member of its union', () => {
    for (const ws of listExperimentWorkspaces()) {
      expect(WORKSPACE_DOMAINS).toContain(ws.domain);
      expect(EXPERIMENT_CLASSES).toContain(ws.experimentClass);
    }
  });
});

describe('workspace-local state is bounded to the two concerns with no home', () => {
  it('accepts only milestones and blockers', () => {
    expect([...TRACKABLE_KINDS]).toEqual(['milestone', 'blocker']);
    for (const kind of TRACKABLE_KINDS) {
      expect(() => assertTrackableKind(kind)).not.toThrow();
    }
  });

  it('refuses projected concerns BY NAME, saying which substrate owns each', () => {
    // A bare "invalid kind" would leave the next agent to rediscover the
    // ruling; the refusal has to teach the architecture.
    const cases: Array<[string, RegExp]> = [
      ['action', /IntentQube/],
      ['decision', /Constitutional Agreement/],
      ['participant', /participation grants/],
      ['evidence', /activity receipts/],
      ['invariant', /never a stored id list/],
    ];
    for (const [kind, expected] of cases) {
      expect(() => assertTrackableKind(kind), `${kind} was accepted as workspace-local`).toThrow(expected);
    }
  });

  it('keeps the two status vocabularies apart', () => {
    // A blocker is never "done"; a milestone is never "cleared".
    expect(isLegalStatus('milestone', 'done')).toBe(true);
    expect(isLegalStatus('milestone', 'cleared')).toBe(false);
    expect(isLegalStatus('blocker', 'cleared')).toBe(true);
    expect(isLegalStatus('blocker', 'done')).toBe(false);
    expect(isLegalStatus('blocker', 'in_progress')).toBe(false);
  });

  it('records authorship as a one-way commitment, never a personaId', () => {
    const persona = '11111111-2222-3333-4444-555555555555';
    const ref = authorCommitment(persona);
    expect(ref).toHaveLength(16);
    expect(ref).not.toContain(persona);
    // Deterministic — re-recording the same author is idempotent.
    expect(authorCommitment(persona)).toBe(ref);
    expect(authorCommitment('other')).not.toBe(ref);

    const store = stripComments(readSource(STORE_PATH));
    // The insert must never write a raw persona column.
    expect(store).not.toMatch(/persona_id\s*:/);
    expect(store).toMatch(/created_by_ref/);
  });

  it('the migration constrains the table to the same two kinds and carries no identifiers', () => {
    const sql = readSource(MIGRATION_PATH);
    expect(sql).toMatch(/kind IN \('milestone', 'blocker'\)/);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
    // T0 discipline — the columns must not name any protected identifier.
    for (const forbidden of ['persona_id', 'auth_profile_id', 'root_did', 'case_id']) {
      expect(
        new RegExp(`^\\s*${forbidden}\\b`, 'm').test(sql),
        `${forbidden} appears as a column — T0 identifiers never enter a workspace table`,
      ).toBe(false);
    }
  });
});
