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
  'SIGNER_CONFIGURED',
  'ADDRESS_ONLY',
  'EXTERNAL_UNPROVEN',
  'LEGACY_EVIDENCE_ONLY',
  'PRESENT_BUT_UNBOUND',
  'ABSENT',
  'MALFORMED',
  'AMBIGUOUS',
  'COMPROMISED',
  'UNAVAILABLE',
];

describe('only one capability may produce a signature', () => {
  it('SIGNER_CONFIGURED and nothing else', () => {
    for (const c of ALL) {
      expect(mayProduceSignature(c), `${c} must not be signable`).toBe(c === 'SIGNER_CONFIGURED');
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
 *   > signing-request preparation path. Only SIGNER_CONFIGURED may produce a
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
    expect(src).toContain("capability: 'SIGNER_CONFIGURED'");
  });

  it('checks LEGACY before key material — a compromised key present is still not ready', () => {
    const src = stripComments(readSource(RESOLVER));
    const legacyAt = src.indexOf("capability: 'LEGACY_EVIDENCE_ONLY'");
    const readyAt = src.indexOf("capability: 'SIGNER_CONFIGURED'");
    const addressOnlyAt = src.indexOf("capability: 'ADDRESS_ONLY'");
    expect(legacyAt).toBeGreaterThan(-1);
    expect(legacyAt, 'legacy must be decided before ADDRESS_ONLY and SIGNER_CONFIGURED').toBeLessThan(addressOnlyAt);
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

describe('the ceremony refuses every capability but SIGNER_CONFIGURED', () => {
  const CEREMONY = 'services/horizen/registerCeremony.ts';

  it('gates the mandate on capability, not on address presence', () => {
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
    expect(src).toContain("refusalCode: 'PRINCIPAL_WALLET_NOT_SIGNER_CONFIGURED'");
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
    expect(union).toContain('PRINCIPAL_WALLET_NOT_SIGNER_CONFIGURED');
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

/**
 * ── CONTROL ∩ AUTHORITY ∩ MANDATE = CONSEQUENTIAL AUTHORITY ────────────────
 *
 * Operator ruling via Al, 2026-08-02:
 *
 *   > "The key proves control. The Passport establishes authority. The signed
 *   > request defines the mandate. Only their intersection permits consequence."
 *
 * The first cut folded six conditions into one server-side `SIGNER_READY`.
 * Three of them — the password unlocking, the key deriving the bound address, a
 * signature recovering it — a server cannot know. Claiming them is worse than
 * omitting them: it is a confident wrong answer about whether someone can sign.
 *
 * The distinctions a single flag destroys, each of which has its own failure:
 *
 *   · a wallet record with a key is not control
 *   · a valid wallet signature is not authority
 *   · a Citizen Passport is not a mandate
 *   · a button click is not a mandate
 *   · a mandate without current wallet control cannot be executed
 *   · control of an AGENT wallet does not grant authority to expand delegation
 */
describe('four layers, each answering its own question', () => {
  const PROOF = 'services/wallet/walletControlProof.ts';

  it('names all four and states the canonical formulation', async () => {
    const { AUTHORITY_LAYER_MEANING, CANONICAL_AUTHORITY_FORMULATION } = await import(
      '@/services/wallet/walletControlProof'
    );
    expect(Object.keys(AUTHORITY_LAYER_MEANING).sort()).toEqual([
      'AUTHORITY_RESOLVED',
      'CONSEQUENTIAL_AUTHORITY',
      'CONTROL_PROVEN',
      'MANDATE_VALID',
    ]);
    expect(CANONICAL_AUTHORITY_FORMULATION).toMatch(/key proves control/i);
    expect(CANONICAL_AUTHORITY_FORMULATION).toMatch(/Passport establishes authority/i);
    expect(CANONICAL_AUTHORITY_FORMULATION).toMatch(/signed request defines the mandate/i);
    expect(CANONICAL_AUTHORITY_FORMULATION).toMatch(/intersection permits consequence/i);
  });

  it('configuration alone is never control — durable data cannot prove a key was used', async () => {
    const { isSignerConfigured, isControlProven, checkControlProof } = await import(
      '@/services/wallet/walletControlProof'
    );
    expect(isSignerConfigured('SIGNER_CONFIGURED')).toBe(true);
    const noProof = checkControlProof({
      proof: null,
      principalPersonaId: 'p1',
      walletRef: 'principal',
      address: '0x' + 'a'.repeat(40),
      sessionId: 's1',
      now: new Date('2026-08-02T12:00:00Z'),
    });
    expect(noProof.proven).toBe(false);
    expect(noProof.failure).toBe('no-proof');
    // Configured AND unproven ⇒ not control-proven. Both halves are required.
    expect(isControlProven('SIGNER_CONFIGURED', noProof)).toBe(false);
  });

  it('a fresh proof against an unconfigured wallet is still not control', async () => {
    const { isControlProven } = await import('@/services/wallet/walletControlProof');
    const proven = { proven: true, detail: 'ok' };
    for (const c of ['ADDRESS_ONLY', 'LEGACY_EVIDENCE_ONLY', 'COMPROMISED', 'ABSENT'] as const) {
      expect(isControlProven(c, proven), `${c} must not become control-proven by a proof`).toBe(false);
    }
    expect(isControlProven('SIGNER_CONFIGURED', proven)).toBe(true);
  });

  it('the proof is bound on every axis that could be swapped underneath it', async () => {
    const { checkControlProof } = await import('@/services/wallet/walletControlProof');
    const addr = '0x' + 'a'.repeat(40);
    const now = new Date('2026-08-02T12:00:00Z');
    const base = {
      principalPersonaId: 'p1',
      walletRef: 'principal',
      address: addr,
      sessionId: 's1',
      nonce: 'n1',
      provenAt: '2026-08-02T11:59:00Z',
      expiresAt: '2026-08-02T12:10:00Z',
    };
    const ask = { principalPersonaId: 'p1', walletRef: 'principal', address: addr, sessionId: 's1', now };
    expect(checkControlProof({ proof: base, ...ask }).proven).toBe(true);
    // Each swap is refused, and named distinctly — "expired" and "wrong wallet"
    // call for different actions.
    expect(checkControlProof({ proof: { ...base, principalPersonaId: 'p2' }, ...ask }).failure).toBe(
      'principal-mismatch',
    );
    expect(checkControlProof({ proof: { ...base, walletRef: 'aigent-nakamoto' }, ...ask }).failure).toBe(
      'wallet-mismatch',
    );
    expect(checkControlProof({ proof: { ...base, address: '0x' + 'b'.repeat(40) }, ...ask }).failure).toBe(
      'address-mismatch',
    );
    expect(checkControlProof({ proof: { ...base, sessionId: 's2' }, ...ask }).failure).toBe('session-mismatch');
    expect(
      checkControlProof({ proof: { ...base, expiresAt: '2026-08-02T11:59:30Z' }, ...ask }).failure,
    ).toBe('expired');
  });

  it('no permanent "proved once" flag exists — the proof carries an expiry', async () => {
    const { CONTROL_PROOF_TTL_MS } = await import('@/services/wallet/walletControlProof');
    expect(CONTROL_PROOF_TTL_MS).toBeGreaterThan(0);
    const src = stripComments(readSource(PROOF));
    expect(src).toContain('expiresAt');
    expect(src).toContain('sessionId');
    expect(src).toContain('nonce');
  });

  it('the Passport is kept OUT of the wallet classifier', () => {
    const resolver = stripComments(readSource('services/identity/personaAddressResolver.ts'));
    // "Can this wallet sign?" and "may this principal authorize?" are separate
    // gates. A Passport lapse must not read as a broken wallet.
    expect(resolver).not.toMatch(/passport/i);
    const proof = stripComments(readSource(PROOF));
    // The proof module may NAME the layer; it must not evaluate Passport state.
    expect(proof).not.toMatch(/getActivePersona|passport_|from\('passports'\)/);
  });

  it('the three layers are intersected in exactly one place', async () => {
    const { evaluateConsequentialAuthority } = await import('@/services/wallet/walletControlProof');
    const all = { controlProven: true, authorityResolved: true, mandateValid: true };
    expect(evaluateConsequentialAuthority(all).consequentialAuthority).toBe(true);
    // Every single omission blocks, and reports WHICH layer is missing.
    for (const k of ['controlProven', 'authorityResolved', 'mandateValid'] as const) {
      const r = evaluateConsequentialAuthority({ ...all, [k]: false });
      expect(r.consequentialAuthority).toBe(false);
      expect(r.missing).toHaveLength(1);
    }
    expect(
      evaluateConsequentialAuthority({ controlProven: false, authorityResolved: false, mandateValid: false }).missing,
    ).toEqual(['CONTROL_PROVEN', 'AUTHORITY_RESOLVED', 'MANDATE_VALID']);
  });
});

/**
 * VERIFY WHAT EXISTS FIRST. PROVISION ONLY WHEN CUSTODY IS GENUINELY ABSENT.
 *
 * Provisioning is the dangerous branch: a second wallet for a persona that
 * already has one splits its history and leaves two candidate signers with no
 * rule to choose between them. So it must be the narrowest path, and it must
 * never be the response to a mismatch — a mismatch is a question to answer,
 * not a gap to fill.
 */
describe('the remediation decision verifies before it provisions', () => {
  it('envelope + address ⇒ verify the existing wallet, never provision another', async () => {
    const { decideWalletRemediation } = await import('@/services/wallet/walletControlProof');
    const d = decideWalletRemediation({
      hasEncryptedEnvelope: true,
      hasRecordedAddress: true,
      envelopeDerivesRecordedAddress: true,
    });
    expect(d.action).toBe('verify-existing');
    expect(d.createsNewWallet).toBe(false);
  });

  it('envelope only ⇒ derive and bind, then verify — real custody is never discarded', async () => {
    const { decideWalletRemediation } = await import('@/services/wallet/walletControlProof');
    const d = decideWalletRemediation({
      hasEncryptedEnvelope: true,
      hasRecordedAddress: false,
      envelopeDerivesRecordedAddress: null,
    });
    expect(d.action).toBe('derive-bind-then-verify');
    expect(d.createsNewWallet).toBe(false);
  });

  it('address only ⇒ provision and supersede the placeholder, never fabricate a key', async () => {
    const { decideWalletRemediation } = await import('@/services/wallet/walletControlProof');
    const d = decideWalletRemediation({
      hasEncryptedEnvelope: false,
      hasRecordedAddress: true,
      envelopeDerivesRecordedAddress: null,
    });
    expect(d.action).toBe('provision-and-supersede-placeholder');
    expect(d.createsNewWallet).toBe(true);
    expect(d.detail).toMatch(/Never fabricate a key for the existing address/i);
  });

  it('a derived-address mismatch quarantines — it never triggers provisioning', async () => {
    const { decideWalletRemediation } = await import('@/services/wallet/walletControlProof');
    const d = decideWalletRemediation({
      hasEncryptedEnvelope: true,
      hasRecordedAddress: true,
      envelopeDerivesRecordedAddress: false,
    });
    expect(d.action).toBe('quarantine-do-not-provision');
    expect(
      d.createsNewWallet,
      'a third candidate address does not answer a question that already has two',
    ).toBe(false);
  });

  it('only two of the five branches create a wallet, and neither is a mismatch', async () => {
    const { decideWalletRemediation } = await import('@/services/wallet/walletControlProof');
    const creating = [
      { hasEncryptedEnvelope: false, hasRecordedAddress: true, envelopeDerivesRecordedAddress: null },
      { hasEncryptedEnvelope: false, hasRecordedAddress: false, envelopeDerivesRecordedAddress: null },
    ].map((i) => decideWalletRemediation(i));
    expect(creating.every((d) => d.createsNewWallet)).toBe(true);
    const notCreating = [
      { hasEncryptedEnvelope: true, hasRecordedAddress: true, envelopeDerivesRecordedAddress: true },
      { hasEncryptedEnvelope: true, hasRecordedAddress: true, envelopeDerivesRecordedAddress: false },
      { hasEncryptedEnvelope: true, hasRecordedAddress: false, envelopeDerivesRecordedAddress: null },
    ].map((i) => decideWalletRemediation(i));
    expect(notCreating.every((d) => !d.createsNewWallet)).toBe(true);
  });
});

describe('the proof ceremony makes both comparisons, in order', () => {
  const ok = {
    boundAddress: '0x' + 'a'.repeat(40),
    derivedAddress: '0x' + 'a'.repeat(40),
    recoveredAddress: '0x' + 'A'.repeat(40), // case-insensitive
    capability: 'SIGNER_CONFIGURED' as const,
    nonceIssuedAt: new Date('2026-08-02T12:00:00Z'),
    nonceAlreadyUsed: false,
    now: new Date('2026-08-02T12:01:00Z'),
  };

  it('passes only when the envelope derives the bound address AND a fresh signature recovers it', async () => {
    const { verifyProofCeremony } = await import('@/services/wallet/walletControlProof');
    expect(verifyProofCeremony(ok).ok).toBe(true);
    // Derivation proves the envelope holds the right key; recovery proves the
    // operator just used it. Neither alone is proof of current control.
    expect(verifyProofCeremony({ ...ok, derivedAddress: '0x' + 'b'.repeat(40) }).refusal).toBe(
      'derived-address-mismatch',
    );
    expect(verifyProofCeremony({ ...ok, recoveredAddress: '0x' + 'b'.repeat(40) }).refusal).toBe(
      'recovered-signer-mismatch',
    );
  });

  it('refuses replay, expiry, missing custody, compromise and ambiguity by name', async () => {
    const { verifyProofCeremony } = await import('@/services/wallet/walletControlProof');
    expect(verifyProofCeremony({ ...ok, nonceAlreadyUsed: true }).refusal).toBe('nonce-replayed');
    expect(verifyProofCeremony({ ...ok, now: new Date('2026-08-02T12:30:00Z') }).refusal).toBe('nonce-expired');
    expect(verifyProofCeremony({ ...ok, derivedAddress: null }).refusal).toBe('envelope-missing');
    expect(verifyProofCeremony({ ...ok, capability: 'COMPROMISED' }).refusal).toBe('wallet-compromised');
    expect(verifyProofCeremony({ ...ok, capability: 'AMBIGUOUS' }).refusal).toBe('binding-ambiguous');
  });

  it('a derived mismatch tells the operator NOT to create a second wallet', async () => {
    const { verifyProofCeremony } = await import('@/services/wallet/walletControlProof');
    const r = verifyProofCeremony({ ...ok, derivedAddress: '0x' + 'b'.repeat(40) });
    expect(r.detail).toMatch(/do not create a second wallet/i);
  });

  it('the module stays pure — it holds no key and opens no store', () => {
    const src = stripComments(readSource('services/wallet/walletControlProof.ts'));
    for (const forbidden of ['supabase', 'getSupabaseServer', '.insert(', 'decrypt', 'new Wallet']) {
      expect(src, `the rule module must not ${forbidden} — its caller owns the I/O and the cryptography`).not.toContain(
        forbidden,
      );
    }
  });
});

/**
 * AN EXTERNAL WALLET IS NOT A PLACEHOLDER, AND NOT THE PRINCIPAL.
 *
 * Confirmed live, 2026-08-02. `app/api/iqube/persona/passport/mint` persisted
 * `body.ownerAddress` — validated as well-FORMED, never as CONTROLLED — into
 * `personas.evm_address`. One operator minting passports with one MetaMask
 * wallet connected wrote that wallet onto TWENTY-ONE personas.
 *
 * Three distinct failures, and the middle one is the subtle one:
 *
 *   1. A CLAIM persisted as a FACT. The browser said "this is the owner" and
 *      the row recorded it as though proven.
 *   2. An EXTERNAL wallet in the PRINCIPAL field. Both appear as
 *      address-present-without-key, so a classifier reading only the row would
 *      call a genuinely-controlled MetaMask wallet a placeholder — and the
 *      remedy for a placeholder is to supersede it, which would sever a real
 *      binding. The capability cannot be inferred from the row.
 *   3. ONE address, TWENTY-ONE principals. Anything keyed on address — balance,
 *      ownership, `wallet_ref = 'principal'` — cannot distinguish them.
 */
describe('an external wallet is preserved, never superseded, and never the principal', () => {
  it('EXTERNAL_UNPROVEN may be displayed and may never sign', async () => {
    const { mayProduceSignature, mayDisplayAsEvidence, mayServeAsPrincipalSigner } = await import(
      '@/services/wallet/pilotWalletException'
    );
    expect(mayDisplayAsEvidence('EXTERNAL_UNPROVEN')).toBe(true);
    expect(mayProduceSignature('EXTERNAL_UNPROVEN')).toBe(false);
    expect(
      mayServeAsPrincipalSigner('EXTERNAL_UNPROVEN'),
      'the signing topology requires local custody; an external wallet is a linked account',
    ).toBe(false);
  });

  it('only SIGNER_CONFIGURED may serve as the principal signer', async () => {
    const { mayServeAsPrincipalSigner } = await import('@/services/wallet/pilotWalletException');
    for (const c of ALL) {
      expect(mayServeAsPrincipalSigner(c)).toBe(c === 'SIGNER_CONFIGURED');
    }
  });

  it('a known-external address migrates and provisions — it is never superseded as a placeholder', async () => {
    const { decideWalletRemediation } = await import('@/services/wallet/walletControlProof');
    const d = decideWalletRemediation({
      hasEncryptedEnvelope: false,
      hasRecordedAddress: true,
      envelopeDerivesRecordedAddress: null,
      recordedAddressIsExternal: true,
    });
    expect(d.action).toBe('migrate-external-binding-then-provision');
    expect(d.detail).toMatch(/Preserve it as a .*external binding/i);
    // A principal wallet is still provisioned — beside it, not instead of it.
    expect(d.createsNewWallet).toBe(true);
  });

  it('an UNKNOWN provenance still supersedes — the external branch requires a positive fact', async () => {
    const { decideWalletRemediation } = await import('@/services/wallet/walletControlProof');
    for (const external of [null, undefined, false] as const) {
      const d = decideWalletRemediation({
        hasEncryptedEnvelope: false,
        hasRecordedAddress: true,
        envelopeDerivesRecordedAddress: null,
        recordedAddressIsExternal: external,
      });
      expect(
        d.action,
        'the external branch must not fire on absence of evidence — it needs a positive fact',
      ).toBe('provision-and-supersede-placeholder');
    }
  });

  it('the mint route no longer writes an unproven client address as the principal wallet', () => {
    const src = stripComments(readSource('app/api/iqube/persona/passport/mint/route.ts'));
    expect(
      src,
      'persisting body.ownerAddress into personas.evm_address is what put one wallet on 21 personas',
    ).not.toMatch(/update\(\{\s*evm_address:\s*clientOwner\s*\}\)/);
    // The mint itself still uses the supplied owner — only the silent
    // persistence is gone.
    expect(src).toContain('const ownerAddress = storedOwner || clientOwner;');
  });
});
