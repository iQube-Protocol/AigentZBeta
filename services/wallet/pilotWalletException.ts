/**
 * PILOT-WALLET-EXCEPTION-001 — a bounded, named, expiring exception.
 *
 * ── What was found ─────────────────────────────────────────────────────────
 *
 * The wallet-binding trace (#121, 2026-08-02) established that the 4,000,000
 * Base Q¢ attributed to Aigent Z sits at a HARDCODED literal in
 * `app/data/agentConfig.ts` which is the platform DEPLOYER EOA — the account
 * that received QCT's premine, keyed by `SIGNER_PRIVATE_KEY`, and recorded in
 * `docs/security/key-rotation-register.md` as "already flagged compromised;
 * treat as burned."
 *
 * ── The operator's ruling ──────────────────────────────────────────────────
 *
 * Do not block the pilot on key recycling, and do not pretend the problem is
 * solved. The distinction that makes both possible:
 *
 *   > "The pilot may accept WALLET EVIDENCE without accepting WALLET AUTHORITY."
 *
 * Evidence is a historical fact one may display and reference. Authority is
 * permission to produce a consequence. Conflating them is what would let a
 * compromised deployer key quietly become the foundation of a constitutional
 * signing topology — not by anyone deciding it should, but by nobody
 * distinguishing the two.
 *
 * ── Why an exception is written down rather than simply taken ──────────────
 *
 * An accepted risk that is not named is indistinguishable from an unnoticed
 * one. Six months on, the difference between "we knowingly deferred this" and
 * "nobody looked" is invisible unless someone wrote it down at the time. So the
 * exception carries its scope, its permissions, its prohibitions and the
 * trigger for the remediation that retires it.
 */

export const PILOT_WALLET_EXCEPTION_ID = 'PILOT-WALLET-EXCEPTION-001';

export interface PilotWalletException {
  id: string;
  status: 'active' | 'retired';
  acceptedBy: string;
  acceptedAt: string;
  /** Exactly which runs this covers. Never "the platform". */
  scope: readonly string[];
  acceptedRisk: string;
  permitted: readonly string[];
  prohibited: readonly string[];
  /** The deferred remediation that retires this exception, and when it must run. */
  retiredBy: string;
  retirementTrigger: string;
}

export const PILOT_WALLET_EXCEPTION: PilotWalletException = Object.freeze({
  id: PILOT_WALLET_EXCEPTION_ID,
  status: 'active',
  acceptedBy: 'operator',
  acceptedAt: '2026-08-02',
  scope: Object.freeze([
    'Aigent Nakamoto rehearsal run (pre-run)',
    'MoneyPenny live pilot run',
  ]),
  acceptedRisk:
    'Aigent Z wallet evidence currently resolves through a legacy, previously flagged deployer address.',
  permitted: Object.freeze([
    'Display historical wallet evidence, labelled as legacy and under this exception',
    'Preserve existing Aigent Z integrations',
    'Preserve existing x402 / Q¢ references',
    'Use Aigent Z as pilot ORCHESTRATOR — observing, composing evidence, recording receipts',
    'Run the Nakamoto rehearsal and the MoneyPenny live onboarding',
  ]),
  prohibited: Object.freeze([
    'The legacy key signing a principal mandate',
    'New delegation authority originating from the legacy key',
    'Representing the deployer balance as clean Aigent Z operating float',
    'The legacy key acting as controller for Nakamoto or MoneyPenny',
    'The legacy wallet substituting for the human principal wallet',
    'Transferring ownership of the legacy address',
    'Reusing this exception for another agency',
  ]),
  retiredBy: 'AIGENT-Z-WALLET-ROTATION-001',
  retirementTrigger:
    'After the MoneyPenny pilot completes and BEFORE Stone agency onboarding, production scale, or the ' +
    'assignment of any new operating float.',
});

// ── Wallet capability classification ────────────────────────────────────────

/**
 * What a wallet can actually DO — not merely what is on file about it.
 *
 * `LEGACY_EVIDENCE_ONLY` is the state the exception creates: a real, historical,
 * referenceable wallet record that must never produce a signing action.
 *
 * `ADDRESS_ONLY` is the state the trace found in three provisioning paths — an
 * address generated as 20 random bytes with no key behind it. It looks
 * identical to a usable wallet through today's resolver, which returns
 * `resolved` for it and lets a ceremony offer a mandate that can never be
 * signed. Naming it is what stops that.
 *
 * Only `SIGNER_CONFIGURED` may ever produce a signature. Every other value is a
 * reason to refuse, and each names a DIFFERENT remedy — which is the whole
 * point of not collapsing them into `available: false`.
 */
export type WalletCapability =
  /**
   * Address present AND key material provably exists — structurally valid
   * custody with an explicit binding.
   *
   * NOT "ready to sign". The name was `SIGNER_READY` and that was the blur Al
   * named: durable data can establish that a signer is CONFIGURED and cannot
   * establish that anyone controls it. Signing additionally requires
   * CONTROL_PROVEN — a fresh unlock and a signature that recovers this address
   * (services/wallet/walletControlProof.ts).
   */
  | 'SIGNER_CONFIGURED'
  /** Address on file with no key behind it. Looks usable; cannot sign. */
  | 'ADDRESS_ONLY'
  /**
   * An EXTERNAL wallet (MetaMask and the like) recorded in the principal
   * address field, with no platform custody and no proof of control.
   *
   * Confirmed live on 2026-08-02: `app/api/iqube/persona/passport/mint`
   * persisted `body.ownerAddress` — validated as well-FORMED, never as
   * CONTROLLED — into `personas.evm_address`. One operator minting passports
   * with one wallet connected wrote that wallet onto 21 personas.
   *
   * Distinct from ADDRESS_ONLY, and the distinction matters practically:
   * ADDRESS_ONLY says "twenty random bytes, supersede the placeholder", and
   * doing that to a real external wallet would sever a genuine binding. Both
   * present identically in the row — address present, no key material — so the
   * capability cannot be inferred from the row alone.
   *
   * It may never be the PRINCIPAL signer: the signing topology requires local
   * encrypted custody, and PASSPORT_AUTH_EXTERNAL_WALLET_NOT_PERMITTED
   * forbids an external wallet standing in for the Passport principal. Its
   * proper home is `wallet_alias_commitments`, SIWE-proven, as a LINKED
   * external wallet beside the principal — never inside it.
   */
  | 'EXTERNAL_UNPROVEN'
  /** Real wallet, real history, no authority — see PILOT-WALLET-EXCEPTION-001. */
  | 'LEGACY_EVIDENCE_ONLY'
  /** Key material exists but the address was never bound to the subject. */
  | 'PRESENT_BUT_UNBOUND'
  /** Nothing on file. */
  | 'ABSENT'
  /** On file but not a well-formed address. */
  | 'MALFORMED'
  /** More than one candidate and no rule to choose. Never guess. */
  | 'AMBIGUOUS'
  /** Known-compromised key material. Distinct from legacy-evidence: not displayable as current. */
  | 'COMPROMISED'
  /** Could not be determined. NOT the same as absent — never render it as one. */
  | 'UNAVAILABLE';

/**
 * The one capability that may be a CANDIDATE for signing.
 *
 * Deliberately not named `maySign`. Configuration is necessary and not
 * sufficient: `isControlProven` (walletControlProof.ts) additionally requires a
 * fresh, session-bound, non-replayable proof, and `evaluateConsequentialAuthority`
 * additionally requires resolved authority and a valid mandate.
 *
 * A caller that treats this as permission to sign has skipped two gates.
 */
export function mayProduceSignature(c: WalletCapability): boolean {
  return c === 'SIGNER_CONFIGURED';
}

/**
 * May this wallet be shown as pilot evidence?
 *
 * Deliberately broader than `mayProduceSignature` and deliberately NOT the
 * same question. The exception exists precisely because the answers differ.
 */
export function mayDisplayAsEvidence(c: WalletCapability): boolean {
  return c === 'SIGNER_CONFIGURED' || c === 'LEGACY_EVIDENCE_ONLY' || c === 'EXTERNAL_UNPROVEN';
}

/**
 * May this capability serve as the PRINCIPAL signer?
 *
 * Narrower than `mayProduceSignature` by exactly one case, and the case is the
 * point: an external wallet may be genuinely controlled by the operator and
 * still not be the principal. The principal wallet signs constitutional
 * authority under local custody; an external wallet is a linked account.
 * Conflating them is what the mint route did.
 */
export function mayServeAsPrincipalSigner(c: WalletCapability): boolean {
  return c === 'SIGNER_CONFIGURED';
}

// ── Pilot subjects ──────────────────────────────────────────────────────────

/**
 * Two runs, two subject agents, one order (operator correction, 2026-08-02).
 *
 *   > "Prove the journey with Nakamoto, then onboard MoneyPenny live."
 *
 * Aigent Z is the ORCHESTRATOR for both and the subject of neither — which is
 * also what keeps the legacy-wallet exception bounded: an orchestrator records
 * and observes, and never needs to sign as a subject.
 */
export type PilotRunKind = 'rehearsal' | 'live';

export interface PilotRun {
  kind: PilotRunKind;
  /** The agent being onboarded. Never Aigent Z. */
  subjectAgentSlug: string;
  label: string;
  /** The governed path both runs follow, identically. */
  stages: readonly string[];
  /** What must hold before this run may open. */
  precondition: string;
}

export const PILOT_RUNS: readonly PilotRun[] = Object.freeze([
  Object.freeze({
    kind: 'rehearsal' as const,
    subjectAgentSlug: 'nakamoto',
    label: 'Aigent Nakamoto — rehearsal (pre-run)',
    stages: Object.freeze(['register', 'verify', 'claim', 'passport', 'delegate', 'activate']),
    precondition: 'None — this run exists to stabilise the path. No production or pilot authority is implied.',
  }),
  Object.freeze({
    kind: 'live' as const,
    subjectAgentSlug: 'moneypenny',
    label: 'MoneyPenny — live Horizen × MoneyPenny pilot',
    stages: Object.freeze(['register', 'verify', 'claim', 'passport', 'delegate', 'activate']),
    precondition:
      'The Nakamoto rehearsal is complete, every required receipt is present, and no refusal is unresolved.',
  }),
]);

/**
 * May the live run open?
 *
 * Derived from the rehearsal's evidence, never from a date or a judgement that
 * it "went fine". An unresolved refusal is exactly the thing a rehearsal exists
 * to surface, so it must block rather than be waved through.
 */
export function liveRunMayOpen(rehearsal: {
  complete: boolean;
  allRequiredReceiptsPresent: boolean;
  unresolvedRefusals: number;
}): boolean {
  return rehearsal.complete && rehearsal.allRequiredReceiptsPresent && rehearsal.unresolvedRefusals === 0;
}

/**
 * The deferred remediation this exception defers TO.
 *
 * Recorded here rather than only in a backlog so the exception and its exit
 * cannot drift apart — an exception whose remediation has been forgotten is an
 * exception that has silently become the architecture.
 */
export const AIGENT_Z_WALLET_ROTATION = Object.freeze({
  id: 'AIGENT-Z-WALLET-ROTATION-001',
  status: 'deferred' as const,
  trigger: PILOT_WALLET_EXCEPTION.retirementTrigger,
  scope: Object.freeze([
    'New Aigent Z operating wallet',
    'Key rotation',
    'Treasury migration',
    'Q¢ operating-float reassignment',
    'x402 binding update',
    'agentConfig.ts literal cleanup',
    'Wallet alias normalisation',
    'Receipt continuity across the rotation',
    'Legacy address quarantine',
  ]),
});
