/**
 * PILOT-WALLET-EXCEPTION-001 — evidence is not authority.
 *
 * The wallet-binding trace (#121) found that Aigent Z's 4,000,000 Base Q¢ sits
 * at the platform deployer EOA — a hardcoded literal in `agentConfig.ts`, keyed
 * by `SIGNER_PRIVATE_KEY`, and recorded in the key-rotation register as
 * "already flagged compromised; treat as burned."
 *
 * The operator accepted a bounded exception rather than blocking the pilot on a
 * key migration mid-onboarding. What makes that safe is one distinction:
 *
 *   > "The pilot may accept WALLET EVIDENCE without accepting WALLET AUTHORITY."
 *
 * Evidence is a historical fact one may display. Authority is permission to
 * produce a consequence. These canaries exist because the failure mode is not
 * anyone DECIDING the compromised key should carry authority — it is nobody
 * distinguishing the two, and the legacy wallet becoming the foundation by
 * default.
 */

import { describe, it, expect } from 'vitest';

import {
  PILOT_WALLET_EXCEPTION,
  PILOT_RUNS,
  AIGENT_Z_WALLET_ROTATION,
  mayProduceSignature,
  mayDisplayAsEvidence,
  liveRunMayOpen,
  type WalletCapability,
} from '@/services/wallet/pilotWalletException';
import { readSource, stripComments } from './_lib/sourceAuthority';

const ALL: WalletCapability[] = [
  'SIGNER_READY',
  'ADDRESS_ONLY',
  'LEGACY_EVIDENCE_ONLY',
  'PRESENT_BUT_UNBOUND',
  'ABSENT',
  'MALFORMED',
  'AMBIGUOUS',
  'COMPROMISED',
  'UNAVAILABLE',
];

describe('only one capability may produce a signature', () => {
  it('SIGNER_READY and nothing else', () => {
    for (const c of ALL) {
      expect(mayProduceSignature(c), `${c} must not be signable`).toBe(c === 'SIGNER_READY');
    }
  });

  it('LEGACY_EVIDENCE_ONLY may be displayed but may never sign — the whole point of the exception', () => {
    expect(mayDisplayAsEvidence('LEGACY_EVIDENCE_ONLY')).toBe(true);
    expect(mayProduceSignature('LEGACY_EVIDENCE_ONLY')).toBe(false);
  });

  it('ADDRESS_ONLY is displayable-as-evidence NO and signable NO', () => {
    // The three provisioning paths that write 20 random bytes with no key
    // behind them produce this. Today's resolver reports them as `resolved`
    // and a ceremony will offer a mandate that can never be signed.
    expect(mayProduceSignature('ADDRESS_ONLY')).toBe(false);
    expect(mayDisplayAsEvidence('ADDRESS_ONLY')).toBe(false);
  });

  it('UNAVAILABLE is not ABSENT — a failed lookup must never render as "you have none"', () => {
    expect(mayProduceSignature('UNAVAILABLE')).toBe(false);
    expect(ALL).toContain('UNAVAILABLE');
    expect(ALL).toContain('ABSENT');
  });
});

describe('the exception is bounded, named, and carries its own exit', () => {
  it('scopes to the two pilot runs — never to the platform', () => {
    expect(PILOT_WALLET_EXCEPTION.id).toBe('PILOT-WALLET-EXCEPTION-001');
    expect(PILOT_WALLET_EXCEPTION.scope.join(' ')).toMatch(/Nakamoto rehearsal/i);
    expect(PILOT_WALLET_EXCEPTION.scope.join(' ')).toMatch(/MoneyPenny live/i);
    expect(PILOT_WALLET_EXCEPTION.scope.join(' ')).not.toMatch(/platform|all agents|global/i);
  });

  it('prohibits every path by which the legacy key could acquire authority', () => {
    const p = PILOT_WALLET_EXCEPTION.prohibited.join(' | ');
    expect(p).toMatch(/signing a principal mandate/i);
    expect(p).toMatch(/delegation authority/i);
    expect(p).toMatch(/clean Aigent Z operating float/i);
    expect(p).toMatch(/controller for Nakamoto or MoneyPenny/i);
    expect(p).toMatch(/substituting for the human principal wallet/i);
    expect(p).toMatch(/Reusing this exception for another agency/i);
  });

  it('permits orchestration only — Aigent Z observes and records, it does not sign as subject', () => {
    expect(PILOT_WALLET_EXCEPTION.permitted.join(' ')).toMatch(/ORCHESTRATOR/);
    for (const run of PILOT_RUNS) {
      expect(run.subjectAgentSlug, 'Aigent Z is the orchestrator, never the subject').not.toMatch(/aigent-?z/i);
    }
  });

  it('names the remediation that retires it, and when it must run', () => {
    expect(PILOT_WALLET_EXCEPTION.retiredBy).toBe('AIGENT-Z-WALLET-ROTATION-001');
    expect(AIGENT_Z_WALLET_ROTATION.id).toBe(PILOT_WALLET_EXCEPTION.retiredBy);
    // Same trigger in both places — an exception whose exit has drifted from
    // its remediation has quietly become the architecture.
    expect(AIGENT_Z_WALLET_ROTATION.trigger).toBe(PILOT_WALLET_EXCEPTION.retirementTrigger);
    expect(PILOT_WALLET_EXCEPTION.retirementTrigger).toMatch(/before Stone agency onboarding/i);
  });

  it('the rotation scope includes quarantining the legacy address, not just minting a new one', () => {
    const s = AIGENT_Z_WALLET_ROTATION.scope.join(' | ');
    expect(s).toMatch(/Legacy address quarantine/i);
    expect(s).toMatch(/Receipt continuity/i);
    expect(s).toMatch(/agentConfig\.ts literal cleanup/i);
  });
});

describe('rehearsal before live, on evidence rather than judgement', () => {
  it('Nakamoto rehearses, MoneyPenny goes live, and both walk the same path', () => {
    const [rehearsal, live] = PILOT_RUNS;
    expect(rehearsal.kind).toBe('rehearsal');
    expect(rehearsal.subjectAgentSlug).toBe('nakamoto');
    expect(live.kind).toBe('live');
    expect(live.subjectAgentSlug).toBe('moneypenny');
    // Identical governed path — a rehearsal that skipped a stage would prove
    // nothing about the stage it skipped.
    expect([...rehearsal.stages]).toEqual([...live.stages]);
    expect([...live.stages]).toEqual(['register', 'verify', 'claim', 'passport', 'delegate', 'activate']);
  });

  it('the live run opens only on complete, fully receipted, refusal-free rehearsal evidence', () => {
    expect(liveRunMayOpen({ complete: true, allRequiredReceiptsPresent: true, unresolvedRefusals: 0 })).toBe(true);
    // Each condition alone blocks — an unresolved refusal in particular, since
    // surfacing one is exactly what a rehearsal is for.
    expect(liveRunMayOpen({ complete: false, allRequiredReceiptsPresent: true, unresolvedRefusals: 0 })).toBe(false);
    expect(liveRunMayOpen({ complete: true, allRequiredReceiptsPresent: false, unresolvedRefusals: 0 })).toBe(false);
    expect(liveRunMayOpen({ complete: true, allRequiredReceiptsPresent: true, unresolvedRefusals: 1 })).toBe(false);
  });

  it('the rehearsal implies no production authority, and says so', () => {
    expect(PILOT_RUNS[0].precondition).toMatch(/no production or pilot authority is implied/i);
  });
});

describe('the exception record is a statement, not a mechanism', () => {
  it('it grants nothing by itself — no store, no signer, no key', () => {
    const src = stripComments(readSource('services/wallet/pilotWalletException.ts'));
    for (const forbidden of ['supabase', '.insert(', '.update(', 'privateKey', 'signMessage', 'Wallet(']) {
      expect(src, `an exception RECORD must not ${forbidden} — recording a risk is not taking an action`).not.toContain(
        forbidden,
      );
    }
  });

  it('it never hardcodes the legacy address it is about', () => {
    const src = readSource('services/wallet/pilotWalletException.ts');
    expect(
      src,
      'copying the deployer address here would spread the literal the rotation exists to remove',
    ).not.toMatch(/0x[0-9a-fA-F]{40}/);
  });
});
