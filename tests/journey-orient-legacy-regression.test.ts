/**
 * Horizen Journey correction (2026-08-09) — Nakamoto's completed admission
 * visually regressed when Orient was inserted between Claim and Passport.
 *
 * ── ROOT CAUSE ──────────────────────────────────────────────────────────────
 *
 * `resolveJourneyState` (services/journey/resolveJourneyState.ts) checked
 * `!prerequisitesMet` BEFORE checking whether a stage's OWN evidence was
 * already complete. So a stage with fully-present completion evidence still
 * rendered BLOCKED the instant ANY prerequisite's state (computed in the same
 * pass) was not itself COMPLETE. Inserting Orient added exactly such a
 * prerequisite to Passport — and Nakamoto's admission predates Orient, so her
 * `orient` evidence is genuinely absent. Every downstream stage (Passport,
 * Delegate, Operate/aigentMe, Ratify, Ingest) rendered BLOCKED despite each
 * holding real, pre-existing completion evidence of its own.
 *
 * ── THE FIX ─────────────────────────────────────────────────────────────────
 *
 * `resolveJourneyState` now checks evidence-complete BEFORE the prerequisite
 * check: "has this stage's own ceremony already happened?" outranks "would
 * this stage be available to begin from scratch today?". Prerequisites still
 * govern entry into an INCOMPLETE stage; they can no longer erase a
 * historically-established one.
 *
 * ── LEGACY ORIENT COMPATIBILITY ─────────────────────────────────────────────
 *
 * The resolver fix alone repairs every stage DOWNSTREAM of Orient. It does
 * NOT make Orient itself read complete for Nakamoto, because Orient's own
 * evidence (`orientationComplete`) is genuinely absent — she never performed,
 * and could never have performed, an acknowledgment ritual that did not exist
 * yet. `orientationLegacyPrecedentEstablished` (services/journey/
 * orientationContext.ts) supplies that missing signal HONESTLY: derived from
 * her ALREADY-established downstream facts (issued Passport, active bounded
 * delegation, activated aigentMe), never a fabricated
 * `orientation_ritual_completed` receipt.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { resolveJourneyState } from '@/services/journey/resolveJourneyState';
import { resolveMonotonicJourneyState } from '@/services/journey/stageResolution';
import { HORIZEN_MONEYPENNY_JOURNEY } from '@/services/journey/horizenMoneyPennyJourney';
import { orientationLegacyPrecedentEstablished } from '@/services/journey/orientationContext';
import type { JourneyDefinition } from '@/types/journey';
import type { AuthoritativePlatformState } from '@/services/journey/resolveJourneyState';

// ═══════════════════════════════════════════════════════════════════════════
// GENERIC RESOLVER INVARIANT — proven on a synthetic journey, not Horizen's,
// so the fix is provably general rather than a Nakamoto-shaped patch.
// ═══════════════════════════════════════════════════════════════════════════
describe('established completion evidence outranks a newly-inserted prerequisite (generic)', () => {
  const SYNTHETIC: JourneyDefinition = {
    id: 'synthetic-spine',
    version: '1.0.0',
    label: 'Synthetic',
    subjectRef: 'agent-n',
    stages: [
      { id: 'a', label: 'A', description: '', actor: 'x', subjectRef: 'x', surfaces: [], prerequisites: [], permittedActions: [], completionEvidence: ['aDone'], receiptTypes: [], companion: { before: '', complete: '' } },
      { id: 'b', label: 'B', description: '', actor: 'x', subjectRef: 'x', surfaces: [], prerequisites: ['a'], permittedActions: [], completionEvidence: ['bDone'], receiptTypes: [], companion: { before: '', complete: '' } },
      // 'c' is the NEWLY INSERTED stage — 'd' now requires it, mirroring Orient's insertion between Claim and Passport.
      { id: 'c', label: 'C (new)', description: '', actor: 'x', subjectRef: 'x', surfaces: [], prerequisites: ['b'], permittedActions: [], completionEvidence: ['cDone'], receiptTypes: [], companion: { before: '', complete: '' } },
      { id: 'd', label: 'D', description: '', actor: 'x', subjectRef: 'x', surfaces: [], prerequisites: ['c'], permittedActions: [], completionEvidence: ['dDone'], receiptTypes: [], companion: { before: '', complete: '' } },
    ],
  };

  // A legacy subject: 'a' and 'b' and 'd' all have REAL, pre-existing
  // evidence (established before 'c' existed); 'c' has none, honestly.
  const legacyPlatformState: AuthoritativePlatformState = {
    stages: {
      a: { aDone: true },
      b: { bDone: true },
      c: {}, // genuinely absent — never fabricated
      d: { dDone: true },
    },
  };

  it('REPRODUCES THE DEFECT on the pre-fix ordering (mutation proof)', () => {
    // Pinned mutation: re-run the OLD ordering inline to prove the historical
    // behaviour this canary guards against, without re-editing the resolver.
    function legacyResolve(journey: JourneyDefinition, platformState: AuthoritativePlatformState) {
      const stageStates: { stageId: string; state: string }[] = [];
      for (const stage of journey.stages) {
        const evidence = platformState.stages[stage.id];
        const missing = stage.completionEvidence.filter((f) => !evidence?.[f]);
        const prerequisitesMet = stage.prerequisites.every(
          (p) => stageStates.find((s) => s.stageId === p)?.state === 'COMPLETE',
        );
        let state: string;
        if (!prerequisitesMet) state = 'BLOCKED';
        else if (missing.length === 0) state = 'COMPLETE';
        else state = 'NOT_STARTED';
        stageStates.push({ stageId: stage.id, state });
      }
      return stageStates;
    }
    const legacy = legacyResolve(SYNTHETIC, legacyPlatformState);
    expect(legacy.find((s) => s.stageId === 'd')?.state, 'the historical defect: D BLOCKED despite its own evidence').toBe(
      'BLOCKED',
    );
  });

  it('POST-FIX: D keeps its established COMPLETE state despite C (its new prerequisite) being absent', () => {
    const resolved = resolveJourneyState(SYNTHETIC, legacyPlatformState);
    expect(resolved.stages.find((s) => s.stageId === 'd')?.state).toBe('COMPLETE');
  });

  it('C itself — the genuinely new, unfinished stage — is NOT complete (no evidence fabricated)', () => {
    const resolved = resolveJourneyState(SYNTHETIC, legacyPlatformState);
    expect(resolved.stages.find((s) => s.stageId === 'c')?.state).not.toBe('COMPLETE');
  });

  it('a brand-new subject with NO evidence anywhere still cannot bypass the new stage', () => {
    const freshState: AuthoritativePlatformState = { stages: { a: {}, b: {}, c: {}, d: {} } };
    const resolved = resolveJourneyState(SYNTHETIC, freshState);
    expect(resolved.stages.find((s) => s.stageId === 'd')?.state).toBe('BLOCKED');
    expect(resolved.stages.find((s) => s.stageId === 'c')?.state).not.toBe('COMPLETE');
  });

  it('a partially-progressed subject (A done, B not) is genuinely BLOCKED at C — prerequisites still gate incomplete stages', () => {
    const partial: AuthoritativePlatformState = { stages: { a: { aDone: true }, b: {}, c: {}, d: {} } };
    const resolved = resolveJourneyState(SYNTHETIC, partial);
    expect(resolved.stages.find((s) => s.stageId === 'c')?.state).toBe('BLOCKED');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE ACTUAL HORIZEN SPINE — Nakamoto's shape, reproduced without any live
// Supabase dependency (pure resolver call, mirroring nakamotoPlatformState()
// in tests/journey-monotonic-admission.test.ts).
// ═══════════════════════════════════════════════════════════════════════════
describe('Nakamoto — a legacy agent whose admission predates Orient is not regressed', () => {
  function nakamotoLikeState(overrides: Partial<AuthoritativePlatformState['stages']> = {}): AuthoritativePlatformState {
    return {
      stages: {
        register: { aigentQubeResolved: true, tokenId: '8798', registryRereadOk: true, ownerWalletMatches: true, agentCardResolves: true },
        claim: { controlProofFresh: true },
        // Orient is NEWER than this admission — genuinely absent, never fabricated.
        orient: {},
        passport: { operatorPolityCitizenPassportValid: true, sponsorBinding: true, delegatePassportIssued: true },
        delegate: { delegatePassportActive: true, boundedDelegationActive: true, personaAssignedAsDelegate: true },
        aigentme: { aigentMeActive: true, focusDispositionRecorded: true },
        verify: {
          agreementTermsCommitted: true,
          agreementAcceptanceRecorded: true,
          agreementAuthorized: true,
          agreementReceiptsAnchored: true,
          agreementGateRecognized: true,
        },
        deploy: { factoryIngested: true },
        standing: {}, // genuinely not yet earned
        ...overrides,
      },
    };
  }

  it('Passport, Delegate, Operate, Ratify and Ingest all resolve COMPLETE from their OWN pre-existing evidence', () => {
    const resolved = resolveJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoLikeState());
    for (const id of ['passport', 'delegate', 'aigentme', 'verify', 'deploy']) {
      expect(resolved.stages.find((s) => s.stageId === id)?.state, `${id} regressed`).toBe('COMPLETE');
    }
  });

  it('Stand remains genuinely incomplete — the fix never manufactures completion for an unearned stage', () => {
    const resolved = resolveJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoLikeState());
    expect(resolved.stages.find((s) => s.stageId === 'standing')?.state).not.toBe('COMPLETE');
  });

  it('Orient resolves COMPLETE once the legacy-precedent signal is supplied as canonical (the state route\'s own wiring)', () => {
    const legacyPrecedent = orientationLegacyPrecedentEstablished({
      delegatePassportIssued: true,
      delegationActive: true,
      aigentMeActivated: true,
    });
    expect(legacyPrecedent).toBe(true);

    const resolution = resolveMonotonicJourneyState(HORIZEN_MONEYPENNY_JOURNEY, nakamotoLikeState(), {
      canonicalOutcomes: { register: true, orient: legacyPrecedent },
    });
    const orient = resolution.stages.find((s) => s.stageId === 'orient');
    expect(orient?.status).toBe('COMPLETE');
    expect(orient?.canonicalOutcome).toBe(true);
  });

  it('a brand-new agent (no downstream facts) can NEVER satisfy the legacy-precedent predicate', () => {
    expect(
      orientationLegacyPrecedentEstablished({ delegatePassportIssued: false, delegationActive: false, aigentMeActivated: false }),
    ).toBe(false);
  });

  it('legacy precedent requires ALL THREE facts — partial progression is not a loophole', () => {
    expect(orientationLegacyPrecedentEstablished({ delegatePassportIssued: true, delegationActive: false, aigentMeActivated: true })).toBe(
      false,
    );
    expect(orientationLegacyPrecedentEstablished({ delegatePassportIssued: true, delegationActive: true, aigentMeActivated: false })).toBe(
      false,
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MoneyPenny — a LIVE, still-progressing journey. The resolver fix must not
// let her skip Orient just because the fix exists.
// ═══════════════════════════════════════════════════════════════════════════
describe('MoneyPenny — a live, incomplete journey still cannot bypass Orient', () => {
  it('Passport stays BLOCKED when neither Orient nor Passport has any evidence yet', () => {
    const liveState: AuthoritativePlatformState = {
      stages: {
        register: { aigentQubeResolved: true, tokenId: '1', registryRereadOk: true, ownerWalletMatches: true, agentCardResolves: true },
        claim: { controlProofFresh: true },
        orient: {},
        passport: {},
        delegate: {},
        aigentme: {},
        verify: {},
        deploy: {},
        standing: {},
      },
    };
    const resolved = resolveJourneyState(HORIZEN_MONEYPENNY_JOURNEY, liveState);
    expect(resolved.stages.find((s) => s.stageId === 'orient')?.state).not.toBe('COMPLETE');
    expect(resolved.stages.find((s) => s.stageId === 'passport')?.state).toBe('BLOCKED');
  });

  it('Passport unlocks once she actually performs the Orient ritual', () => {
    const orientedState: AuthoritativePlatformState = {
      stages: {
        register: { aigentQubeResolved: true, tokenId: '1', registryRereadOk: true, ownerWalletMatches: true, agentCardResolves: true },
        claim: { controlProofFresh: true },
        orient: { orientationComplete: true },
        passport: {},
        delegate: {},
        aigentme: {},
        verify: {},
        deploy: {},
        standing: {},
      },
    };
    const resolved = resolveJourneyState(HORIZEN_MONEYPENNY_JOURNEY, orientedState);
    expect(resolved.stages.find((s) => s.stageId === 'orient')?.state).toBe('COMPLETE');
    // Passport is READY (not COMPLETE — her own evidence is still absent),
    // and crucially NOT BLOCKED.
    expect(resolved.stages.find((s) => s.stageId === 'passport')?.state).not.toBe('BLOCKED');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LABELS — exactly the operator's verb vocabulary, ids unchanged.
// ═══════════════════════════════════════════════════════════════════════════
describe('stage labels are normalized to verbs; internal ids are untouched', () => {
  const byId = (id: string) => HORIZEN_MONEYPENNY_JOURNEY.stages.find((s) => s.id === id)!;

  it('spine + fork labels read exactly as the operator vocabulary', () => {
    const order = ['register', 'claim', 'orient', 'passport', 'delegate', 'aigentme', 'verify', 'deploy', 'standing'];
    const labels = order.map((id) => byId(id).label);
    expect(labels.join(' · ')).toBe('Register · Claim · Orient · Passport · Delegate · Operate · Ratify · Ingest · Stand');
  });

  it('internal ids are unchanged — no migration needed for a label-only change', () => {
    for (const id of ['aigentme', 'verify', 'deploy', 'standing']) {
      expect(HORIZEN_MONEYPENNY_JOURNEY.stages.some((s) => s.id === id), `id "${id}" was renamed`).toBe(true);
    }
  });

  it('every receipt type, prerequisite and forkPosition still keys off the OLD ids', () => {
    // A label-only change must not have silently touched prerequisites.
    expect(byId('passport').prerequisites).toEqual(['orient']);
    expect(byId('standing').prerequisites).toEqual(['deploy']);
    expect(byId('verify').forkPosition).toBe('upper');
    expect(byId('deploy').forkPosition).toBe('middle');
    expect(byId('standing').forkPosition).toBe('lower');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GENERICITY — the fork/state observer does not read a hardcoded agent
// literal anywhere in its computation.
// ═══════════════════════════════════════════════════════════════════════════
describe('the Consequence Fork projection never resolves from a hardcoded agent literal', () => {
  const stateSrc = fs.readFileSync(
    path.join(__dirname, '..', 'app/api/journey/moneypenny-horizen/state/route.ts'),
    'utf8',
  );

  it('the consequenceFork computation block reads only the runtime-selected agent, never "moneypenny"/"nakamoto" literals', () => {
    const start = stateSrc.indexOf('const consequenceFork = {');
    const end = stateSrc.indexOf('\n  };', start);
    const block = stateSrc.slice(start, end);
    expect(block, 'consequenceFork block not found — the route moved').not.toBe('');
    expect(block.toLowerCase(), 'a hardcoded agent literal reached the fork projection').not.toMatch(/moneypenny|nakamoto/);
    expect(block).toMatch(/agent\.runtimeAgentId|receiptStatuses|ratifyAnchorStatus|stageStatus\(/);
  });

  it('the static journey definition\'s inert subjectRef/actor fields are never read by the fork or state resolution', () => {
    // Confirmed inert (Horizen Journey audit, 2026-08-09): resolution
    // persistence already bypasses `resolution.subjectRef` in favour of
    // `agent.slug` — the ONE place this route touches a subject identifier
    // for anything beyond passthrough labelling. Neither the consequenceFork
    // block nor resolveMonotonicJourneyState's stage-resolution keys off
    // `stage.subjectRef` or `stage.actor` for any decision.
    const consequenceForkAt = stateSrc.indexOf('const consequenceFork = {');
    const consequenceForkEnd = stateSrc.indexOf('\n  };', consequenceForkAt);
    const block = stateSrc.slice(consequenceForkAt, consequenceForkEnd);
    expect(block).not.toMatch(/\.subjectRef|stage\.actor/);
    const resolutionSrc = fs.readFileSync(path.join(__dirname, '..', 'services/journey/stageResolution.ts'), 'utf8');
    expect(resolutionSrc).not.toMatch(/stage\.subjectRef|stage\.actor\b/);
  });
});
