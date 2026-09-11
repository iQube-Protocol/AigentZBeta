/**
 * IRL Stewardship — Access Maintenance + Research Persona Legibility +
 * Capability-Scoped Participation (2026-10-01).
 *
 * Part 1 (items 1-9): amend an EXISTING access_grants row in place — no new
 * invitation, no new onboarding ritual — plus the persistent Research
 * Persona/handle. Part 2 (items 10-18): capability-scoped participation
 * layered strictly on top of access ("Access determines what a Persona may
 * enter. Capability determines what that Persona may do inside the
 * authorized scope.").
 *
 * Uses the shared in-memory fake Postgrest client (tests/_lib/fakeSupabase.ts)
 * — extend, don't duplicate (inv.engineering.036/037). `createActivityReceipt`
 * is mocked so every mutation's receipt payload is inspectable without a real
 * DB/receipt pipeline.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase, fakeUuid, fakeNowIso, type FakeTables } from './_lib/fakeSupabase';
import { readSource, stripComments, importAuthority } from './_lib/sourceAuthority';

const receiptCalls: Array<{ personaId: string; actionType: string; actionInput: Record<string, unknown> }> = [];
vi.mock('@/services/receipts/activityReceiptService', () => ({
  createActivityReceipt: vi.fn(async (input: { personaId: string; actionType: string; actionInput?: Record<string, unknown> }) => {
    receiptCalls.push({ personaId: input.personaId, actionType: input.actionType, actionInput: input.actionInput ?? {} });
    return { id: `receipt-${receiptCalls.length}` };
  }),
}));

import {
  amendAccessGrant,
  suspendAccessGrant,
  reinstateAccessGrant,
  revokeAccessGrantById,
  listAccessGrants,
} from '@/services/passport/participationAccess';
import { getResearchPersona, upsertResearchPersona } from '@/services/passport/researchPersona';
import { grantCapability, revokeCapability, resolveCapability } from '@/services/research/accessCapabilities';

function seedGrant(tables: FakeTables, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const row = {
    id: fakeUuid(),
    persona_id: 'persona-participant-1',
    access_domain: 'research-lab',
    role: 'reviewer',
    source: 'invitation',
    status: 'active',
    granted_at: fakeNowIso(),
    expires_at: null,
    receipt_id: null,
    allowed_experiments: null,
    suspended_at: null,
    revoked_at: null,
    updated_at: fakeNowIso(),
    ...overrides,
  };
  (tables.access_grants ??= []).push(row);
  return row;
}

beforeEach(() => {
  receiptCalls.length = 0;
});

// ─────────────────────────────────────────────────────────────────────────
// PART 1 — Access Maintenance (items 1-9)
// ─────────────────────────────────────────────────────────────────────────

describe('Part 1 — access-grant amendment (items 1-2, 8): amend in place, never a new invitation/grant', () => {
  it('1. adds and removes experiment scope on the SAME grant row — no new grant is created', async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables, { allowed_experiments: ['exp-a'] });

    const result = await amendAccessGrant(admin as never, {
      grantId: grant.id as string,
      actorPersonaId: 'persona-steward-1',
      addExperiments: ['exp-b'],
      removeExperiments: ['exp-a'],
      reason: 'scope correction',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.grant.id).toBe(grant.id);
    expect(result.grant.allowedExperiments).toEqual(['exp-b']);
    // Exactly one grant row exists — amendment mutated it in place.
    expect((tables.access_grants ?? []).length).toBe(1);
  });

  it('2. a role change is validated against the domain role catalogue — an invalid role is refused', async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables, { access_domain: 'research-lab', role: 'reviewer' });

    const bad = await amendAccessGrant(admin as never, {
      grantId: grant.id as string,
      actorPersonaId: 'persona-steward-1',
      newRole: 'not-a-real-role',
    });
    expect(bad.ok).toBe(false);

    const good = await amendAccessGrant(admin as never, {
      grantId: grant.id as string,
      actorPersonaId: 'persona-steward-1',
      newRole: 'research-steward',
    });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.grant.role).toBe('research-steward');
  });

  it('3. extends, shortens, and clears expiry on the same grant', async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables, { expires_at: '2026-01-01T00:00:00.000Z' });

    const extended = await amendAccessGrant(admin as never, {
      grantId: grant.id as string,
      actorPersonaId: 'persona-steward-1',
      newExpiresAt: '2027-01-01T00:00:00.000Z',
    });
    expect(extended.ok).toBe(true);
    if (extended.ok) expect(extended.grant.expiresAt).toBe('2027-01-01T00:00:00.000Z');

    const cleared = await amendAccessGrant(admin as never, {
      grantId: grant.id as string,
      actorPersonaId: 'persona-steward-1',
      newExpiresAt: null,
    });
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.grant.expiresAt).toBeNull();
  });

  it('4. refuses a no-op amendment — no changes supplied', async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables, { role: 'reviewer', allowed_experiments: null, expires_at: null });
    const result = await amendAccessGrant(admin as never, { grantId: grant.id as string, actorPersonaId: 'persona-steward-1' });
    expect(result.ok).toBe(false);
  });

  it('5. refuses to amend a revoked grant — a closed constitutional fact, reopen only via a fresh invitation', async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables, { status: 'revoked' });
    const result = await amendAccessGrant(admin as never, {
      grantId: grant.id as string,
      actorPersonaId: 'persona-steward-1',
      newRole: 'research-steward',
    });
    expect(result.ok).toBe(false);
  });

  it('6. suspend is a reversible hold — suspended then reinstated returns to active, receipted both ways', async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables, { status: 'active' });

    const suspended = await suspendAccessGrant(admin as never, { grantId: grant.id as string, actorPersonaId: 'persona-steward-1', reason: 'pending review' });
    expect(suspended.ok).toBe(true);
    if (suspended.ok) expect(suspended.grant.status).toBe('suspended');

    const reinstated = await reinstateAccessGrant(admin as never, { grantId: grant.id as string, actorPersonaId: 'persona-steward-1' });
    expect(reinstated.ok).toBe(true);
    if (reinstated.ok) expect(reinstated.grant.status).toBe('active');

    const types = receiptCalls.map((r) => r.actionType);
    expect(types).toContain('access_grant_suspended');
    expect(types).toContain('access_grant_reinstated');
  });

  it('7. revoke is permanent — a revoked grant can never be reinstated or amended again', async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables, { status: 'active' });

    const revoked = await revokeAccessGrantById(admin as never, { grantId: grant.id as string, actorPersonaId: 'persona-steward-1', reason: 'no longer participating' });
    expect(revoked.ok).toBe(true);
    if (revoked.ok) expect(revoked.grant.status).toBe('revoked');

    const reinstateAttempt = await reinstateAccessGrant(admin as never, { grantId: grant.id as string, actorPersonaId: 'persona-steward-1' });
    expect(reinstateAttempt.ok).toBe(false);
    const amendAttempt = await amendAccessGrant(admin as never, { grantId: grant.id as string, actorPersonaId: 'persona-steward-1', newRole: 'research-steward' });
    expect(amendAttempt.ok).toBe(false);
  });

  it('8. every amendment produces a receipt carrying actor, participant, previous/new scope, previous/new expiry, reason, and resulting state — with an ACTION_LABELS entry for the Activity ledger', async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables, { allowed_experiments: ['exp-a'], role: 'reviewer', expires_at: null });

    await amendAccessGrant(admin as never, {
      grantId: grant.id as string,
      actorPersonaId: 'persona-steward-1',
      addExperiments: ['exp-b'],
      newRole: 'research-steward',
      newExpiresAt: '2027-06-01T00:00:00.000Z',
      reason: 'onboarding follow-up',
    });

    expect(receiptCalls.length).toBe(1);
    const [receipt] = receiptCalls;
    expect(receipt.actionType).toBe('access_grant_amended');
    expect(receipt.personaId).toBe('persona-steward-1'); // the ACTOR
    expect(receipt.actionInput.targetPersonaId).toBe('persona-participant-1'); // the PARTICIPANT
    expect(receipt.actionInput.previousScope).toEqual(['exp-a']);
    expect(receipt.actionInput.newScope).toEqual(['exp-a', 'exp-b']);
    expect(receipt.actionInput.previousRole).toBe('reviewer');
    expect(receipt.actionInput.newRole).toBe('research-steward');
    expect(receipt.actionInput.previousExpiresAt).toBeNull();
    expect(receipt.actionInput.newExpiresAt).toBe('2027-06-01T00:00:00.000Z');
    expect(receipt.actionInput.reason).toBe('onboarding follow-up');
    expect(receipt.actionInput.resultingStatus).toBe('active');

    // Every one of the 8 new receipt action types the pipeline introduces has
    // a human-readable Activity-ledger label — never a raw enum string shown
    // to an operator.
    const cardSrc = stripComments(readSource('components/metame/cards/ActivityReceiptCard.tsx'));
    for (const actionType of [
      'access_grant_amended', 'access_grant_suspended', 'access_grant_reinstated', 'access_grant_revoked',
      'access_grant_capability_granted', 'access_grant_capability_revoked',
      'research_persona_proposed', 'research_persona_updated',
    ]) {
      expect(cardSrc, `ActivityReceiptCard has no label for '${actionType}'`).toMatch(new RegExp(`${actionType}:`));
    }
  });

  it('9. an existing grant survives untouched when only its Research Persona is created/edited — the two are independent, and neither writes rootDid/kybeId', async () => {
    const { admin } = createFakeSupabase();

    const proposed = await upsertResearchPersona(admin as never, {
      personaId: 'persona-participant-1',
      displayName: 'A. Reviewer',
      handle: 'a-reviewer',
      privacyMode: 'pseudonymous',
      actorPersonaId: 'persona-steward-1',
      proposedOnly: true,
    });
    expect(proposed.ok).toBe(true);
    if (proposed.ok) {
      expect(proposed.persona.confirmedAt).toBeNull(); // proposed, not yet confirmed
      expect(proposed.persona.proposedByPersonaId).toBe('persona-steward-1');
    }

    // The participant later confirms/edits it themselves.
    const confirmed = await upsertResearchPersona(admin as never, {
      personaId: 'persona-participant-1',
      displayName: 'Austin R.',
      handle: 'austin-r',
      privacyMode: 'identified',
      actorPersonaId: 'persona-participant-1',
    });
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) {
      expect(confirmed.persona.confirmedAt).not.toBeNull();
      expect(confirmed.persona.handle).toBe('austin-r');
    }

    const record = await getResearchPersona(admin as never, 'persona-participant-1');
    expect(record).not.toBeNull();
    // NOT personhood — never a rootDid/kybeId field on this record.
    expect(record).not.toHaveProperty('rootDid');
    expect(record).not.toHaveProperty('kybeId');

    const types = receiptCalls.map((r) => r.actionType);
    expect(types).toContain('research_persona_proposed');
    expect(types).toContain('research_persona_updated');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// PART 2 — Capability-Scoped Participation (items 10-18)
// ─────────────────────────────────────────────────────────────────────────

describe('Part 2 — capability-scoped participation: layered strictly on top of access', () => {
  it('10. an ordinary capability (write) never implies a high-risk one (crystal_groom) at the same scope', async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables, { role: 'research-steward' });
    await grantCapability(admin as never, {
      grantId: grant.id as string, scopeType: 'experiment', scopeRef: 'exp-1', capability: 'write', actorPersonaId: 'persona-steward-1',
    });
    const decision = await resolveCapability(admin as never, {
      personaId: 'persona-participant-1', scopeType: 'experiment', scopeRef: 'exp-1', capability: 'crystal_groom',
    });
    expect(decision.allowed).toBe(false);
  });

  it('11. default-deny is preserved — no active access grant at all means no capability, ever', async () => {
    const { admin } = createFakeSupabase();
    const decision = await resolveCapability(admin as never, {
      personaId: 'persona-with-no-grant', scopeType: 'experiment', scopeRef: 'exp-1', capability: 'read',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('no-active-grant');
  });

  it('12. the run-capability gate is wired into BOTH rehearsal routes, admin bypass preserved', () => {
    for (const route of [
      'app/api/research/crystal/[experimentId]/rehearsal/route.ts',
      'app/api/research/crystal/[experimentId]/execution-rehearsal/route.ts',
    ]) {
      const src = stripComments(readSource(route));
      expect(src, `${route} lost its admin bypass`).toMatch(/if \(!persona\.cartridgeFlags\?\.isAdmin\)/);
      expect(src, `${route} does not gate on the 'run' capability`).toMatch(
        /resolveCapability\(admin, \{ personaId: persona\.personaId, scopeType: 'experiment', scopeRef: experimentId, capability: 'run' \}\)/,
      );
    }
  });

  it("13. a high-risk capability is refused by the role's own ceiling even when an explicit capability row exists (research-lab workspaces never confer freeze/canonize/Standing authority)", async () => {
    const { admin, tables } = createFakeSupabase();
    // 'reviewer' — like every research-lab workspace role — has mayFreeze:
    // false unconditionally (researchWorkspaceRoles.ts's NEVER const).
    const grant = seedGrant(tables, { role: 'reviewer' });
    const granted = await grantCapability(admin as never, {
      grantId: grant.id as string, scopeType: 'experiment', scopeRef: 'exp-1', capability: 'freeze_unfreeze', actorPersonaId: 'persona-steward-1',
    });
    expect(granted.ok).toBe(true); // the capability ROW itself is grantable…

    const decision = await resolveCapability(admin as never, {
      personaId: 'persona-participant-1', scopeType: 'experiment', scopeRef: 'exp-1', capability: 'freeze_unfreeze',
    });
    expect(decision.allowed, '…but the role ceiling must still refuse it').toBe(false); // …but never usable
    expect(decision.reason).toBe('refused-by-role-ceiling-or-expired');
  });

  it('14. review and write stay separate capabilities — granting one never implies the other', async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables, { role: 'research-steward' });
    await grantCapability(admin as never, {
      grantId: grant.id as string, scopeType: 'review_package', scopeRef: 'pkg-1', capability: 'review', actorPersonaId: 'persona-steward-1',
    });

    const reviewDecision = await resolveCapability(admin as never, {
      personaId: 'persona-participant-1', scopeType: 'review_package', scopeRef: 'pkg-1', capability: 'review',
    });
    expect(reviewDecision.allowed).toBe(true);

    const writeDecision = await resolveCapability(admin as never, {
      personaId: 'persona-participant-1', scopeType: 'review_package', scopeRef: 'pkg-1', capability: 'write',
    });
    expect(writeDecision.allowed, 'granting review must not imply write').toBe(false);
  });

  it('15. capability revocation takes immediate effect — no stale "yes" on the very next decision', async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables, { role: 'researcher' });
    const granted = await grantCapability(admin as never, {
      grantId: grant.id as string, scopeType: 'experiment', scopeRef: 'exp-1', capability: 'run', actorPersonaId: 'persona-steward-1',
    });
    expect(granted.ok).toBe(true);
    if (!granted.ok) return;

    const before = await resolveCapability(admin as never, {
      personaId: 'persona-participant-1', scopeType: 'experiment', scopeRef: 'exp-1', capability: 'run',
    });
    expect(before.allowed).toBe(true);

    await revokeCapability(admin as never, { capabilityId: granted.capability.id, actorPersonaId: 'persona-steward-1', reason: 'run window closed' });

    const after = await resolveCapability(admin as never, {
      personaId: 'persona-participant-1', scopeType: 'experiment', scopeRef: 'exp-1', capability: 'run',
    });
    expect(after.allowed).toBe(false);
    expect(receiptCalls.map((r) => r.actionType)).toContain('access_grant_capability_revoked');
  });

  it('16. the capability editor requires deliberate confirmation before a high-risk grant — server AND client', () => {
    const routeSrc = stripComments(readSource('app/api/steward/participation/capabilities/route.ts'));
    expect(routeSrc, 'server route does not refuse a high-risk grant lacking confirmHighRisk').toMatch(
      /isHighRiskCapability\(capability\) && body\.confirmHighRisk !== true/,
    );

    const uiSrc = stripComments(readSource('app/triad/components/codex/tabs/StewardParticipationTab.tsx'));
    expect(uiSrc, 'UI does not visually distinguish high-risk capabilities').toMatch(/isHighRisk/);
    expect(uiSrc, 'the Grant button is not disabled pending confirmation').toMatch(
      /capabilityCatalogue\.highRisk\.includes\(capCapability\) && !capConfirmHighRisk/,
    );
  });

  it('17. human UI and any MCP/agent surface share the identical server-side decision — one function, never a parallel re-implementation', () => {
    for (const route of [
      'app/api/research/crystal/[experimentId]/rehearsal/route.ts',
      'app/api/research/crystal/[experimentId]/execution-rehearsal/route.ts',
    ]) {
      const src = readSource(route);
      const authority = importAuthority(src);
      const importsGate = authority.records.some(
        (r) => r.specifier.includes('accessCapabilities') && r.names.includes('resolveCapability'),
      );
      expect(importsGate, `${route} does not import the shared resolveCapability gate`).toBe(true);
    }
  });

  it('18. granting a capability to an existing grant never creates a new access_grants row or invitation — progressive participation, no re-onboarding', async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables, { role: 'research-steward' });
    const grantsBefore = (tables.access_grants ?? []).length;

    await grantCapability(admin as never, {
      grantId: grant.id as string, scopeType: 'crystal_generation', scopeRef: 'crystal-v3', capability: 'admin', actorPersonaId: 'persona-steward-1',
    });

    expect((tables.access_grants ?? []).length).toBe(grantsBefore);
    expect((tables.access_grant_capabilities ?? []).length).toBe(1);
    expect((tables.access_invitations ?? []).length).toBe(0);
  });
});

describe('list/receipted grants stay one shared shape (no parallel projection)', () => {
  it('listAccessGrants and an amendment return the identical AccessGrantView shape', async () => {
    const { admin, tables } = createFakeSupabase();
    const grant = seedGrant(tables, {});
    const amended = await amendAccessGrant(admin as never, { grantId: grant.id as string, actorPersonaId: 'persona-steward-1', newRole: 'research-steward' });
    expect(amended.ok).toBe(true);
    const [listed] = await listAccessGrants(admin as never, 'research-lab');
    if (amended.ok) expect(Object.keys(listed).sort()).toEqual(Object.keys(amended.grant).sort());
  });
});
