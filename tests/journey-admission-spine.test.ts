/**
 * The admission spine is linear; enrichments are a parallel axis.
 *
 * ── THE OPERATOR'S RECONSTITUTION (2026-08-03) ───────────────────────────
 *
 *   > "Constitutional admission establishes who the agent is, whose authority
 *   >  it carries, and whether that authority is bounded. Capability
 *   >  enrichments determine what specialized services it may subsequently
 *   >  use. Those are separate axes. Collapsing them into one linear ceremony
 *   >  is what has kept turning optional partner integrations into
 *   >  existential blockers."
 *
 * ── THE DEFECT THESE REPLACE ─────────────────────────────────────────────
 *
 * Verify sat at position 2 of the spine, between Register and Claim. Because
 * `partner_authorization_requests` was missing from the deployed schema, an
 * OPTIONAL partner enrichment held personhood hostage: Claim, Passport,
 * delegation and activation were all unreachable behind a Pulse toggle that
 * could not run. A deploy step had become an existential blocker.
 *
 * The spine is now:  Register -> Claim -> Passport -> Delegate -> aigentMe
 * and the branches:  factory (participation + Standing ELIGIBILITY)
 *                    capability (Pulse/P&L -> financial-services runtime)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  REGISTRATION_STANDING_SEED,
  REGISTRATION_SEED_STANDING,
  shouldAwardRegistrationSeed,
} from '@/services/journey/registrationStandingSeed';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import type { JourneyStageDefinition } from '@/types/journey';

const STAGES = HORIZEN_MONEYPENNY_JOURNEY.stages;
const byId = (id: string): JourneyStageDefinition => {
  const s = STAGES.find((x) => x.id === id);
  if (!s) throw new Error(`no stage "${id}"`);
  return s;
};
const orderOf = (id: string) => STAGES.findIndex((s) => s.id === id);

/*
 * ORIENT INSERTED 2026-08-09 (Threshold Journey — Orient stage + Consequence
 * Fork, operator spec): the spine is now Register -> Claim -> Orient ->
 * Passport -> Delegate -> aigentMe. Orient answers "what must become
 * constitutionally true before I can act as the principal from whom
 * authority originates" — a real, receipted stage
 * (services/journey/orientationContext.ts), not a step Passport can skip.
 */
const SPINE = ['register', 'claim', 'orient', 'passport', 'delegate', 'aigentme'] as const;

/** Read from the module's own closed union so the canary cannot drift from it. */
const SETTLED_PREDICATES = fs
  .readFileSync(path.join(__dirname, '..', 'services/journey/settledFacts.ts'), 'utf8')
  .match(/export type SettledPredicate =([\s\S]*?);/)![1]
  .match(/'([a-z_]+)'/g)!
  .map((q) => q.replace(/'/g, ''));

describe('the admission spine is Register -> Claim -> Passport -> Delegate -> aigentMe', () => {
  it('runs in that order, with nothing interleaved', () => {
    const positions = SPINE.map(orderOf);
    expect(positions.every((p) => p >= 0), 'a spine stage is missing').toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('each spine stage requires only its predecessor', () => {
    // THE ASSERTION THAT FAILS ON THE DEFECT: Claim used to require 'verify'.
    expect(byId('claim').prerequisites).toEqual(['register']);
    // Orient now sits between Claim and Passport (2026-08-09) — Passport's
    // own prerequisite moved from 'claim' to 'orient'; Orient's is 'claim'.
    expect(byId('orient').prerequisites).toEqual(['claim']);
    expect(byId('passport').prerequisites).toEqual(['orient']);
    expect(byId('delegate').prerequisites).toEqual(['passport']);
    expect(byId('aigentme').prerequisites).toEqual(['delegate']);
  });

  it('Verify does NOT appear before Claim', () => {
    expect(orderOf('verify')).toBeGreaterThan(orderOf('claim'));
  });

  it('no spine stage waits on Verify — an enrichment cannot gate admission', () => {
    for (const id of SPINE) {
      expect(byId(id).prerequisites, `${id} must not require verify`).not.toContain('verify');
    }
  });

  it('Register routes straight to Claim', () => {
    expect(byId('register').nextStageId).toBe('claim');
  });
});

describe('enrichments and factory ingestion are parallel branches, not steps', () => {
  it('Verify is a capability branch hanging off aigentMe', () => {
    const verify = byId('verify');
    expect(verify.branch).toBe('capability');
    // Both branches hang off aigentMe — the operator's diagram, 2026-08-03.
    expect(verify.prerequisites).toEqual(['aigentme']);
    // Nothing waits on a branch.
    expect(verify.nextStageId, 'a branch must not be a step on a line').toBeUndefined();
  });

  it('Factory ingestion is its own branch, and does not require Verify', () => {
    const deploy = byId('deploy');
    expect(deploy.branch).toBe('factory');
    expect(deploy.prerequisites).toEqual(['aigentme']);
    expect(deploy.prerequisites, 'a verification failure must not block ingestion').not.toContain('verify');
  });

  it('neither branch requires the other — completing one must not need the other', () => {
    expect(byId('verify').prerequisites).not.toContain('deploy');
    expect(byId('deploy').prerequisites).not.toContain('verify');
  });

  it('aigentMe does not point at a single next stage — two branches follow, neither privileged', () => {
    // A `nextStageId` here would render as a line and imply one gates the other.
    expect(byId('aigentme').nextStageId).toBeUndefined();
  });
});

describe('registration earns a NOMINAL award, distinguishable from earned Standing', () => {
  /*
   * ── CORRECTED BY THE OPERATOR, SAME DAY ─────────────────────────────────
   *
   * My first version of this block forbade Standing at ingestion outright.
   * That was too absolute, and they said so:
   *
   *   > "Factory ingestion can earn a nominal initial Standing award because
   *   >  registration is itself a consequential, receipted action — not
   *   >  merely passive eligibility. … The important safeguard is not 'no
   *   >  Standing on ingestion.' It is: Admission Standing must be
   *   >  distinguishable from earned performance Standing."
   *
   * So the sequence is:
   *
   *   Registered in iQube Registry -> Standing eligible
   *                                -> NOMINAL onboarding Standing accrued
   *   Subsequent validated contribution -> ADDITIONAL Standing accrued
   *
   * These canaries now enforce the six conditions the operator listed, in
   * their order.
   */
  it('1. registration Standing is present after successful ingestion', () => {
    // The condition my previous canary had exactly backwards.
    expect(byId('deploy').receiptTypes ?? []).toContain('standing_accrued');
  });

  it('2. the award is one-time — idempotency is structural, not remembered', () => {
    /*
     * "Registration cannot be repeatedly farmed for Standing." A caller that
     * merely remembers not to call twice is not idempotent: a refresh, retry
     * or second observer would each re-award. The seed is gated on a SETTLED
     * FACT, and `settleFact` returns `alreadySettled: true` without
     * overwriting, so repeated attempts land exactly once.
     */
    expect(SETTLED_PREDICATES).toContain('registry_standing_seeded');
    expect(REGISTRATION_STANDING_SEED.repeatable).toBe(false);
    expect(shouldAwardRegistrationSeed({ ok: true, alreadySettled: false })).toBe(true);
    expect(shouldAwardRegistrationSeed({ ok: true, alreadySettled: true }), 'a second attempt must not re-award').toBe(false);
  });

  it('3. the award is distinguishable from contribution Standing, by basis and tier', () => {
    // The operator's actual safeguard: not the amount, the DISTINGUISHABILITY.
    expect(REGISTRATION_STANDING_SEED.basis).toBe('iqube_registry_registration');
    expect(REGISTRATION_STANDING_SEED.tier).toBe('initial');
    expect(REGISTRATION_STANDING_SEED.impliesPerformance).toBe(false);
  });

  it('4. registration alone cannot grant elevated authority', () => {
    /*
     * Derived from the accrual service's own live constants, so this stays
     * true if they change rather than resting on a comment: bucket =
     * floor(overall / BUCKET_STEP), so a seed below one bucket step cannot
     * move an agent off bucket 0, cannot reach STANDING_THRESHOLD, and
     * therefore unlocks nothing gated on a Standing tier.
     */
    const svc = fs.readFileSync(path.join(__dirname, '..', 'services/crm/standingAccrualService.ts'), 'utf8');
    const bucketStep = Number(svc.match(/const BUCKET_STEP = (\d+)/)![1]);
    const threshold = Number(svc.match(/const STANDING_THRESHOLD = (\d+)/)![1]);
    expect(REGISTRATION_SEED_STANDING).toBeLessThan(bucketStep);
    expect(REGISTRATION_SEED_STANDING).toBeLessThan(threshold);
    expect(Math.floor(REGISTRATION_SEED_STANDING / bucketStep), 'the seed must not move the bucket').toBe(0);
  });

  it('5. a failed or incomplete ingestion receives no Standing', () => {
    // The gate is the settlement itself: a run that never settles never awards.
    expect(shouldAwardRegistrationSeed({ ok: false })).toBe(false);
    expect(shouldAwardRegistrationSeed({ ok: false, alreadySettled: false })).toBe(false);
  });

  it('6. Standing is never awarded before the registry act is receipted', () => {
    // Both receipts on the stage, and the registration receipt FIRST — the
    // award records a completed act, so the act must be recorded first.
    const receipts = byId('deploy').receiptTypes ?? [];
    expect(receipts).toContain('capability_registered');
    expect(receipts).toContain('standing_accrued');
    expect(receipts.indexOf('capability_registered')).toBeLessThan(receipts.indexOf('standing_accrued'));
  });

  it('Standing still follows factory ingestion, not verification', () => {
    expect(byId('standing').prerequisites).toEqual(['deploy']);
    expect(byId('standing').prerequisites).not.toContain('verify');
  });
});

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * FINANCIAL-SERVICES ENRICHMENT GATES NOTHING (operator, 2026-08-03)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   > "Claim is incorrectly still gated on Marketa. Remove that requirement
 *   >  immediately... Claim complete = registration established + wallet
 *   >  control proven."
 *
 *   > "The only place the Marketa claim is constitutional is for financial
 *   >  services enrichment AND FSE must NOT gate ingestion to the factory or
 *   >  standing. It is additive only to standing not a requisite of it."
 *
 * Two separate rulings, one shape: FSE (Marketa, Pulse, P&L) is ADDITIVE
 * everywhere and REQUISITE nowhere. It had been a Claim prerequisite in three
 * places at once — the stage's `completionEvidence`, the observer's evidence
 * map, and the executor's inline call — so removing it from any one of them
 * left the requirement fully in force. These canaries pin all of it.
 */
describe('FSE is additive, never requisite (2026-08-03)', () => {
  const claim = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'claim')!;
  const deploy = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'deploy')!;
  const standing = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'standing')!;
  const verify = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'verify')!;

  it('Claim requires wallet control and nothing else', () => {
    expect(claim.completionEvidence).toEqual(['controlProofFresh']);
  });

  it('no Marketa signal appears in anything that DECIDES Claim', () => {
    /*
     * Scoped to the contract fields, deliberately. `surfaces[0].ref` is still
     * `marketa-eligibility-view` — the component's legacy NAME, carried by
     * journeySurfaceRegistry.ts. A name is not a dependency: that surface now
     * observes control state and nothing else. Renaming it is mechanical and
     * separate; asserting over the whole serialized stage would fail on the
     * label while proving nothing about what gates the stage.
     */
    const deciding = {
      completionEvidence: claim.completionEvidence,
      receiptTypes: claim.receiptTypes,
      prerequisites: claim.prerequisites,
      description: claim.description,
      companion: claim.companion,
    };
    expect(JSON.stringify(deciding), 'a Marketa requirement survives in Claim').not.toMatch(/marketa/i);
  });

  it('Claim depends only on Register — never on verify or any enrichment', () => {
    expect(claim.prerequisites).toEqual(['register']);
  });

  it('the Claim executor runs no Marketa assessment', () => {
    const routeSrc = fs.readFileSync(
      path.join(__dirname, '..', 'app/api/journey/moneypenny-horizen/claim/prove-control/route.ts'),
      'utf8',
    );
    // Strip comments: the file EXPLAINS the removal, and that prose must not
    // read as the call still being there.
    const code = routeSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code, 'Claim still calls Marketa').not.toMatch(/runMarketaAdmissionAssessment\s*\(/);
    expect(code, 'Claim still reads a Marketa assessment').not.toMatch(/getCurrentMarketaAdmissionAssessment\s*\(/);
  });

  it('the observer requires no Marketa receipt for Claim', () => {
    const stateSrc = fs
      .readFileSync(path.join(__dirname, '..', 'app/api/journey/moneypenny-horizen/state/route.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    // The canonical-outcome line for claim must not consult a Marketa receipt.
    const canonicalClaim = stateSrc.match(/^\s*claim:\s*hasReceipt\([^\n]*/m)?.[0] ?? '';
    expect(canonicalClaim, 'claim canonical outcome line not found — the route moved').toContain('agent_control_proven');
    expect(canonicalClaim, 'Claim completion still consults a Marketa receipt').not.toMatch(/marketa/i);
  });

  /*
   * THE SECOND RULING: the Factory branch and Standing must not wait on FSE.
   * `deploy` and `standing` descend from aigentMe and each other — never from
   * `verify`. A future edit adding `verify` to either prerequisite chain would
   * make Standing wait on Pulse/P&L, which is exactly the collapse forbidden.
   */
  it('Factory ingestion does not depend on the verification branch', () => {
    expect(deploy.prerequisites).toEqual(['aigentme']);
    expect(deploy.prerequisites).not.toContain('verify');
  });

  it('Standing does not depend on the verification branch', () => {
    expect(standing.prerequisites).toEqual(['deploy']);
    expect(standing.prerequisites).not.toContain('verify');
  });

  it('the two post-activation branches are siblings, neither upstream of the other', () => {
    expect(verify.prerequisites).toEqual(['aigentme']);
    expect(verify.nextStageId, 'verify must lead nowhere — it is a leaf branch').toBeUndefined();
  });

  /*
   * Marketa's receipts live on the enrichment branch as SURFACED evidence, and
   * are deliberately absent from its `completionEvidence` — so an assessment
   * that never runs cannot hold even the enrichment branch open, let alone
   * Standing.
   */
  it('Marketa receipts are surfaced on the enrichment branch but gate nothing there either', () => {
    expect(verify.receiptTypes.some((t) => /marketa/.test(t))).toBe(true);
    expect(verify.completionEvidence.some((e) => /marketa/i.test(e))).toBe(false);
  });
});

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * THE PASSPORT STAGE'S DECISION (operator, 2026-08-03)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   > "In the passport step the decision should be: is passport present?
 *   >  Yes = move to agent delegation path. No = move to citizen passport
 *   >  path."
 *
 * The gate (services/journey/passportEligibility.ts) already branched this
 * way. The SURFACE did not: PassportBureauApplyTab opened on a class picker
 * asking "Who is this Passport for?" — putting a question to the operator
 * that the observer had already answered, and offering a Citizen Passport
 * APPLICATION to someone holding a Citizen Passport.
 *
 * The answer now travels observer → projection → surface, which is the
 * operator's own three-layer rule applied to a stage entry point:
 * "projection consumes observer state only; no stepper component may query
 * lower-level evidence directly."
 */
describe('the Passport stage routes on the observed Passport, never re-asks (2026-08-03)', () => {
  const tabSrc = fs.readFileSync(
    path.join(__dirname, '..', 'app/triad/components/codex/tabs/PilotJourneyTab.tsx'),
    'utf8',
  );
  const wizardSrc = fs.readFileSync(
    path.join(__dirname, '..', 'app/triad/components/codex/tabs/PassportBureauApplyTab.tsx'),
    'utf8',
  );

  it('the journey reads the decision from the OBSERVER, not from its own query', () => {
    expect(tabSrc, 'the passport route is not derived from observer state').toMatch(
      /runtimeState\?\.stages\.find\([\s\S]{0,80}?'passport'/,
    );
    expect(tabSrc).toContain('operatorPolityCitizenPassportValid');
    expect(tabSrc, 'the decision never reaches the wizard').toMatch(/routeTo:\s*passportRouteTo/);
  });

  it('Passport present routes to the delegation path; absent routes to the Citizen path', () => {
    // Both directions present, and neither defaulted.
    expect(tabSrc).toMatch(/'delegate' as const/);
    expect(tabSrc).toMatch(/'citizen' as const/);
  });

  it('an unresolved observer yields NO route — absence of an answer is not an answer', () => {
    // `passportStage` undefined (state still loading) must produce `undefined`,
    // never a guess in either direction.
    expect(tabSrc).toMatch(/:\s*undefined;/);
    expect(wizardSrc, 'the wizard must render its picker when no route is given').toMatch(
      /if \(!routeTo \|\|[^)]*\) return;/,
    );
  });

  it('auto-routing reuses the SAME two resolvers as a manual pick', () => {
    /*
     * A second entry path into the wizard would be free to diverge from the
     * first — precisely how the 2026-07-31 regression put a Delegate applicant
     * through the human Account step. The effect must delegate to
     * `handleClassChoice`, never call `setStep` itself.
     */
    const effect = wizardSrc.match(/if \(!routeTo[\s\S]{0,300}?\}, \[routeTo[^\]]*\]\);/)?.[0] ?? '';
    expect(effect, 'auto-route effect not found — the component moved').not.toBe('');
    expect(effect, 'auto-routing must go through handleClassChoice').toContain('handleClassChoice(');
    expect(effect, 'auto-routing must not set the step directly').not.toMatch(/setStep\(/);
  });

  it('a late observer answer cannot yank the operator off a decision in progress', () => {
    const effect = wizardSrc.match(/if \(!routeTo[\s\S]{0,300}?\}, \[routeTo[^\]]*\]\);/)?.[0] ?? '';
    expect(effect, 'auto-routing must only replace the class QUESTION').toContain("step !== 'class'");
  });
});

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * PRINCIPAL vs DELEGATE — TWO IDENTITY CLASSES, TWO ANCHORS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The operator's canonical model (2026-08-03):
 *
 *   Human citizen / principal → KybeDID → Citizen Passport
 *   Agent / delegate          → RootDID → Delegate Passport
 *
 * An agent row lacking `kybe_identity_id` is EXPECTED and must never be read
 * as a defect — a correction the operator had to make after I reported the
 * absence across all rows as one finding, collapsing the two classes.
 *
 * The Passport stage's opening question is asked of the PRINCIPAL:
 *
 *   Does the active human principal hold a usable Citizen Passport?
 *
 * These canaries hold the roles apart structurally, so a future observer
 * cannot answer the principal's question with a delegate's record — the
 * ACTOR-SUBJECT-OWNER defect class (CI-2026-08-03-ACTOR-SUBJECT-OWNER-001),
 * which has already recurred three times in this codebase.
 */
describe('the principal Passport check can never be satisfied by an agent record', () => {
  const principalSrc = fs.readFileSync(
    path.join(__dirname, '..', 'services/identity/passportPrincipal.ts'),
    'utf8',
  );
  const stateSrc = fs.readFileSync(
    path.join(__dirname, '..', 'app/api/journey/moneypenny-horizen/state/route.ts'),
    'utf8',
  );

  /*
   * COMMENTS STRIPPED. The guard's prose explains the two models it replaced
   * and therefore NAMES the removed resolver; asserting over raw source would
   * measure the explanation rather than the code.
   */
  const passportGuardCode = () =>
    stateSrc
      .slice(stateSrc.indexOf("guarded('passport'"), stateSrc.indexOf("guarded('authorization-store'"))
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

  it('the persona-keyed Citizen lookup filters to passport_class = citizen IN THE QUERY', () => {
    /*
     * In the query, not in a post-filter: a delegate's `agent_participant`
     * row must never be a candidate the principal check could select, even
     * transiently. Structural, not conventional.
     */
    const fn = principalSrc.slice(principalSrc.indexOf('loadUsableCitizenPassportForAuthProfile'));
    expect(fn).toMatch(/\.eq\('passport_class',\s*'citizen'\)/);
  });

  it('personas are resolved server-side from the caller, never supplied by the caller', () => {
    /*
     * The persona scope was extracted into `listOwnedPersonaIds` so the wallet
     * route and the Journey observer answer over the SAME set (they disagreed
     * on one screen otherwise). The requirement is unchanged and now asserted
     * where it lives.
     */
    const fn = principalSrc.slice(principalSrc.indexOf('export async function listOwnedPersonaIds'));
    // Keyed on the auth profile the server derived from the Bearer token.
    expect(fn).toMatch(/\.eq\('auth_profile_id',\s*authProfileId\)/);
    expect(fn, 'a caller-supplied personaId must never key this lookup').not.toMatch(/personaIdHint|body\.personaId/);
  });

  it('the observer never passes an agent identifier into Passport resolution', () => {
    /*
     * THE ASSERTION THAT FAILS ON THE DEFECT the operator suspected. The
     * principal resolution must be keyed on the CALLER, never on the journey's
     * agent subject.
     */
    const passportGuard = stateSrc.slice(
      stateSrc.indexOf("guarded('passport'"),
      stateSrc.indexOf("guarded('authorization-store'"),
    );
    expect(passportGuard, 'passport guard not found — the route moved').not.toBe('');
    expect(passportGuard, 'the agent must never key the principal Passport lookup').not.toMatch(
      /loadUsableCitizenPassportForAuthProfile\([^)]*agent\./,
    );
    /*
     * RE-POINTED with the DID-removal ruling. This asserted the lookup was
     * keyed via `resolvePassportPrincipalForAuthUser(authUserId)` — a resolver
     * now forbidden in recognition entirely, so the old assertion would defend
     * the very thing CANARY 3 forbids. The requirement that survives is what
     * it was really protecting: the lookup is keyed on the AUTHENTICATED
     * CALLER, never on the journey's agent subject.
     */
    expect(passportGuard, 'the principal lookup must be keyed on the authenticated caller').toMatch(
      /loadUsableCitizenPassportForAuthProfile\(supabase,\s*caller\?\.authProfileId/,
    );
  });

  /*
   * RE-POINTED TWICE (2026-08-03), and this is why they were not deleted.
   *
   * v1 asserted the ORDER of the old model: DID walk first, credential as a
   * fallback. v2 inverted it. The operator then ruled the fallback out
   * entirely:
   *
   *   > "The Passport is the surfaced constitutional identifier. The DID is a
   *   >  protected sovereign identity primitive used behind the Passport's
   *   >  cryptographic binding, not a routine discovery key."
   *
   * So an ORDERING assertion is now the wrong shape at any polarity — there
   * is only one lookup. What survives both corrections is the requirement
   * underneath: recognition must never depend on, or disclose, a raw DID.
   */
  it('CANARY 1+2 — recognition surfaces the credential and exposes NO raw DID', () => {
    const guard = passportGuardCode();
    expect(guard).toContain('loadUsableCitizenPassportForAuthProfile');
    // No sovereign primitive is read, recorded, or returned on this path.
    expect(guard, 'a raw kybe id appears in recognition').not.toMatch(/kybeId|kybe_identity_id|kybe_did/);
    expect(guard, 'a raw root id appears in recognition').not.toMatch(/rootIdentityId|root_identity_id|rootDid/);
  });

  it('CANARY 3 — no ordinary Passport observer queries by raw DID', () => {
    const guard = passportGuardCode();
    expect(guard, 'the DID walk is still reachable from stage recognition').not.toContain(
      'resolvePassportPrincipalForAuthUser',
    );
    expect(guard, 'the DID walk is still reachable from stage recognition').not.toContain('resolvePassportPrincipal(');
  });

  it('CANARY 4 — a missing DID never causes a valid Passport to be rejected', () => {
    /*
     * Structural: `loadUsableCitizenPassportForAuthProfile` selects only
     * credential fields. If it neither selects nor filters a DID column, no
     * DID state can influence whether a Passport is recognised.
     */
    const fn = principalSrc.slice(
      principalSrc.indexOf('export async function loadUsableCitizenPassportForAuthProfile'),
    );
    const body = fn.slice(0, fn.indexOf('\n}\n') + 3);
    expect(body, 'the credential lookup filters on a DID column').not.toMatch(/kybe_identity_id|root_identity_id/);
    expect(body).toMatch(/\.eq\('passport_class',\s*'citizen'\)/);
  });

  it('CANARY 5 — DID disclosure remains confined to identity verification', () => {
    /*
     * The kybe walk still exists and is still correct — for passport-native
     * SIGN-IN, which is the explicit verification context and legitimately
     * needs a kybe-anchored principal to mint a session. The rule is that it
     * is reachable ONLY from there.
     */
    expect(principalSrc).toContain('loadUsablePassportByKybe');
    const walletWalk = principalSrc.slice(
      principalSrc.indexOf('export async function resolvePassportPrincipal('),
      principalSrc.indexOf('export async function resolvePassportPrincipalByWorldId'),
    );
    expect(walletWalk, 'session minting must still demand a kybe-anchored principal').toContain(
      'loadUsablePassportByKybe',
    );
  });

  it('the auth/session-minting path is left demanding a full kybe-anchored principal', () => {
    /*
     * The fallback answers "may this caller sponsor?" — a read. It must not
     * become a way to MINT a session without personhood, so
     * resolvePassportPrincipal / ForAuthUser keep the kybe walk unchanged.
     */
    const walletWalk = principalSrc.slice(
      principalSrc.indexOf('export async function resolvePassportPrincipal('),
      principalSrc.indexOf('export async function resolvePassportPrincipalByWorldId'),
    );
    expect(walletWalk).toContain('loadUsablePassportByKybe');
    expect(walletWalk, 'the session-minting path must not adopt the persona fallback').not.toContain(
      'loadUsableCitizenPassportForAuthProfile',
    );
  });
});

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * A PATH IS NOT A URL (2026-08-03)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Delegate Passport submission refused with:
 *
 *   agent_identity.agent_card.agent_card_url — Must be a valid http(s) URL
 *
 * `registrableAgents.agentCardPath` is a PATH ('/api/agents/nakamoto/
 * agent-card.json'); it was handed to the Bureau as `prefillAgentCardUrl`,
 * where the Bureau anchors participant identity and validates a URL. The name
 * of the source field said `Path` and the name of the destination said `Url`,
 * and nothing checked that the two agreed.
 *
 * The origin is read from the BROWSER, never a configured or guessed host
 * (CLAUDE.md No-Guessing), and never during render (`window` is undefined
 * server-side — the SSR/CSR rule).
 */
describe('the Bureau receives an absolute Agent Card URL, never a bare path', () => {
  const tabSrc = fs.readFileSync(
    path.join(__dirname, '..', 'app/triad/components/codex/tabs/PilotJourneyTab.tsx'),
    'utf8',
  );

  it('prefillAgentCardUrl is origin-qualified, not the raw path', () => {
    // THE ASSERTION THAT FAILS ON THE DEFECT.
    expect(tabSrc, 'the raw path is passed where a URL is required').not.toMatch(
      /prefillAgentCardUrl:\s*selectedAgent\.agentCardPath\s*,/,
    );
    expect(tabSrc).toMatch(/prefillAgentCardUrl:[^\n]*\$\{origin\}\$\{selectedAgent\.agentCardPath\}/);
  });

  it('the origin comes from the browser, never a hardcoded or inferred host', () => {
    expect(tabSrc).toMatch(/window\.location\.origin/);
    expect(tabSrc, 'a deployment hostname must never be constructed here').not.toMatch(
      /https?:\/\/[a-z0-9.-]*aigentz|https?:\/\/localhost/i,
    );
  });

  it('the origin is read in an effect, never during render', () => {
    /*
     * `window` is undefined server-side; reading it in a render path is the
     * SSR/CSR mismatch CLAUDE.md forbids. State + effect, and empty until
     * mounted — a prefill that is not yet known is simply not offered.
     */
    expect(tabSrc).toMatch(/useEffect\(\(\) => \{\s*if \(typeof window !== 'undefined'\) setOrigin/);
    expect(tabSrc).toMatch(/const \[origin, setOrigin\] = useState<string>\(''\)/);
  });

  it('origin is a dependency of the surface-props resolver, so the prefill updates on mount', () => {
    // Without this the memoised callback would keep the empty first-render
    // value. Not anchored to the exact end of the array — isAdmin joined it
    // 2026-08-08 (PulseTransparencyToggle's showDiagnostics gate) — only that
    // selectedAgentSlug and origin are both still present, in order.
    expect(tabSrc).toMatch(/\[selectedAgentSlug, origin/);
  });
});

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * SPONSORSHIP, PASSPORT ISSUANCE AND DELEGATION ARE OBSERVED CANONICALLY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A steward approved Nakamoto's Delegate Passport. The Journey then reverted to
 * "ready for sponsorship" — offering an act already completed.
 *
 * The approval wrote a Passport RECORD and no receipt, and these three signals
 * read `hasReceipt(...)` alone. Same shape as the registration defect closed
 * earlier the same day, surviving in the two stages that fix had not reached.
 *
 *   > "It must not say an approved Passport or delegation did not happen solely
 *   >  because its DVN receipt is missing. That would recreate the registration
 *   >  defect."   — operator, 2026-08-03
 */
describe('Passport and Delegate resolve from canonical records, receipts corroborate', () => {
  const stateSrc = fs
    .readFileSync(path.join(__dirname, '..', 'app/api/journey/moneypenny-horizen/state/route.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  /*
   * RE-POINTED 2026-08-03, not relaxed. Three of the five signals below are
   * the SAME fact — "this agent has a Delegate Passport" — read in the
   * Passport stage, the Delegate stage and the canonical-stage map. They were
   * three separate expressions and had already drifted once: Passport went
   * canonical-first while Delegate stayed receipt-only. The fix names the fact
   * once, as `passportIssuedForAgent`.
   *
   * So the requirement each of them must still satisfy is unchanged — reach a
   * canonical record, not a receipt alone — but for those three it is now
   * satisfied THROUGH the shared binding, whose own definition is asserted
   * separately below. A signal that reads `hasReceipt(...)` directly, or a
   * `passportIssuedForAgent` that stops being canonical-first, still fails.
   */
  const PASSPORT_BINDING = 'passportIssuedForAgent';

  it.each([
    ['sponsorBinding', 'admission?.sponsorshipRecorded'],
    ['delegatePassportIssued', PASSPORT_BINDING],
    ['delegatePassportActive', PASSPORT_BINDING],
    ['boundedDelegationActive', 'admission?.delegationActive'],
    ['contextualMandate', 'admission?.delegationActive'],
  ])('%s consults the canonical record, not a receipt alone', (signal, canonical) => {
    const line = stateSrc.match(new RegExp(`${signal}:[\\s\\S]{0,140}?,\\n`))?.[0] ?? '';
    expect(line, `${signal} not found — the route moved`).not.toBe('');
    // THE ASSERTION THAT FAILS ON THE DEFECT: a bare hasReceipt(...) read.
    expect(line, `${signal} is receipt-only`).toContain(canonical);
  });

  it('the shared Passport binding is itself canonical-first', () => {
    // Where the three signals above delegate their answer. If this becomes
    // receipt-only, all three regress at once — which is exactly why it is
    // asserted here rather than trusted.
    const decl = stateSrc.match(/const passportIssuedForAgent[\s\S]{0,240}?;\n/)?.[0] ?? '';
    expect(decl, 'the shared Passport binding is gone').not.toBe('');
    expect(decl).toContain('admission?.delegatePassportIssued');
  });

  it('the canonical stage outcomes for passport and delegate are canonical-first too', () => {
    // Scoped to the canonicalStages literal — `passport:`/`delegate:` also key
    // the platformState stages and the auditGaps map, and a loose match lands
    // on whichever appears first.
    const block = stateSrc.slice(stateSrc.indexOf('const canonicalStages'));
    const passport = block.match(/^\s*passport:[^\n]*/m)?.[0] ?? '';
    const delegate = block.match(/^\s*delegate:[^\n]*/m)?.[0] ?? '';
    expect(passport).toContain(PASSPORT_BINDING);
    expect(delegate).toContain('admission?.delegationActive');
  });

  it('a failed canonical read is disclosed as an audit gap, never rendered as "did not happen"', () => {
    /*
     * `AgentAdmissionState` is three-valued on purpose: true / false /
     * undefined, where undefined means the READ failed. `=== true` means an
     * unreadable state falls through to the receipt rather than asserting a
     * negative, and the gaps surface separately.
     */
    expect(stateSrc).toMatch(/passport: admission\?\.auditGaps/);
    expect(stateSrc).toMatch(/delegate: admission\?\.auditGaps/);
    const svc = fs.readFileSync(path.join(__dirname, '..', 'services/journey/agentAdmissionState.ts'), 'utf8');
    expect(svc).toMatch(/sponsorshipRecorded: boolean \| undefined/);
    expect(svc).toMatch(/delegatePassportIssued: boolean \| undefined/);
    expect(svc).toMatch(/delegationActive: boolean \| undefined/);
  });

  it('the Delegate Passport is matched by agent-card PATH, so a host change cannot lose it', () => {
    const svc = fs.readFileSync(path.join(__dirname, '..', 'services/journey/agentAdmissionState.ts'), 'utf8');
    expect(svc).toMatch(/new URL\(storedUrl\)\.pathname === agentCardPath/);
  });
});

/*
 * aigentMe completes on the principal's RECOGNITION ACT — and could not
 * previously complete at all.
 */
describe('aigentMe completes on activation + recorded disposition', () => {
  const aigentme = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'aigentme')!;

  it('requires exactly the two signals of the act itself', () => {
    expect(aigentme.completionEvidence).toEqual(['aigentMeActive', 'focusDispositionRecorded']);
  });

  it('no longer gates on its own downstream completion', () => {
    /*
     * THE ASSERTION THAT FAILS ON THE DEFECT. `evidenceChainComplete` read
     * `journey_completed`, which cannot exist until the journey completes,
     * which cannot happen until aigentMe completes. Unreachable by
     * construction — no operator act could ever have satisfied it.
     */
    expect(aigentme.completionEvidence).not.toContain('evidenceChainComplete');
  });

  it('does not re-observe Delegate’s outcome', () => {
    // Delegate is aigentMe's prerequisite; the stepper enforces the ordering.
    // Requiring `agent_delegated` again made aigentMe a second observer of it.
    expect(aigentme.completionEvidence).not.toContain('moneypennyRecordedAsDelegatedAgent');
  });
});

/*
 * ══ EVERY STAGE MUST HAVE AN EVIDENCE ENTRY, KEYED BY ITS OWN ID ══════════
 *
 * The defect this closes (operator, 2026-08-03: "ensure passport, delegate,
 * aigentMe, ingest to factory and standing all flip to emerald at the right
 * stages"):
 *
 * The Activate stage was renamed `deploy` and Standing was split out of it on
 * 2026-08-02. The observer's evidence map kept the key `activate`. Stage
 * evidence is looked up BY STAGE ID, so `deploy` and `standing` read an
 * evidence record that did not exist — every field missing, every request —
 * while `activate` described a stage no longer in the journey.
 *
 * Nothing errored. Nothing logged. Two stages simply could never complete.
 * A rename is exactly the change most likely to cause this and least likely
 * to be noticed, which is why it is now a build failure rather than prose.
 */
describe('observer evidence keys and journey stage ids are the same set', () => {
  const stateSrc = fs.readFileSync(
    path.join(__dirname, '..', 'app/api/journey/moneypenny-horizen/state/route.ts'),
    'utf8',
  );

  /** The top-level keys of the `stages: { ... }` literal in platformState. */
  function evidenceKeys(): string[] {
    const start = stateSrc.indexOf('const platformState');
    const stagesAt = stateSrc.indexOf('stages: {', start);
    const body = stateSrc.slice(stagesAt);
    // Keys at exactly one nesting level inside `stages: {` — six spaces of
    // indentation in this file. Comment lines never match `<name>: {`.
    return Array.from(body.matchAll(/^ {6}(\w+): \{$/gm)).map((m) => m[1]);
  }

  it('every stage in the journey has an evidence entry under its own id', () => {
    const keys = new Set(evidenceKeys());
    for (const stage of HORIZEN_MONEYPENNY_JOURNEY.stages) {
      expect(keys.has(stage.id), `no evidence entry for stage "${stage.id}"`).toBe(true);
    }
  });

  it('no evidence entry names a stage that does not exist', () => {
    const stageIds = new Set(HORIZEN_MONEYPENNY_JOURNEY.stages.map((s) => s.id));
    for (const key of evidenceKeys()) {
      expect(stageIds.has(key), `evidence key "${key}" names no stage`).toBe(true);
    }
  });

  it('every field a stage requires is supplied by that stage’s evidence entry', () => {
    /*
     * The second half of the same class: a key that matches its stage but
     * omits a field the stage's `completionEvidence` demands is missing
     * forever. Deploy's old entry supplied `delegatePassportActive` /
     * `boundedDelegationActive` / `standingGatewayEnabled` — Delegate's and
     * Standing's outcomes — and none of its own.
     */
    const start = stateSrc.indexOf('const platformState');
    const body = stateSrc.slice(stateSrc.indexOf('stages: {', start));
    for (const stage of HORIZEN_MONEYPENNY_JOURNEY.stages) {
      const entryAt = body.indexOf(`\n      ${stage.id}: {`);
      if (entryAt < 0) continue; // covered by the test above
      const entry = body.slice(entryAt, body.indexOf('\n      },', entryAt));
      for (const field of stage.completionEvidence) {
        // `name:` or ES shorthand `name,` — Register's entry uses both forms.
        const supplied = new RegExp(`\\b${field}\\s*[:,]`).test(entry);
        expect(supplied, `stage "${stage.id}" needs "${field}"`).toBe(true);
      }
    }
  });
});

/*
 * ══ INGESTION AND ISSUANCE ARE OBSERVED CANONICALLY ═══════════════════════
 */
describe('Deploy observes registry presence; Passport observes the receipt the Bureau writes', () => {
  const stateSrc = fs.readFileSync(
    path.join(__dirname, '..', 'app/api/journey/moneypenny-horizen/state/route.ts'),
    'utf8',
  );
  const admissionSrc = fs.readFileSync(
    path.join(__dirname, '..', 'services/journey/agentAdmissionState.ts'),
    'utf8',
  );

  it('Deploy completes on its OWN outcome, not on Delegate’s or Standing’s', () => {
    const deploy = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'deploy')!;
    expect(deploy.completionEvidence).toEqual(['factoryIngested']);
    // Standing is Deploy's SUCCESSOR — requiring it here was a cycle.
    expect(deploy.completionEvidence).not.toContain('standingGatewayEnabled');
  });

  it('registry presence is read canonically, per "presence there is a receipt in itself"', () => {
    expect(admissionSrc).toMatch(/from\('registry_assets'\)/);
    expect(admissionSrc).toMatch(/factoryPresent: boolean \| undefined/);
    const block = stateSrc.slice(stateSrc.indexOf('const canonicalStages'));
    expect(block.match(/^\s*deploy:[^\n]*/m)?.[0] ?? '').toContain('admission?.factoryPresent');
  });

  it('Standing has NO canonical shortcut — an accrual is the only thing that accrues', () => {
    /*
     * Deliberately asymmetric with Deploy. Reading registry presence for
     * Standing would collapse "admitted" into "has earned", which the
     * operator's ingestion-is-not-accrual ruling forbids.
     */
    const block = stateSrc.slice(stateSrc.indexOf('const canonicalStages'));
    const end = block.indexOf('\n  };');
    expect(block.slice(0, end)).not.toMatch(/^\s*standing:/m);
  });

  it('the Delegate Passport is corroborated by passport_issued — the receipt that is actually written', () => {
    /*
     * `agent_delegate_passport_issued` is emitted by NOTHING in this codebase.
     * The Bureau's canonical issuance path writes `passport_issued` through the
     * normal DVN-anchored pipeline. Waiting on the phantom type is why an
     * approved Passport left the stage amber.
     */
    expect(stateSrc).toMatch(/const passportIssuedForAgent[\s\S]{0,200}hasReceipt\('passport_issued'\)/);
    const passportStage = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'passport')!;
    expect(passportStage.receiptTypes).toContain('passport_issued');
  });

  it('the issuance receipt is attributed to the agent, so agent-scoped readers can see it', () => {
    /*
     * Every agent-scoped reader matches on `agents_invoked`. An issuance
     * receipt that names only the applying persona is real, anchored, and
     * invisible to the journey.
     */
    const issuance = fs.readFileSync(
      path.join(__dirname, '..', 'services/passport/issuanceService.ts'),
      'utf8',
    );
    expect(issuance).toMatch(/agentsInvoked: isCitizen \? undefined : await resolveAgentRefsForCard/);
  });

  it('the Delegate Passport is found via the application that carries the agent card URL', () => {
    /*
     * `agent_card_url` exists on polity_passport_applications and NOT on
     * polity_passport_records. Selecting it off the records table made
     * PostgREST reject the whole query, so the read failed honestly and
     * `delegatePassportIssued` stayed undefined forever — the Passport stage
     * could not go green no matter how many Passports were issued.
     */
    expect(admissionSrc).toMatch(/from\('polity_passport_applications'\)[\s\S]{0,120}agent_card_url/);
    expect(admissionSrc).toMatch(/\.in\('application_id', applicationIds\)/);
    const recordsQuery = admissionSrc.slice(admissionSrc.indexOf("from('polity_passport_records')"));
    expect(recordsQuery.slice(0, 200)).not.toContain('agent_card_url');
  });
});

/*
 * ══ THE FACTORY SURFACE OPENS ON WHAT IS ALREADY THERE ════════════════════
 */
describe('the Deploy stage deep-links into Ingested Assets', () => {
  it('pins the Ingestion Factory to its assets section', () => {
    const deploy = HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === 'deploy')!;
    const surface = deploy.surfaces[0] as { props?: Record<string, unknown> };
    expect(surface.props?.only).toBe('registry');
    expect(surface.props?.registrySection).toBe('assets');
  });

  it('the panel honours an initial section instead of always opening on the ingest form', () => {
    const panel = fs.readFileSync(
      path.join(__dirname, '..', 'components/registry/IngestionFactoryPanel.tsx'),
      'utf8',
    );
    expect(panel).toMatch(/initialSection = "ingest"/);
    expect(panel).toMatch(/useState<"ingest" \| "pipeline" \| "assets">\(initialSection\)/);
    const tab = fs.readFileSync(
      path.join(__dirname, '..', 'app/triad/components/codex/tabs/ParticipationStandingTab.tsx'),
      'utf8',
    );
    expect(tab).toMatch(/<IngestionFactoryPanel initialSection=\{registrySection\} \/>/);
  });
});

/*
 * ══ THE MIGRATED-AGENT GAP ═════════════════════════════════════════════════
 *
 * An agent that walks Register -> Claim -> Passport WITHOUT ever passing
 * through Agent Homecoming's stand-up step (which seeds the RootDID BEFORE
 * Passport issuance) can have an APPROVED Delegate Passport and NO
 * `agent_root_identity` row at all. Nakamoto is this exact case (operator,
 * 2026-08-03): sponsorship and delegation read `agent_root_identity`, so both
 * stayed real negatives forever despite an issued VC, and she was invisible
 * in the Locker's "Sponsored Agents" list and the Delegate agent-picker.
 *
 * The fix mints the RootDID at the point the operator's own ruling says it
 * should: "Passport issuance mints the DID." These canaries guard the two
 * ways that mint could quietly regress into a NEW disagreeing-identifier bug
 * — the same defect class this whole file exists to catch.
 */
describe('a migrated agent whose Passport is approved gets its RootDID minted, not skipped', () => {
  const admissionSrc = fs.readFileSync(
    path.join(__dirname, '..', 'services/journey/agentAdmissionState.ts'),
    'utf8',
  );
  const sponsorSrc = fs.readFileSync(
    path.join(__dirname, '..', 'services/agents/sponsorPolityAgent.ts'),
    'utf8',
  );

  it('self-heals only when the Passport is issued and no root identity exists yet', () => {
    const call = admissionSrc.match(/if \(delegatePassportIssued === true[\s\S]{0,200}?\{/)?.[0] ?? '';
    expect(call, 'the self-heal gate is gone').not.toBe('');
    expect(call).toContain('!agentRootDid');
    expect(call).toContain('auditGaps.length === 0');
  });

  it('mints the agent\'s PRE-EXISTING identity, never a fresh slug-derived one', () => {
    // THE ASSERTION THAT FAILS ON THE DEFECT: minting via a bare slug would
    // create agent_id 'polity-bound:<slug>', a SECOND identifier disagreeing
    // with the `runtimeAgentId` Register/Claim/receipts already use for this
    // agent — exactly the two-sources-of-truth shape this session kept fixing.
    const mintCall = admissionSrc.slice(admissionSrc.indexOf('const result = await sponsorPolityAgent('));
    const call = mintCall.slice(0, mintCall.indexOf('\n  }\n') + 1);
    expect(call).toContain('existingIdentity');
    expect(call).toContain('agent.runtimeAgentId');
    expect(call).toContain('migratedAgentApprovedPassportId');
  });

  it('resolves the sponsor from the CALLER, never from the application row', () => {
    /*
     * agent-participant applications ride /api/polity-passport/submit, a
     * DELIBERATELY persona-less machine surface. An application-derived
     * `persona_id` is always null on that path — reading it as the sponsor
     * would silently no-op the mint for every real Nakamoto-shaped agent.
     */
    expect(admissionSrc).toMatch(/callerAuthProfileId: string \| null/);
    expect(admissionSrc).toMatch(/listOwnedPersonaIds\(admin, callerAuthProfileId\)/);
    expect(admissionSrc).not.toMatch(/sponsorPersonaId:\s*row\?\.persona_id/);
  });

  it('never blocks on ordinary sponsorship capacity — the sponsoring act already happened at approval', () => {
    expect(sponsorSrc).toMatch(/migratedAgentApprovedPassportId/);
    const branch = sponsorSrc.match(/if \(migratedAgentApprovedPassportId\)[\s\S]{0,260}?\}/)?.[0] ?? '';
    expect(branch, 'the migrated-agent capacity branch is gone').not.toBe('');
    expect(branch).toContain("authority: 'migrated_agent_passport_issuance'");
  });

  it('the override authority is distinct from an administrator override, not silently reused', () => {
    expect(sponsorSrc).toMatch(
      /authority: 'administrator' \| 'migrated_agent_passport_issuance'/,
    );
  });

  it('binds the freshly-minted identity to the passport that justified minting it', () => {
    const bindCall = admissionSrc.slice(admissionSrc.indexOf("from('agent_root_identity')\n      .update"));
    expect(bindCall.slice(0, 200)).toContain('bound_passport_id: passportId');
  });
});
