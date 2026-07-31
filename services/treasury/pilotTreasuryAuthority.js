/**
 * Pilot Treasury Authority — thin, provisional gate for BitCent (and future)
 * treasury actions.
 *
 * Status: PILOT-AUTHORISED — PROVISIONAL SECURITY PROFILE (operator-ratified
 * 2026-07-30). See
 * codexes/packs/agentiq/updates/2026-07-30_pilot-treasury-authority.md for
 * the full doctrine this implements and its review triggers.
 *
 * Implements the required chain (operator's exact instruction):
 *
 *   valid passport/operator authority
 *   ∩ fresh operator mandate
 *   ∩ passcode confirmation
 *   ∩ Aigent Z execution signature   (the caller signs; this module doesn't)
 *   ∩ required agentic co-signatory approval
 *   ∩ independent observer receipt
 *   ∩ policy and replay checks
 *
 * ── Deliberately IO-free and deterministic in its core ──────────────────────
 *
 * Mirrors the discipline `services/research/review/*` already uses: no
 * clock, no filesystem, no network inside this module — callers inject `now`
 * and a nonce-store, so the gate logic is unit-testable and the CLI/route
 * wires the real IO (a file-backed ledger for the CLI today; a DB-backed one
 * for a future API route, without this module changing).
 *
 * ── Why plain CommonJS, not TypeScript ──────────────────────────────────────
 *
 * `scripts/deploy-qct-bitcoin.js` is a plain `node`-invoked CommonJS script
 * (unchanged in its invocation — no ts-node/tsx toolchain risk introduced to
 * a script that broadcasts real Bitcoin transactions). Plain CommonJS here
 * lets it `require()` this module directly. A future Next.js API route can
 * `import` this same file with no issue — Next.js resolves plain `.js`
 * modules from TypeScript callers natively. This is the ONE canonical
 * implementation; do not fork a second copy for an API-route path later.
 *
 * `canonicalStringify` below intentionally mirrors
 * `services/simulation/journal.ts`'s `canonicalJson` (sorted-key,
 * deterministic) rather than inventing a different serialization — same
 * shape, duplicated only because that file is TypeScript and this one must
 * stay requirable from plain CommonJS without a compile step.
 *
 * ── What is a real control here vs. a documented stand-in ───────────────────
 *
 * `verifyNakamotoApproval` / `verifyAletheonObservation` are DETERMINISTIC
 * POLICY VERIFIERS standing in for Aigent Nakamoto's and Platform Aletheon's
 * roles in THIS pilot slice. There is no runtime today that lets a script
 * synchronously invoke a live "Aigent Nakamoto" or "Platform Aletheon"
 * decision process (per repo research, 2026-07-30 — no mandate/co-signatory/
 * agentic-signer system existed anywhere before this file). These functions
 * are the documented, auditable, POLICY-ENFORCING stand-in, not a simulation
 * of an agent that merely rubber-stamps — a real refusal (unratified record,
 * mainnet without an explicit mainnet mandate, amount over cap) genuinely
 * blocks execution. Swapping in a live agent call later is the intended
 * extension point; this module's input/output contract should not need to
 * change for that swap.
 *
 * `aletheon` is a NEW signatory identifier as of this pilot slice. Aletheon
 * has an existing Agent Card (`app/api/agents/aletheon/route.ts`) but no
 * prior treasury-signatory role — this is the first place one is assigned.
 * `aigent-z` and `aigent-nakamoto` are the existing, already-used identifiers
 * from `scripts/register-agent-keys.ts` et al. — never invented.
 */

'use strict';

const crypto = require('crypto');

const PILOT_SECURITY_STATUS = 'PILOT-AUTHORISED — PROVISIONAL SECURITY PROFILE';

const EXECUTION_AGENT = 'aigent-z';
// Observer for BitCent specifically is Aigent Kn0w1, not Platform Aletheon
// (operator ruling, 2026-07-30): Kn0w1 already has provisioned wallet/agent-
// key infrastructure (`aigent-kn0w1` in `agent_keys`); Aletheon does not yet.
// Aletheon remains available as the required signatory for the constitutional-
// exception class, where its role is policy review rather than anything
// wallet-adjacent.
const SIGNATORY_AGENTS = Object.freeze(['aigent-nakamoto', 'aigent-kn0w1', 'aletheon']);

/**
 * Fixed policy table: transaction class -> required co-signatory / observer.
 * This mapping is FIXED, not chosen by the execution agent at call time —
 * the mandate declares its `transactionClass` up front, and this table
 * decides who must approve. This is the "no permissive-signer shopping"
 * invariant: a refusal from the required signatory is never retried against
 * the observer as if it were a substitute signatory.
 */
const TRANSACTION_CLASS_POLICY = Object.freeze({
  'bitcent-treasury-ordinary': { requiredSignatory: 'aigent-nakamoto', observer: 'aigent-kn0w1' },
  'bitcent-treasury-constitutional-exception': { requiredSignatory: 'aletheon', observer: 'aigent-nakamoto' },
});

class TreasuryAuthorityRefusal extends Error {
  constructor(refusalCode, message) {
    super(message);
    this.name = 'TreasuryAuthorityRefusal';
    this.refusalCode = refusalCode;
  }
}

function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** Recomputable by anyone holding the mandate — unlike a T0-hiding commitment, the point is comparison, not concealment. */
function computeMandateCommitment(mandate) {
  return sha256Hex(canonicalStringify(mandate));
}

const REQUIRED_MANDATE_FIELDS = [
  'action', 'asset', 'amount', 'source', 'destination', 'network', 'agent',
  'nonce', 'expiry', 'executionMode', 'expectedTxSummary', 'transactionClass',
];

function validateMandateShape(mandate) {
  const missing = REQUIRED_MANDATE_FIELDS.filter(
    (f) => mandate[f] === undefined || mandate[f] === null || mandate[f] === '',
  );
  if (missing.length > 0) {
    throw new TreasuryAuthorityRefusal(
      'malformed-mandate',
      `mandate is missing required field(s): ${missing.join(', ')}. A treasury action cannot proceed on an incomplete mandate.`,
    );
  }
  if (mandate.agent !== EXECUTION_AGENT) {
    throw new TreasuryAuthorityRefusal(
      'unrecognised-execution-agent',
      `mandate names execution agent '${mandate.agent}', expected '${EXECUTION_AGENT}'.`,
    );
  }
  if (!(mandate.transactionClass in TRANSACTION_CLASS_POLICY)) {
    throw new TreasuryAuthorityRefusal(
      'unknown-transaction-class',
      `transactionClass '${mandate.transactionClass}' has no policy entry. Known classes: ${Object.keys(TRANSACTION_CLASS_POLICY).join(', ')}.`,
    );
  }
}

function assertMandateNotExpired(mandate, nowIso) {
  if (new Date(mandate.expiry).getTime() <= new Date(nowIso).getTime()) {
    throw new TreasuryAuthorityRefusal(
      'mandate-expired',
      `mandate expired at ${mandate.expiry} (checked against ${nowIso}). A stale mandate cannot authorise execution.`,
    );
  }
}

function assertReplaySafe(mandate, nonceStore) {
  if (nonceStore.hasBeenUsed(mandate.nonce)) {
    throw new TreasuryAuthorityRefusal(
      'nonce-already-used',
      `nonce '${mandate.nonce}' has already been consumed by a prior approval. A mandate is single-use.`,
    );
  }
}

/** The mandate the operator reviewed must be the transaction that executes. */
function assertMandateMatchesTransaction(mandate, generatedTx) {
  const checks = ['asset', 'amount', 'destination', 'network'];
  const mismatches = checks.filter((f) => String(mandate[f]) !== String(generatedTx[f]));
  if (mismatches.length > 0) {
    throw new TreasuryAuthorityRefusal(
      'mandate-transaction-mismatch',
      `generated transaction differs from the approved mandate on: ${mismatches.join(', ')}. ` +
        'Refusing — the mandate the operator reviewed must be the transaction that executes.',
    );
  }
}

/**
 * Deterministic policy verifier standing in for Aigent Nakamoto's Bitcoin/
 * treasury-integrity approval — see file header for what this is and is not.
 */
function verifyNakamotoApproval(mandate, context) {
  if (!context.issuanceRecordRatified) {
    return {
      approved: false,
      reason: 'issuance record is not fully ratified — Nakamoto withholds approval on any unratified field',
    };
  }
  if (mandate.network === 'mainnet' && !context.mainnetMandateExplicit) {
    return {
      approved: false,
      reason: 'mainnet execution requires an explicit, separately ratified mainnet mandate, not merely a testnet-shaped one',
    };
  }
  if (typeof context.treasuryCap === 'number' && Number(mandate.amount) > context.treasuryCap) {
    return {
      approved: false,
      reason: `amount ${mandate.amount} exceeds the treasury cap ${context.treasuryCap} for this mandate class`,
    };
  }
  return { approved: true, reason: 'issuance record ratified, network authorised, amount within cap' };
}

/**
 * Deterministic policy verifier standing in for Platform Aletheon's
 * constitutional-compliance role — see file header for what this is and is not.
 */
function verifyAletheonObservation(mandate, context) {
  if (!context.operatorIsSolePrincipal) {
    return { approved: false, reason: 'no confirmed sole human principal context for this mandate' };
  }
  if (mandate.executionMode === 'mainnet-broadcast' && !context.mainnetMandateExplicit) {
    return {
      approved: false,
      reason: 'mainnet broadcast requires an explicit, separately ratified mainnet mandate',
    };
  }
  return {
    approved: true,
    reason: 'mandate fields complete, sole-principal context confirmed, execution mode authorised',
  };
}

/**
 * Deterministic policy verifier standing in for Aigent Kn0w1's observation
 * role on BitCent treasury actions — see file header for what this is and is
 * not. Kn0w1 is the observer here (not Aletheon) because it already has
 * provisioned wallet/agent-key infrastructure; the check itself is the same
 * class of policy verification as the other two roles.
 */
function verifyKn0w1Observation(mandate, context) {
  if (!context.operatorIsSolePrincipal) {
    return { approved: false, reason: 'no confirmed sole human principal context for this mandate' };
  }
  if (!context.issuanceRecordRatified) {
    return { approved: false, reason: 'issuance record is not fully ratified' };
  }
  return { approved: true, reason: 'sole-principal context and issuance-record ratification confirmed' };
}

const SIGNATORY_VERIFIERS = Object.freeze({
  'aigent-nakamoto': verifyNakamotoApproval,
  'aigent-kn0w1': verifyKn0w1Observation,
  aletheon: verifyAletheonObservation,
});

/**
 * Evaluates both roles for the mandate's declared transaction class. The
 * REQUIRED signatory's refusal stops the action outright — the observer's
 * result is recorded but never substituted in as if it were an alternate
 * approval path (the "no permissive-signer shopping" invariant, enforced
 * structurally: there is no code path here that retries with the other
 * agent after a required-signatory refusal).
 */
function evaluateSignatories(mandate, context) {
  const policy = TRANSACTION_CLASS_POLICY[mandate.transactionClass];
  const requiredResult = SIGNATORY_VERIFIERS[policy.requiredSignatory](mandate, context);
  if (!requiredResult.approved) {
    throw new TreasuryAuthorityRefusal(
      'required-signatory-refused',
      `required signatory '${policy.requiredSignatory}' refused: ${requiredResult.reason}`,
    );
  }
  const observerResult = SIGNATORY_VERIFIERS[policy.observer](mandate, context);
  return {
    requiredSignatory: policy.requiredSignatory,
    requiredApproval: requiredResult,
    observer: policy.observer,
    observerResult,
  };
}

function deriveOperatorPasscodeHash(passcode, salt) {
  return crypto.scryptSync(passcode, salt, 64).toString('hex');
}

/**
 * Standard password-style verification: the plaintext passcode is entered
 * fresh each time (never stored) and compared, via scrypt + constant-time
 * compare, against a salted hash held server-side (`TREASURY_OPERATOR_
 * PASSCODE_HASH` / `_SALT`). Binding to the specific mandate is procedural
 * for this single-process CLI (the mandate summary is printed immediately
 * before this prompt, and the nonce is single-use) rather than a
 * cryptographic HMAC-over-the-mandate-commitment — a networked/API version
 * (extension point) should use a proper server-issued challenge instead.
 */
function verifyOperatorPasscode({ providedPasscode, expectedHash, salt }) {
  if (!expectedHash || !salt) {
    throw new TreasuryAuthorityRefusal(
      'passcode-not-configured',
      'TREASURY_OPERATOR_PASSCODE_HASH / TREASURY_OPERATOR_PASSCODE_SALT are not both set. ' +
        'Refusing rather than treating an unconfigured passcode as "no passcode required".',
    );
  }
  const computed = deriveOperatorPasscodeHash(providedPasscode || '', salt);
  const a = Buffer.from(computed, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!match) {
    throw new TreasuryAuthorityRefusal('passcode-incorrect', 'operator passcode did not verify.');
  }
}

/**
 * The whole gate, in the order specified: mandate shape -> expiry -> replay
 * -> passcode -> signatories -> tx match. Throws `TreasuryAuthorityRefusal`
 * on the first failure; returns an authority record on success. The nonce is
 * consumed ONLY on success — a failed attempt (wrong passcode, say) must
 * remain retryable with a corrected input, not burn the mandate.
 *
 * `generatedTx` is optional: pass it when the real transaction is already
 * built (so the tx-match check runs here); omit it to run every OTHER check
 * early (mandate/expiry/replay/passcode/signatories) before touching key
 * material or a funded UTXO, then call `assertMandateMatchesTransaction`
 * separately once the real transaction exists.
 */
function authorizeTreasuryAction({ mandate, generatedTx, providedPasscode, passcodeConfig, context, nonceStore, nowIso }) {
  validateMandateShape(mandate);
  assertMandateNotExpired(mandate, nowIso);
  assertReplaySafe(mandate, nonceStore);
  verifyOperatorPasscode({ providedPasscode, expectedHash: passcodeConfig.hash, salt: passcodeConfig.salt });
  const signatories = evaluateSignatories(mandate, context);
  if (generatedTx) assertMandateMatchesTransaction(mandate, generatedTx);

  const mandateCommitment = computeMandateCommitment(mandate);
  nonceStore.markUsed(mandate.nonce, mandateCommitment);

  return {
    status: PILOT_SECURITY_STATUS,
    mandateCommitment,
    executionAgent: EXECUTION_AGENT,
    signatories,
    authorisedAt: nowIso,
  };
}

module.exports = {
  PILOT_SECURITY_STATUS,
  EXECUTION_AGENT,
  SIGNATORY_AGENTS,
  TRANSACTION_CLASS_POLICY,
  TreasuryAuthorityRefusal,
  canonicalStringify,
  sha256Hex,
  computeMandateCommitment,
  validateMandateShape,
  assertMandateNotExpired,
  assertReplaySafe,
  assertMandateMatchesTransaction,
  verifyNakamotoApproval,
  verifyAletheonObservation,
  verifyKn0w1Observation,
  evaluateSignatories,
  deriveOperatorPasscodeHash,
  verifyOperatorPasscode,
  authorizeTreasuryAction,
};
