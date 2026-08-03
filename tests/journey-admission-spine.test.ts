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

const SPINE = ['register', 'claim', 'passport', 'delegate', 'aigentme'] as const;

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
    expect(byId('passport').prerequisites).toEqual(['claim']);
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
    const fn = principalSrc.slice(principalSrc.indexOf('loadUsableCitizenPassportForAuthProfile'));
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
