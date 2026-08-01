/**
 * Validation Programme finalization pass — sequencing, authority derivation,
 * and faithful status (operator ruling, 2026-08-02).
 *
 * Covers three corrections:
 *
 *   1. THE REVIEWER-AUTHORIZATION MISMATCH. An invitation issued with role
 *      `research-participant` claimed successfully ("Access granted:
 *      research-lab · research-participant") and then failed every review
 *      gate ("Steward or assigned-reviewer access required"). Both surfaces
 *      were correct in isolation — that role is a real research-lab role and
 *      is DELIBERATELY excluded from the review-readable set — but they never
 *      agreed on what a REVIEWER invitation is. Fixed at issuance (refuse the
 *      incoherent pairing) and made legible at read time (a structured
 *      reason, not one generic refusal). The global route is NOT weakened:
 *      `REVIEW_VIEW_READABLE_ROLES` is unchanged.
 *
 *   2. THE NEXT CONSTITUTIONAL ACT. After authentication, route to the next
 *      incomplete constitutional act — never a generic landing page.
 *
 *   3. INVITATION SCOPE → CONTEXTUAL DESTINATION. A claimed invitation
 *      scoped to EXP-P1 resolves to the Validation Programme, not the
 *      cartridge root.
 */

import { describe, it, expect } from 'vitest';

import { readSource, stripComments, importAuthority } from './_lib/sourceAuthority';
import {
  resolveNextConstitutionalAct,
  type ConstitutionalActId,
} from '@/services/journey/nextConstitutionalAct';
import {
  REVIEW_VIEW_READABLE_ROLES,
  REVIEWER_INVITATION_ROLE,
} from '@/services/passport/participationAccess';

// ─────────────────────────────────────────────────────────────────────────
// 1. Reviewer authorization — the mismatch, named and closed
// ─────────────────────────────────────────────────────────────────────────

describe('Reviewer authorization — the role catalogue is the shared source of authority', () => {
  it('the canonical reviewer-invitation role IS review-readable (the mismatch, closed)', () => {
    expect(REVIEW_VIEW_READABLE_ROLES).toContain(REVIEWER_INVITATION_ROLE);
  });

  it('research-participant remains NON-review-readable — the global route is not weakened', () => {
    // The ruling is explicit: "Do not weaken the global route." The fix is on
    // the issuance side, never by admitting a role the Review view excludes.
    expect(REVIEW_VIEW_READABLE_ROLES).not.toContain('research-participant');
    expect(REVIEW_VIEW_READABLE_ROLES).not.toContain('student-researcher');
  });

  it("the reviewer role's own capability row withholds every governed act — read/recommend only", async () => {
    const { RESEARCH_WORKSPACE_ROLE_AUTHORITY } = await import('@/services/research/researchWorkspaceRoles');
    const reviewer = (RESEARCH_WORKSPACE_ROLE_AUTHORITY as unknown as Record<string, Record<string, unknown>>)[
      REVIEWER_INVITATION_ROLE
    ];
    expect(reviewer, 'the reviewer role must exist in the catalogue').toBeTruthy();
    // May review…
    expect(reviewer.maySubmitReviewDecision).toBe(true);
    // …and nothing that would let a reviewer resolve governed state.
    expect(reviewer.mayAdministerAccess).toBe(false);
    expect(reviewer.mayEditWorkingMaterials).toBe(false);
    expect(reviewer.mayDefineExperiments).toBe(false);
    expect(reviewer.mayAwardGrade).toBe(false);
  });

  it('there is exactly ONE implementation of the review-reach rule — the boolean delegates to the diagnosis', () => {
    const src = stripComments(readSource('services/passport/participationAccess.ts'));
    const start = src.indexOf('export async function callerMayReadExperimentReview(');
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start, src.indexOf('\n}', start));
    expect(body).toContain('diagnoseExperimentReviewAccess(');
    // It must NOT carry its own second copy of the role/scope test.
    expect(body).not.toContain('REVIEW_VIEW_READABLE_ROLES');
  });
});

describe('diagnoseExperimentReviewAccess — a structured reason, never one generic refusal', () => {
  const EXPERIMENT = 'EXP-P1';

  /** Minimal Supabase-shaped stub: only the chain this function actually uses. */
  function stubAdmin(result: { data: unknown[] | null; error: unknown }) {
    const chain = {
      select: () => chain,
      eq: () => chain,
      then: undefined as unknown,
    } as Record<string, unknown>;
    // The final `.eq(...)` in the chain is awaited, so make the chain thenable.
    (chain as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
    return { from: () => chain } as never;
  }

  it("'no-grant' when the persona holds no research-lab grant at all — the invitation was never claimed", async () => {
    const { diagnoseExperimentReviewAccess } = await import('@/services/passport/participationAccess');
    const d = await diagnoseExperimentReviewAccess(stubAdmin({ data: [], error: null }), 'p1', EXPERIMENT);
    expect(d.mayRead).toBe(false);
    expect(d.reason).toBe('no-grant');
  });

  it("'role-not-review' when an ACTIVE grant exists but its role cannot read reviews — THE reported defect", async () => {
    const { diagnoseExperimentReviewAccess } = await import('@/services/passport/participationAccess');
    const d = await diagnoseExperimentReviewAccess(
      stubAdmin({ data: [{ role: 'research-participant', allowed_experiments: null }], error: null }),
      'p1',
      EXPERIMENT,
    );
    expect(d.mayRead).toBe(false);
    // Critically NOT 'no-grant': the citizen DID claim successfully. Telling
    // them to claim again would be false and would dead-end them.
    expect(d.reason).toBe('role-not-review');
    expect(d.heldRoles).toContain('research-participant');
  });

  it("'granted' for a reviewer grant scoped to this experiment", async () => {
    const { diagnoseExperimentReviewAccess } = await import('@/services/passport/participationAccess');
    const d = await diagnoseExperimentReviewAccess(
      stubAdmin({ data: [{ role: 'reviewer', allowed_experiments: [EXPERIMENT] }], error: null }),
      'p1',
      EXPERIMENT,
    );
    expect(d.mayRead).toBe(true);
    expect(d.reason).toBe('granted');
    expect(d.reachableExperiments).toEqual([EXPERIMENT]);
  });

  it("'experiment-scope' for a reviewer grant scoped to OTHER experiments — reach is per-experiment", async () => {
    const { diagnoseExperimentReviewAccess } = await import('@/services/passport/participationAccess');
    const d = await diagnoseExperimentReviewAccess(
      stubAdmin({ data: [{ role: 'reviewer', allowed_experiments: ['EXP-Q9'] }], error: null }),
      'p1',
      EXPERIMENT,
    );
    expect(d.mayRead).toBe(false);
    expect(d.reason).toBe('experiment-scope');
  });

  it("'unavailable' on a store error — UNKNOWN, never presented as a refusal", async () => {
    const { diagnoseExperimentReviewAccess } = await import('@/services/passport/participationAccess');
    const d = await diagnoseExperimentReviewAccess(
      stubAdmin({ data: null, error: { message: 'boom' } }),
      'p1',
      EXPERIMENT,
    );
    expect(d.mayRead).toBe(false);
    expect(d.reason).toBe('unavailable');
  });
});

describe('Invitation issuance — the incoherent reviewer invitation is refused where it can still be fixed', () => {
  it('createAccessInvitation refuses experiment scoping on a non-review-readable role', () => {
    const src = stripComments(readSource('services/passport/participationAccess.ts'));
    const start = src.indexOf('export async function createAccessInvitation(');
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start, src.indexOf('\n}', start));
    expect(body).toContain('REVIEW_VIEW_READABLE_ROLES.includes(input.role)');
    expect(body).toContain('REVIEWER_INVITATION_ROLE');
  });

  it('the refusal names the fix, not just the failure', () => {
    const src = readSource('services/passport/participationAccess.ts');
    expect(src).toMatch(/Issue a reviewer invitation with role/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. The next constitutional act
// ─────────────────────────────────────────────────────────────────────────

describe('resolveNextConstitutionalAct — never a generic landing page', () => {
  const act = (o: Partial<Parameters<typeof resolveNextConstitutionalAct>[0]>): ConstitutionalActId =>
    resolveNextConstitutionalAct({
      authenticated: true,
      invitationPresent: true,
      invitationClaimed: false,
      ...o,
    }).id;

  it('unauthenticated with an invitation → authenticate', () => {
    expect(act({ authenticated: false })).toBe('authenticate');
  });

  it('authenticated + invitation UNCLAIMED → claim-invitation (the mandatory next act)', () => {
    expect(act({ authenticated: true, invitationClaimed: false })).toBe('claim-invitation');
  });

  it('authenticated + invitation ALREADY claimed → enter-programme, never back to claim', () => {
    expect(act({ authenticated: true, invitationClaimed: true })).toBe('enter-programme');
  });

  it('authenticated with no invitation in play → enter-programme', () => {
    expect(act({ authenticated: true, invitationPresent: false })).toBe('enter-programme');
  });

  it('unknown auth state → observe, NEVER a guessed step', () => {
    // The failure this forbids: an unresolved self-view rendering as "signed
    // out", inviting an already-onboarded reviewer to redo accession.
    expect(act({ authenticated: null })).toBe('observe');
  });

  it('unknown claim state → observe, never a re-claim prompt for a possibly-claimed invitation', () => {
    expect(act({ authenticated: true, invitationClaimed: null })).toBe('observe');
  });

  it('every act carries a reason that is true of the facts that produced it', () => {
    for (const facts of [
      { authenticated: false, invitationPresent: true, invitationClaimed: false },
      { authenticated: true, invitationPresent: true, invitationClaimed: false },
      { authenticated: true, invitationPresent: true, invitationClaimed: true },
      { authenticated: null, invitationPresent: true, invitationClaimed: null },
    ] as const) {
      const resolved = resolveNextConstitutionalAct(facts);
      expect(resolved.because.length, JSON.stringify(facts)).toBeGreaterThan(0);
      expect(resolved.label.length).toBeGreaterThan(0);
    }
  });

  it('is pure — no I/O, no globals, no clock (so it cannot drift between surfaces)', () => {
    const src = stripComments(readSource('services/journey/nextConstitutionalAct.ts'));
    for (const forbidden of ['fetch(', 'Date.now(', 'localStorage', 'window.', 'process.env']) {
      expect(src, `nextConstitutionalAct must not reference ${forbidden}`).not.toContain(forbidden);
    }
    expect(importAuthority(src).records.length, 'must import nothing').toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 3. Invitation page + contextual destination
// ─────────────────────────────────────────────────────────────────────────

const INVITE_PAGE = 'app/invite/[code]/page.tsx';
const ACCESSION_ROUTE = 'app/api/public/irl/accession/route.ts';

describe('Invitation page — Passport-aware, self-completing, contextually routed', () => {
  it('routes via the shared resolver, not a private if-chain', () => {
    const graph = importAuthority(readSource(INVITE_PAGE));
    expect(
      graph.records.some((r) => r.names.includes('resolveNextConstitutionalAct')),
      'the invitation page must use the platform resolver',
    ).toBe(true);
  });

  it('reads the caller state through personaFetch — never raw fetch on a spine endpoint', () => {
    const src = stripComments(readSource(INVITE_PAGE));
    expect(src).toContain('personaFetch("/api/participation/my-access"');
    expect(src).toContain('personaFetch("/api/participation/claim"');
    // The accession endpoint is a PUBLIC capability URL, so plain fetch there
    // is correct — but no spine endpoint may be reached that way.
    expect(src).not.toMatch(/fetch\("\/api\/participation\//);
  });

  it('claims through the EXISTING claim route — never a second acceptance mechanism', () => {
    const src = stripComments(readSource(INVITE_PAGE));
    expect(src).toContain('/api/participation/claim');
    // No direct grant-writing from the client.
    expect(src).not.toContain('access_grants');
  });

  it('signs in through the canonical PassportConnectPanel — never a second sign-in UI', () => {
    const graph = importAuthority(readSource(INVITE_PAGE));
    expect(graph.records.some((r) => r.names.includes('PassportConnectPanel'))).toBe(true);
  });

  it('after a successful claim it re-observes rather than routing anywhere generic', () => {
    const src = stripComments(readSource(INVITE_PAGE));
    const start = src.indexOf('const claimInvitation = useCallback(');
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start, src.indexOf('}, [code,', start));
    expect(body).toContain('loadSelfView()');
    // No hard navigation to a landing page inside the claim handler.
    expect(body).not.toContain('window.location');
    expect(body).not.toContain('router.push');
  });

  it('an unresolved self-view never renders as signed-out', () => {
    const src = stripComments(readSource(INVITE_PAGE));
    // The failure branch sets an explicit "failed" flag which feeds `null`
    // (unknown) into the resolver — it must never set authenticated:false.
    expect(src).toContain('setSelfViewFailed(true)');
    expect(src).toContain('selfViewFailed ? null :');
  });

  it('the destination comes from the server-derived invitation scope, not a hardcoded programme URL', () => {
    const src = stripComments(readSource(INVITE_PAGE));
    expect(src).toContain('accession?.destination');
    expect(src, 'the page must not hardcode a programme tab').not.toContain('tab=irl-os-validation-programme');
  });
});

describe('Accession route — invitation scope resolves the contextual destination', () => {
  it('derives the destination from the invitation allowed_experiments, and selects it', () => {
    const src = stripComments(readSource(ACCESSION_ROUTE));
    expect(src).toContain('allowed_experiments');
    expect(src).toContain('function contextualDestination(');
    expect(src).toContain('irl-os-validation-programme');
  });

  it('an EXP-P1-scoped invitation resolves to the Validation Programme, not the cartridge root', () => {
    const src = stripComments(readSource(ACCESSION_ROUTE));
    const start = src.indexOf('function contextualDestination(');
    const body = src.slice(start, src.indexOf('\n}', start));
    const vpAt = body.indexOf('irl-os-validation-programme');
    const fallbackAt = body.lastIndexOf('irl-os-cartridge`');
    expect(vpAt).toBeGreaterThan(-1);
    // The scoped branch must be tested BEFORE the generic fallback returns.
    expect(vpAt).toBeLessThan(fallbackAt);
    expect(body).toContain('Continue to Validation Programme');
  });

  it('an unscoped invitation still resolves to the honest general destination', () => {
    const src = stripComments(readSource(ACCESSION_ROUTE));
    const start = src.indexOf('function contextualDestination(');
    const body = src.slice(start, src.indexOf('\n}', start));
    expect(body).toContain('Continue in the Lab');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4. Faithful status on the journey state route
// ─────────────────────────────────────────────────────────────────────────

describe('Journey state route — carries the access diagnosis, fails unknown not denied', () => {
  const ROUTE = 'app/api/journey/validation-programme/state/route.ts';

  it('returns the structured access diagnosis alongside the journey state', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toContain('access: accessDiagnosis');
  });

  it('a missing store yields reason "unavailable", never a silent denial', () => {
    const src = stripComments(readSource(ROUTE));
    expect(src).toContain("reason: 'unavailable'");
  });

  it('still never fabricates submit-review evidence — the honest gap is preserved', () => {
    const src = stripComments(readSource(ROUTE));
    const block = src.match(/'submit-review':\s*\{[^}]*\}/);
    expect(block).not.toBeNull();
    expect(block![0].replace(/\s/g, '')).toBe("'submit-review':{}");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 5. Faithful error presentation in the Journey runner
// ─────────────────────────────────────────────────────────────────────────

describe('JourneyRunSurface — a transient status failure never reads as lost access', () => {
  const SURFACE = 'components/journey/JourneyRunSurface.tsx';

  it('shows the actionable participant message, not the raw transport error, as the headline', () => {
    const src = stripComments(readSource(SURFACE));
    expect(src).toContain('Programme status is temporarily unavailable.');
    expect(src).toContain('Your confirmed access remains active');
  });

  it('keeps the exact technical detail reachable in an operator diagnostics area — hidden from no one', () => {
    const src = stripComments(readSource(SURFACE));
    expect(src).toContain('Diagnostics');
    expect(src).toContain('{technicalDetail}');
  });

  it('offers a real retry rather than a dead end', () => {
    const src = stripComments(readSource(SURFACE));
    expect(src).toContain('Refresh status');
  });

  it('renders unavailability in amber, never the rose reserved for a real refusal', () => {
    const src = stripComments(readSource(SURFACE));
    const start = src.indexOf('{error && (');
    expect(start).toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf('</div>\n      )}', start));
    expect(block).toContain('amber');
    expect(block, 'unavailable must not look like denied').not.toContain('rose-');
  });

  it('never clears the last resolved state on failure — unknown must not render as "nothing complete"', () => {
    const src = stripComments(readSource(SURFACE));
    const start = src.indexOf('const refresh = useCallback(');
    const body = src.slice(start, src.indexOf('}, [stateUrl, personaId]);', start));
    const catchAt = body.indexOf('} catch');
    expect(catchAt).toBeGreaterThan(-1);
    expect(body.slice(catchAt)).not.toContain('setRuntimeState(null)');
  });

  it('distinguishes stale-but-known from never-resolved', () => {
    const src = stripComments(readSource(SURFACE));
    expect(src).toContain('const isStale = !!error && !!runtimeState;');
    expect(src).toContain('No stage is assumed complete while status is unknown.');
  });
});
