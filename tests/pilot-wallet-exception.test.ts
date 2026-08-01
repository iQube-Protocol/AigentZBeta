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

/**
 * ── ENFORCEMENT, NOT ONLY RECORD (operator ruling, 2026-08-02) ─────────────
 *
 *   > "Wire the recorded classification into the live resolver and
 *   > signing-request preparation path. Only SIGNER_READY may produce a
 *   > signing action."
 *
 * An exception that exists only as a document is a document. These canaries
 * check the three places the rule actually has to hold: the classifier that
 * decides capability, the ceremony that offers a mandate, and the wallet
 * surface that attributes a balance to a person.
 */
describe('the classification is enforced in the live resolver', () => {
  const RESOLVER = 'services/identity/personaAddressResolver.ts';

  it('classifies on KEY MATERIAL, not on address presence', () => {
    const src = stripComments(readSource(RESOLVER));
    // The load-bearing predicate: an address with no encrypted key behind it
    // is ADDRESS_ONLY, however well-formed it looks.
    expect(src).toMatch(/encryptedPrivateKey/);
    expect(src).toContain("capability: 'ADDRESS_ONLY'");
    expect(src).toContain("capability: 'SIGNER_READY'");
  });

  it('checks LEGACY before key material — a compromised key present is still not ready', () => {
    const src = stripComments(readSource(RESOLVER));
    const legacyAt = src.indexOf("capability: 'LEGACY_EVIDENCE_ONLY'");
    const readyAt = src.indexOf("capability: 'SIGNER_READY'");
    const addressOnlyAt = src.indexOf("capability: 'ADDRESS_ONLY'");
    expect(legacyAt).toBeGreaterThan(-1);
    expect(legacyAt, 'legacy must be decided before ADDRESS_ONLY and SIGNER_READY').toBeLessThan(addressOnlyAt);
    expect(legacyAt).toBeLessThan(readyAt);
  });

  it('reads the legacy set from agentConfig rather than copying the address', () => {
    const src = readSource(RESOLVER);
    expect(src).toContain("@/app/data/agentConfig");
    expect(
      src,
      'copying the deployer literal here would spread what AIGENT-Z-WALLET-ROTATION-001 exists to remove',
    ).not.toMatch(/0x[0-9a-fA-F]{40}/);
  });

  it('never offers provisioning when the store was merely unreachable', () => {
    const src = stripComments(readSource(RESOLVER));
    // BOTH unreachable branches — the missing-client one and the query-error
    // one. UNAVAILABLE is not ABSENT: proposing a new wallet for a persona
    // that may already have one is how duplicates get created.
    const branches = [...src.matchAll(/capability: 'UNAVAILABLE'/g)].map((m) => m.index ?? -1);
    expect(branches.length, 'expected both an unreachable-store and a query-error branch').toBeGreaterThanOrEqual(2);
    for (const at of branches) {
      // `stripComments` blanks comments in place, so the window must be wide
      // enough to clear an explanatory block between the two fields.
      expect(src.slice(at, at + 700)).toContain('remediation: null');
    }
  });

  it('never fabricates a key for an existing random address', () => {
    const src = stripComments(readSource(RESOLVER));
    const at = src.indexOf("capability: 'ADDRESS_ONLY'");
    const block = src.slice(at, at + 700);
    expect(block).toMatch(/Never generate a key for the existing address/i);
  });
});

describe('the ceremony refuses every capability but SIGNER_READY', () => {
  const CEREMONY = 'services/horizen/registerCeremony.ts';

  it('gates the mandate on mayProduceSignature, not on address presence', () => {
    const src = stripComments(readSource(CEREMONY));
    expect(src).toContain('classifyPersonaWalletCapability');
    expect(src).toContain('mayProduceSignature(capability.capability)');
    const gateAt = src.indexOf('mayProduceSignature(capability.capability)');
    const resolveAt = src.indexOf('const principalWallet = await resolveWallet(');
    expect(gateAt).toBeGreaterThan(-1);
    expect(resolveAt).toBeGreaterThan(-1);
    expect(gateAt, 'the capability gate must precede the address resolution it guards').toBeLessThan(resolveAt);
  });

  it('names the capability in the refusal, so the right remedy is stated', () => {
    const src = stripComments(readSource(CEREMONY));
    expect(src).toContain("refusalCode: 'PRINCIPAL_WALLET_NOT_SIGNER_READY'");
    expect(src).toContain('${capability.capability}');
    expect(src).toContain('capability.remediation');
    // Distinct from NO_PRINCIPAL_WALLET — "nothing resolved" and "resolved but
    // cannot sign" need different remedies.
    expect(src).toContain("'NO_PRINCIPAL_WALLET'");
  });

  it('the refusal code is part of the typed union, not a loose string', () => {
    const src = stripComments(readSource(CEREMONY));
    const unionAt = src.indexOf('export type RegisterCeremonyRefusalCode');
    expect(unionAt).toBeGreaterThan(-1);
    const union = src.slice(unionAt, src.indexOf(';', unionAt));
    expect(union).toContain('PRINCIPAL_WALLET_NOT_SIGNER_READY');
  });
});

describe('the wallet surface never attributes an agent balance to a person', () => {
  const DRAWER = 'app/components/content/SmartWalletDrawer.tsx';

  it('the principal→agent address fallthrough is gone', () => {
    const src = stripComments(readSource(DRAWER));
    expect(
      src,
      'personaEvmOverride || agent.evm* is how the deployer balance rendered as the operator’s own',
    ).not.toMatch(/personaEvmOverride \|\| \(isValidEvmAddress\(agent\./);
    expect(src).toContain('const sanitizedEvmArb = personaEvmOverride;');
    expect(src).toContain('const sanitizedEvmSepolia = personaEvmOverride;');
  });

  it('an unresolved principal reads "Not configured" — never a zero balance', () => {
    const src = stripComments(readSource(DRAWER));
    expect(src).toContain('const principalWalletUnresolved = !personaEvmOverride;');
    // Both Base Q¢ rows, mainnet and testnet.
    const occurrences = (src.match(/principalWalletUnresolved\s*\?\s*"Not configured"/g) ?? []).length;
    expect(occurrences, 'both Base Q¢ rows must decline to assert a balance').toBeGreaterThanOrEqual(2);
  });

  it('legacy evidence is rendered separately, labelled, and marked unsignable', () => {
    const src = readSource(DRAWER);
    expect(src).toContain('Principal wallet — Not configured');
    expect(src).toContain('Legacy platform wallet evidence');
    expect(src).toContain('PILOT-WALLET-EXCEPTION-001');
    expect(src).toContain('Signing unavailable');
    expect(src).toContain('AIGENT-Z-WALLET-ROTATION-001');
    // And it says whose it is — the substitution the exception forbids is
    // exactly the reader assuming it is theirs.
    expect(src).toContain('belongs to the platform, not to you');
  });
});
