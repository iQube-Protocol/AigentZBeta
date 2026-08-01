/**
 * Control ∩ Authority ∩ Mandate = Consequential Authority.
 *
 * Four names kept apart (operator ruling via Al, 2026-08-02), not one flag.
 *
 * ── The mistake this replaces ──────────────────────────────────────────────
 *
 * The first cut folded six conditions into a single server-side `SIGNER_READY`.
 * Three of them — the password unlocking, the key deriving the recorded
 * address, a signature recovering it — cannot be known by a server at all. A
 * classifier that claims them is asserting something it cannot check, which is
 * worse than not checking: it is a confident wrong answer.
 *
 *     SIGNER_CONFIGURED       custody and binding appear structurally valid.
 *                             Durable, server-knowable, says nothing about control.
 *
 *     CONTROL_PROVEN          the operator has freshly unlocked the wallet and
 *                             signed a challenge that recovers the bound
 *                             address. Ephemeral. Only this may sign.
 *
 *     AUTHORITY_RESOLVED      an active Citizen Passport and principal
 *                             relationship. Constitutional, not cryptographic.
 *
 *     MANDATE_VALID           a purpose-bound signing request: this subject,
 *                             scope, consequence, network and expiry.
 *
 *     CONSEQUENTIAL_AUTHORITY their intersection. Only this permits the act.
 *
 * ── Why the proof expires ──────────────────────────────────────────────────
 *
 * A permanent "proved once" flag answers a question about the past while
 * appearing to answer one about the present. Control is not a property a wallet
 * acquires; it is a fact about who is at the keyboard now. So the receipt is
 * short-lived, bound to the wallet session, and non-replayable — and a stale
 * one is treated exactly like no proof at all.
 *
 * ── Why the Passport is NOT in the wallet classifier ───────────────────────
 *
 *   > "Can this wallet sign?" → wallet capability
 *   > "May this principal authorize this act?" → Passport + mandate
 *
 * Two questions, two gates, intersected only at the consequential act. Folding
 * Passport state into the technical classifier would make a wallet's ability to
 * sign depend on a constitutional fact about its owner — which is both wrong
 * (the key works regardless) and dangerous (a Passport lapse would read as a
 * broken wallet, sending the operator to fix the wrong thing).
 *
 * This module is PURE. It holds no key, opens no store, and performs no
 * cryptography beyond comparing what it is given — the ceremony's I/O lives in
 * its caller, which is what makes every rule here directly testable.
 */

import type { WalletCapability } from '@/services/wallet/pilotWalletException';

/** How long a control proof stays fresh. Matches the wallet-unlock session. */
export const CONTROL_PROOF_TTL_MS = 15 * 60 * 1000;

/**
 * The durable half: is a signer CONFIGURED?
 *
 * Structural only — custody exists, an address is recorded, the binding is
 * explicit, and the wallet is neither compromised nor ambiguous. It is a
 * precondition for proof, never a substitute for it.
 */
export function isSignerConfigured(capability: WalletCapability): boolean {
  return capability === 'SIGNER_CONFIGURED';
}

/**
 * A short-lived, non-replayable record that the operator held the key.
 *
 * Bound on every axis that could otherwise be swapped underneath it: a proof
 * for one wallet must not authorise another, a proof from one session must not
 * travel to another, and a nonce must not be reused.
 */
export interface WalletControlProof {
  /** T0 — server-internal. Never serialised to a receipt or the browser. */
  principalPersonaId: string;
  /** 'principal' | runtimeAgentId — which wallet was proven. */
  walletRef: string;
  /** The address the recovered signature matched. */
  address: string;
  /** Binds the proof to one wallet-unlock session. */
  sessionId: string;
  /** The server-issued challenge. Single use. */
  nonce: string;
  provenAt: string;
  expiresAt: string;
}

export type ControlProofFailure =
  | 'no-proof'
  | 'expired'
  | 'wallet-mismatch'
  | 'address-mismatch'
  | 'session-mismatch'
  | 'principal-mismatch';

export interface ControlProofCheck {
  proven: boolean;
  failure?: ControlProofFailure;
  detail: string;
}

/**
 * Is there a FRESH proof for exactly this wallet, address, session and
 * principal?
 *
 * Every mismatch is named separately. "Your proof expired" and "that proof was
 * for a different wallet" call for different actions, and a single `false`
 * sends the operator guessing.
 */
export function checkControlProof(input: {
  proof: WalletControlProof | null;
  principalPersonaId: string;
  walletRef: string;
  address: string;
  sessionId: string;
  now: Date;
}): ControlProofCheck {
  const { proof } = input;
  if (!proof) {
    return {
      proven: false,
      failure: 'no-proof',
      detail: 'Unlock your wallet and confirm control before signing.',
    };
  }
  if (proof.principalPersonaId !== input.principalPersonaId) {
    return {
      proven: false,
      failure: 'principal-mismatch',
      detail: 'This control proof belongs to a different principal.',
    };
  }
  if (proof.walletRef !== input.walletRef) {
    return {
      proven: false,
      failure: 'wallet-mismatch',
      detail: `This control proof is for ${proof.walletRef}, not ${input.walletRef}.`,
    };
  }
  if (proof.address.toLowerCase() !== input.address.toLowerCase()) {
    return {
      proven: false,
      failure: 'address-mismatch',
      detail: 'This control proof was made against a different address than the one now bound to this wallet.',
    };
  }
  if (proof.sessionId !== input.sessionId) {
    return {
      proven: false,
      failure: 'session-mismatch',
      detail: 'This control proof was made in a different wallet session. Unlock again to confirm control.',
    };
  }
  // Expiry LAST among the equality checks so a mismatched proof reports the
  // mismatch rather than its age — the age is the less useful fact.
  if (new Date(proof.expiresAt).getTime() <= input.now.getTime()) {
    return {
      proven: false,
      failure: 'expired',
      detail: 'Your control proof has expired. Unlock your wallet again to confirm control.',
    };
  }
  return { proven: true, detail: 'Control was proven in this session and has not expired.' };
}

/**
 * CONTROL_PROVEN — the only state that may produce a signature.
 *
 * Deliberately requires BOTH halves. A configured wallet with no fresh proof
 * cannot sign; a fresh proof against an unconfigured or compromised wallet
 * cannot either. Neither half is sufficient, and neither implies the other.
 *
 * Note what this does NOT establish: that the principal MAY authorise anything.
 * A key proving control says who is at the keyboard, not what they are entitled
 * to do. See `CONSEQUENTIAL_AUTHORITY` below.
 */
export function isControlProven(capability: WalletCapability, proof: ControlProofCheck): boolean {
  return isSignerConfigured(capability) && proof.proven;
}

// ── Control ∩ Authority ∩ Mandate = Consequential Authority ─────────────────

/**
 * The four names, kept apart (operator ruling via Al, 2026-08-02).
 *
 *   > "The key proves control. The Passport establishes authority. The signed
 *   > request defines the mandate. Only their intersection permits consequence."
 *
 * Each answers a different question about a different subject, and each can be
 * true while the others are false:
 *
 *   CONTROL_PROVEN         this principal controls this wallet NOW
 *                          — fresh unlock, nonce signature, recovered address
 *   AUTHORITY_RESOLVED     this principal is constitutionally entitled to
 *                          authorise acts for this subject
 *                          — active Citizen Passport + principal relationship
 *   MANDATE_VALID          THIS act is authorised, for this subject, scope,
 *                          consequence, network and expiry
 *                          — a purpose-bound signing request
 *   CONSEQUENTIAL_AUTHORITY  all three at once. Only this permits the act.
 *
 * The distinctions that a single blurred flag would lose:
 *
 *   · a wallet record with a key is not control
 *   · a valid wallet signature is not authority
 *   · a Citizen Passport is not a mandate
 *   · a button click is not a mandate
 *   · a mandate without current wallet control cannot be executed
 *   · control of an AGENT wallet does not grant authority to create or expand
 *     delegation — the agent side has its own control proof, and it authorises
 *     execution, never authority
 */
export type AuthorityLayer =
  | 'CONTROL_PROVEN'
  | 'AUTHORITY_RESOLVED'
  | 'MANDATE_VALID'
  | 'CONSEQUENTIAL_AUTHORITY';

export const AUTHORITY_LAYER_MEANING: Record<AuthorityLayer, string> = {
  CONTROL_PROVEN: 'This principal controls this wallet now — proven by a fresh unlock and signature.',
  AUTHORITY_RESOLVED:
    'This principal is constitutionally entitled to authorise acts for this subject — an active Citizen ' +
    'Passport and principal relationship.',
  MANDATE_VALID:
    'This specific act is authorised now, for this subject, scope, consequence, network and expiry — a ' +
    'purpose-bound signing request.',
  CONSEQUENTIAL_AUTHORITY: 'All three hold at once. Only this permits the consequential signature.',
};

export const CANONICAL_AUTHORITY_FORMULATION =
  'The key proves control. The Passport establishes authority. The signed request defines the mandate. ' +
  'Only their intersection permits consequence.';

export interface ConsequentialAuthorityCheck {
  controlProven: boolean;
  authorityResolved: boolean;
  mandateValid: boolean;
  consequentialAuthority: boolean;
  /** Which layers are missing, named — never a single flat refusal. */
  missing: AuthorityLayer[];
}

/**
 * The intersection, and the ONLY place the three are combined.
 *
 * Combining them anywhere else would let one surface reach a different verdict
 * from another about whether the same act is permitted — and the surface that
 * said yes would be the one that mattered.
 */
export function evaluateConsequentialAuthority(input: {
  controlProven: boolean;
  authorityResolved: boolean;
  mandateValid: boolean;
}): ConsequentialAuthorityCheck {
  const missing: AuthorityLayer[] = [];
  if (!input.controlProven) missing.push('CONTROL_PROVEN');
  if (!input.authorityResolved) missing.push('AUTHORITY_RESOLVED');
  if (!input.mandateValid) missing.push('MANDATE_VALID');
  return {
    controlProven: input.controlProven,
    authorityResolved: input.authorityResolved,
    mandateValid: input.mandateValid,
    consequentialAuthority: missing.length === 0,
    missing,
  };
}

// ── The proof ceremony's verification steps ─────────────────────────────────

export type ProofCeremonyRefusal =
  | 'derived-address-mismatch'
  | 'recovered-signer-mismatch'
  | 'envelope-missing'
  | 'wallet-compromised'
  | 'binding-ambiguous'
  | 'nonce-expired'
  | 'nonce-replayed';

export interface ProofCeremonyResult {
  ok: boolean;
  refusal?: ProofCeremonyRefusal;
  detail: string;
}

/**
 * The two comparisons that constitute proof, checked in order.
 *
 * Both are needed and they prove different things. The DERIVED address shows
 * the envelope holds the key for the bound address. The RECOVERED signer shows
 * the operator just used it. Only doing the first would accept a wallet nobody
 * unlocked; only doing the second would accept a signature from a key that is
 * not the one bound to this persona.
 *
 * Pure: given the addresses, decide. Deriving and recovering are the caller's
 * cryptography — this is the rule that judges their output.
 */
export function verifyProofCeremony(input: {
  boundAddress: string | null;
  derivedAddress: string | null;
  recoveredAddress: string | null;
  capability: WalletCapability;
  nonceIssuedAt: Date | null;
  nonceAlreadyUsed: boolean;
  now: Date;
  nonceTtlMs?: number;
}): ProofCeremonyResult {
  if (input.capability === 'COMPROMISED') {
    return { ok: false, refusal: 'wallet-compromised', detail: 'This wallet is recorded as compromised.' };
  }
  if (input.capability === 'AMBIGUOUS') {
    return {
      ok: false,
      refusal: 'binding-ambiguous',
      detail: 'More than one address is bound to this wallet, so a proof could not identify which was proven.',
    };
  }
  if (!input.derivedAddress) {
    return {
      ok: false,
      refusal: 'envelope-missing',
      detail: 'No encrypted key envelope was available to derive an address from.',
    };
  }
  if (input.nonceAlreadyUsed) {
    return { ok: false, refusal: 'nonce-replayed', detail: 'That challenge has already been used.' };
  }
  if (!input.nonceIssuedAt) {
    return { ok: false, refusal: 'nonce-expired', detail: 'No challenge was issued for this proof.' };
  }
  const ttl = input.nonceTtlMs ?? 5 * 60 * 1000;
  if (input.now.getTime() - input.nonceIssuedAt.getTime() > ttl) {
    return { ok: false, refusal: 'nonce-expired', detail: 'The challenge expired before it was signed.' };
  }
  if (!input.boundAddress || input.derivedAddress.toLowerCase() !== input.boundAddress.toLowerCase()) {
    return {
      ok: false,
      refusal: 'derived-address-mismatch',
      detail:
        'The key in the envelope does not derive the address bound to this persona. The binding is wrong — do ' +
        'not sign, and do not create a second wallet; determine which address the key actually derives.',
    };
  }
  if (!input.recoveredAddress || input.recoveredAddress.toLowerCase() !== input.boundAddress.toLowerCase()) {
    return {
      ok: false,
      refusal: 'recovered-signer-mismatch',
      detail: 'The signature did not recover the bound address.',
    };
  }
  return { ok: true, detail: 'The envelope derives the bound address and a fresh signature recovered it.' };
}

// ── Verify before provisioning ──────────────────────────────────────────────

/**
 * What to DO with the row that actually exists.
 *
 *   > "Verify what exists first. Provision only when custody is genuinely
 *   > absent."
 *
 * The dangerous action is provisioning: a second wallet for a persona that
 * already has one splits its history and leaves two candidate signers with no
 * rule to choose between them. So provisioning is the narrowest branch here,
 * reachable only when custody is genuinely absent — and never as the response
 * to a mismatch, which is a question to answer rather than a gap to fill.
 */
export type WalletRemediationAction =
  | 'verify-existing'
  | 'derive-bind-then-verify'
  | 'provision-and-supersede-placeholder'
  | 'provision-new'
  | 'quarantine-do-not-provision';

export interface WalletRemediationDecision {
  action: WalletRemediationAction;
  detail: string;
  /** Guard for the one branch that must never fire by accident. */
  createsNewWallet: boolean;
}

export function decideWalletRemediation(input: {
  hasEncryptedEnvelope: boolean;
  hasRecordedAddress: boolean;
  envelopeDerivesRecordedAddress: boolean | null;
}): WalletRemediationDecision {
  const { hasEncryptedEnvelope, hasRecordedAddress, envelopeDerivesRecordedAddress } = input;

  if (hasEncryptedEnvelope && hasRecordedAddress) {
    if (envelopeDerivesRecordedAddress === false) {
      return {
        action: 'quarantine-do-not-provision',
        detail:
          'The envelope derives a different address than the one recorded. Quarantine as AMBIGUOUS and determine ' +
          'which is correct — creating a second wallet here would add a third candidate to a question that ' +
          'already has two.',
        createsNewWallet: false,
      };
    }
    return {
      action: 'verify-existing',
      detail: 'Custody and an address both exist. Unlock, derive, sign and verify. Do not provision another wallet.',
      createsNewWallet: false,
    };
  }

  if (hasEncryptedEnvelope && !hasRecordedAddress) {
    return {
      action: 'derive-bind-then-verify',
      detail: 'Real custody exists with no bound address. Derive the address from it, bind it, then prove control.',
      createsNewWallet: false,
    };
  }

  if (!hasEncryptedEnvelope && hasRecordedAddress) {
    return {
      action: 'provision-and-supersede-placeholder',
      detail:
        'An address is recorded with no key behind it — a placeholder. Provision a real wallet and supersede the ' +
        'placeholder. Never fabricate a key for the existing address.',
      createsNewWallet: true,
    };
  }

  return {
    action: 'provision-new',
    detail: 'No custody and no address. Provision a principal wallet and bind it.',
    createsNewWallet: true,
  };
}
