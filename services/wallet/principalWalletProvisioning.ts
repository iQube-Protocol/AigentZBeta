/**
 * Provisioning a first-party principal wallet — and why storing the envelope
 * is not the end of it.
 *
 * ── The ruling this implements (operator, 2026-08-02) ──────────────────────
 *
 *   preserve current MetaMask address as EXTERNAL_UNPROVEN
 *   → create linked_external_wallets record
 *   → supersede the keyless evm_key.address placeholder
 *   → generate a new EVM keypair client-side
 *   → derive its address client-side
 *   → encrypt the private key client-side using the wallet password
 *   → persist ciphertext envelope and derived address
 *   → issue fresh control-proof nonce
 *   → unlock and sign locally
 *   → recover and compare server-side
 *   → record CONTROL_PROVEN
 *
 * ── The one thing that is easy to get wrong ────────────────────────────────
 *
 *   > "Provisioning is not complete when the encrypted envelope is stored.
 *   >  That establishes only SIGNER_CONFIGURED."
 *
 * This is not a formality. The trace (#121) found three provisioning paths
 * that wrote a well-formed address with nothing behind it, and `keyService`'s
 * own `deriveEvmAddress` has a fallback that SHA-256s the private key into a
 * plausible-looking address when ethers fails to load. Every one of those
 * produces a row that passes every structural check and can never sign.
 *
 * A stored envelope proves a row was written. Only a fresh signature that
 * recovers to the bound address proves a key exists and that this session
 * holds it. So the terminal state is CONTROL_PROVEN, and a ceremony that
 * stops at the envelope is reported as INCOMPLETE — never as success.
 *
 * ── What never crosses the wire ────────────────────────────────────────────
 *
 *   > "Never send: wallet password / plaintext private key / decrypted
 *   >  envelope."
 *
 * `screenProvisioningPayload` refuses the request rather than trusting the
 * client not to include them. A server that would ACCEPT a plaintext key is
 * a server that will eventually be handed one — by a well-meaning debug
 * build, a retry helper, or a future contributor who reads the field list and
 * assumes it is allowed because nothing stopped them.
 */

// ── The sequence, named ─────────────────────────────────────────────────────

/**
 * Recorded as data, not prose, so a canary can assert the ORDER — which is the
 * part that carries the safety property. Superseding the placeholder before
 * the new envelope exists would leave the persona with no wallet at all;
 * proving control before the envelope is stored would prove control of
 * nothing the platform has recorded.
 */
export const PROVISIONING_SEQUENCE = Object.freeze([
  'preserve-external-address-as-unproven',
  'create-linked-external-wallet-record',
  'supersede-keyless-placeholder',
  'generate-keypair-client-side',
  'derive-address-client-side',
  'encrypt-private-key-client-side',
  'persist-ciphertext-envelope-and-address',
  'issue-fresh-control-proof-nonce',
  'unlock-and-sign-locally',
  'recover-and-compare-server-side',
  'record-control-proven',
] as const);

export type ProvisioningStep = (typeof PROVISIONING_SEQUENCE)[number];

/**
 * External-wallet proof is NOT a precondition.
 *
 *   > "Do not require MetaMask proof before provisioning the principal wallet.
 *   >  External-wallet verification is an independent optional follow-up."
 *
 * The two ceremonies share a shape and nothing else. Coupling them would make
 * the principal wallet — the thing that actually carries authority — wait on
 * an instrument that can never carry any.
 */
export const EXTERNAL_PROOF_IS_NOT_A_PRECONDITION =
  'Proving control of the linked external wallet is an independent, optional follow-up. Principal ' +
  'provisioning never waits on it, and a refused or skipped external proof never blocks it.';

// ── Refusals ────────────────────────────────────────────────────────────────

export type ProvisioningRefusal =
  /** The request names a persona other than the authenticated caller's. */
  | 'WRONG_PERSONA'
  /** The caller owns this persona, but it is not the one currently active. */
  | 'NON_ACTIVE_PERSONA'
  /** A principal signer is already configured AND freshly proven. Never silently replace one. */
  | 'EXISTING_VERIFIED_SIGNER'
  /**
   * An encrypted principal envelope already exists for this persona.
   *
   *   > "Do not create another keypair if an encrypted principal-wallet
   *   >  envelope already exists." (operator, 2026-08-02)
   *
   * Distinct from EXISTING_VERIFIED_SIGNER, and the distinction is the whole
   * recovery path: a wallet whose control was never proven is NOT finished,
   * but it is also not absent. Generating a second keypair would abandon a key
   * the operator may already hold — and would do so at the exact moment the UI
   * is trying to help them finish. The remedy is to prove the existing one.
   */
  | 'PRINCIPAL_ENVELOPE_ALREADY_EXISTS'
  /** A 32-byte private key appeared in the payload. */
  | 'PLAINTEXT_KEY_IN_PAYLOAD'
  /** A password field appeared in the payload. */
  | 'PASSWORD_IN_REQUEST'
  /** This provisioning request id has already been consumed. */
  | 'REPLAYED_PROVISIONING_REQUEST'
  /** Client-derived address and server-recovered address disagree. */
  | 'ADDRESS_MISMATCH'
  /** The address is a legacy/deployer address under PILOT-WALLET-EXCEPTION-001, or known-compromised. */
  | 'COMPROMISED_OR_LEGACY_ADDRESS'
  /** Not a well-formed EVM address. */
  | 'MALFORMED_ADDRESS'
  /** No ciphertext envelope was supplied, so there would be nothing behind the address. */
  | 'MISSING_ENVELOPE';

export interface ProvisioningDecision {
  permitted: boolean;
  refusal: ProvisioningRefusal | null;
  /** Why, in the operator's terms. Never a bare status word. */
  detail: string;
}

const PERMITTED: ProvisioningDecision = Object.freeze({
  permitted: true,
  refusal: null,
  detail: 'The request is scoped to the active persona, carries no secret material, and replaces no proven signer.',
});

function refuse(refusal: ProvisioningRefusal, detail: string): ProvisioningDecision {
  return { permitted: false, refusal, detail };
}

// ── Screening the payload for things that must never be sent ────────────────

/** Field names that must never appear, at any depth, under any casing. */
const FORBIDDEN_FIELD_PATTERNS: readonly { pattern: RegExp; refusal: ProvisioningRefusal }[] = Object.freeze([
  { pattern: /password|passphrase|pass_phrase|pwd/i, refusal: 'PASSWORD_IN_REQUEST' },
  {
    pattern: /privatekey|private_key|plaintextkey|plaintext_key|decryptedkey|decrypted_key|secretkey|secret_key|mnemonic|seedphrase|seed_phrase/i,
    refusal: 'PLAINTEXT_KEY_IN_PAYLOAD',
  },
]);

/** A bare 32-byte hex value, with or without the 0x prefix. */
const RAW_PRIVATE_KEY = /^(0x)?[0-9a-fA-F]{64}$/;

/** The one field whose contents are ciphertext by construction. */
export const ENVELOPE_FIELD = 'encryptedEnvelope';

/** Exactly what an AES-256-GCM envelope from `keyService.encryptPrivateKey` contains. */
const ENVELOPE_KEYS = Object.freeze(['salt', 'iv', 'ciphertext', 'authTag'] as const);

/**
 * Screen by SHAPE, not by field name alone.
 *
 * Checking names catches the honest mistake — a client that sends
 * `{ privateKey }` because the local variable was called that. Checking values
 * catches the dangerous one: a key smuggled through an innocuously named
 * field, which is exactly what a rushed retry helper or a copied-and-renamed
 * request body produces. Neither check subsumes the other.
 *
 * ── Why the envelope is exempt from the VALUE check ────────────────────────
 *
 * `keyService.encryptPrivateKey` uses a 32-byte salt, which serialises to
 * exactly 64 hex characters — indistinguishable, by shape alone, from a raw
 * private key. So a value check applied inside the envelope would refuse every
 * legitimate request, and a screen that fires on every honest payload is a
 * screen someone will delete.
 *
 * The exemption is bounded rather than blanket: the envelope must have exactly
 * the four expected hex fields and nothing else, so nothing can ride along
 * beside them, and the NAME check still applies inside it.
 *
 * ── The residual, stated rather than papered over ──────────────────────────
 *
 * A client that deliberately placed a private key in the `salt` field would
 * pass. No check can distinguish it: a salt is 32 random bytes and so is a
 * key. That residual is bounded by who could do it — the persona's own owner,
 * leaking their own key to their own platform. This screen is a guard against
 * MISTAKES, which is the failure mode that actually occurred (#121), and it
 * does not claim to be a guard against a client determined to exfiltrate.
 */
export function screenProvisioningPayload(payload: unknown): ProvisioningDecision {
  const seen = new Set<unknown>();

  const walk = (node: unknown, path: string, insideEnvelope: boolean): ProvisioningDecision | null => {
    if (node === null || typeof node !== 'object') return null;
    if (seen.has(node)) return null;
    seen.add(node);

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        const hit = walk(node[i], `${path}[${i}]`, insideEnvelope);
        if (hit) return hit;
      }
      return null;
    }

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const here = path ? `${path}.${key}` : key;
      const isEnvelope = !insideEnvelope && key === ENVELOPE_FIELD;

      // The NAME check applies everywhere, envelope included.
      for (const { pattern, refusal } of FORBIDDEN_FIELD_PATTERNS) {
        if (pattern.test(key)) {
          return refuse(
            refusal,
            `The request carries a field named "${here}". The wallet password, the plaintext private key and ` +
              'the decrypted envelope never leave the browser — encryption happens client-side and only ' +
              'ciphertext is persisted.',
          );
        }
      }

      if (isEnvelope) {
        const shape = envelopeShapeFault(value, here);
        if (shape) return shape;
      } else if (!insideEnvelope && typeof value === 'string' && RAW_PRIVATE_KEY.test(value.trim())) {
        return refuse(
          'PLAINTEXT_KEY_IN_PAYLOAD',
          `The field "${here}" holds a bare 32-byte hex value, which is the shape of an unencrypted private ` +
            'key. Whatever the field is named, a value of that shape is refused rather than stored.',
        );
      }

      const hit = walk(value, here, insideEnvelope || isEnvelope);
      if (hit) return hit;
    }
    return null;
  };

  return walk(payload, '', false) ?? PERMITTED;
}

/**
 * The envelope must be exactly the four expected hex fields.
 *
 * A permissive exemption would let anything be smuggled beside them under the
 * one field the value check does not read. Requiring the exact shape means the
 * exemption covers only what it was granted for.
 */
function envelopeShapeFault(value: unknown, path: string): ProvisioningDecision | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return refuse(
      'MISSING_ENVELOPE',
      `"${path}" is not a ciphertext envelope object. Expected ${ENVELOPE_KEYS.join(', ')}.`,
    );
  }
  // Name check FIRST, over the envelope's own keys. The shape check would also
  // refuse `{ password }` — as an unexpected field — but on the wrong grounds,
  // and a refusal that names the wrong problem sends the caller to fix it.
  for (const key of Object.keys(value as Record<string, unknown>)) {
    for (const { pattern, refusal } of FORBIDDEN_FIELD_PATTERNS) {
      if (pattern.test(key)) {
        return refuse(
          refusal,
          `The request carries a field named "${path}.${key}". The wallet password, the plaintext private key ` +
            'and the decrypted envelope never leave the browser — encryption happens client-side and only ' +
            'ciphertext is persisted.',
        );
      }
    }
  }

  const keys = Object.keys(value as Record<string, unknown>).sort();
  const expected = [...ENVELOPE_KEYS].sort();
  if (keys.length !== expected.length || keys.some((k, i) => k !== expected[i])) {
    return refuse(
      'PLAINTEXT_KEY_IN_PAYLOAD',
      `"${path}" carries fields other than ${ENVELOPE_KEYS.join(', ')}. The envelope is exempt from the ` +
        'raw-key shape check, so nothing may ride along inside it.',
    );
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v !== 'string' || !/^[0-9a-fA-F]+$/.test(v)) {
      return refuse('MISSING_ENVELOPE', `"${path}.${k}" is not a hex string, so this is not a usable envelope.`);
    }
  }
  return null;
}

// ── The provisioning gate ───────────────────────────────────────────────────

export interface ProvisioningRequest {
  /** The persona named in the request body. */
  subjectPersonaId: string;
  /** The persona the spine resolved for this caller. */
  callerPersonaId: string;
  /** The persona the caller currently has active. */
  activePersonaId: string;
  /** Client-derived address for the newly generated key. */
  derivedAddress: string;
  /** Present iff a ciphertext envelope was supplied. Never the envelope itself. */
  envelopePresent: boolean;
  /** Already-consumed provisioning request ids, for replay detection. */
  requestId: string;
  consumedRequestIds: readonly string[];
  /** Lower-cased legacy/compromised addresses (agentConfig + key-rotation register). */
  disallowedAddresses: ReadonlySet<string>;
  /** True only when a principal signer is BOTH configured and freshly control-proven. */
  existingSignerVerified: boolean;
  /**
   * True when `personas.evm_key.encryptedPrivateKey` is present — i.e. real key
   * material exists, proven or not. Deliberately NOT the same as "an address is
   * on file": the keyless placeholder has an address and no envelope, and that
   * is precisely the case provisioning is FOR.
   */
  existingEnvelopePresent: boolean;
}

const WELL_FORMED = /^0x[0-9a-fA-F]{40}$/;

/**
 * Ordered deliberately. Identity first, because a request scoped to the wrong
 * persona should be refused on that ground rather than on some detail of its
 * contents — a refusal that names the wrong reason sends the operator to fix
 * the wrong thing.
 */
export function evaluateProvisioningRequest(req: ProvisioningRequest): ProvisioningDecision {
  if (req.subjectPersonaId !== req.callerPersonaId) {
    return refuse(
      'WRONG_PERSONA',
      'The request provisions a wallet for a persona other than the authenticated caller. A principal ' +
        'wallet may only ever be provisioned by its own subject.',
    );
  }
  if (req.callerPersonaId !== req.activePersonaId) {
    return refuse(
      'NON_ACTIVE_PERSONA',
      'This persona is yours but is not the one currently active. The repair is scoped to the active ' +
        'operator persona; switch to it deliberately rather than provisioning a persona you are not looking at.',
    );
  }
  if (req.existingSignerVerified) {
    return refuse(
      'EXISTING_VERIFIED_SIGNER',
      'This persona already has a configured principal signer whose control has been proven. Replacing it ' +
        'would orphan every signature it has produced, so it is never done implicitly.',
    );
  }
  if (req.existingEnvelopePresent) {
    return refuse(
      'PRINCIPAL_ENVELOPE_ALREADY_EXISTS',
      'An encrypted principal wallet already exists for this persona. Provisioning a second one would ' +
        'abandon a key you may already hold. If its control has not been proven, prove the existing wallet ' +
        'instead — that is the remaining step, not a new wallet.',
    );
  }
  if (req.consumedRequestIds.includes(req.requestId)) {
    return refuse(
      'REPLAYED_PROVISIONING_REQUEST',
      'This provisioning request has already been consumed. Replaying it would provision a second wallet ' +
        'for a persona that just received one.',
    );
  }
  if (!req.envelopePresent) {
    return refuse(
      'MISSING_ENVELOPE',
      'No ciphertext envelope was supplied, so the address would be recorded with nothing behind it — the ' +
        'exact ADDRESS_ONLY defect this repair exists to remove.',
    );
  }
  if (!WELL_FORMED.test(req.derivedAddress)) {
    return refuse('MALFORMED_ADDRESS', 'The derived address is not a well-formed EVM address.');
  }
  if (req.disallowedAddresses.has(req.derivedAddress.toLowerCase())) {
    return refuse(
      'COMPROMISED_OR_LEGACY_ADDRESS',
      'The derived address is a legacy platform address held under PILOT-WALLET-EXCEPTION-001, or is ' +
        'recorded as compromised. It may be displayed as evidence and may never become a principal signer.',
    );
  }
  return PERMITTED;
}

// ── Completion ──────────────────────────────────────────────────────────────

export type ProvisioningStage =
  /** Nothing persisted yet. */
  | 'NOT_STARTED'
  /** Envelope and address stored. Structurally a signer; control unproven. */
  | 'SIGNER_CONFIGURED'
  /** A fresh signature recovered to the bound address. The terminal state. */
  | 'CONTROL_PROVEN';

export interface ProvisioningCompletion {
  stage: ProvisioningStage;
  complete: boolean;
  /** What still has to happen. Null once complete. */
  outstanding: string | null;
}

/**
 * The reason this returns `complete: false` at SIGNER_CONFIGURED.
 *
 * A UI that reports "wallet created" the moment the envelope lands is telling
 * the operator something the platform has not verified. The whole point of the
 * trace was that a row can look complete and be unsignable.
 */
export function provisioningCompletion(state: {
  envelopeStored: boolean;
  addressBound: boolean;
  controlProven: boolean;
}): ProvisioningCompletion {
  if (state.controlProven) {
    if (!state.envelopeStored || !state.addressBound) {
      // Control proven against nothing stored is incoherent, not complete.
      return {
        stage: 'NOT_STARTED',
        complete: false,
        outstanding:
          'A control proof was recorded without a stored envelope and bound address. Re-run provisioning; ' +
          'do not treat the proof as standing on its own.',
      };
    }
    return { stage: 'CONTROL_PROVEN', complete: true, outstanding: null };
  }
  if (state.envelopeStored && state.addressBound) {
    return {
      stage: 'SIGNER_CONFIGURED',
      complete: false,
      outstanding:
        'The encrypted envelope and its address are stored, which establishes SIGNER_CONFIGURED only. ' +
        'Provisioning completes when a fresh nonce is signed locally and the recovered address matches ' +
        'the bound address.',
    };
  }
  return {
    stage: 'NOT_STARTED',
    complete: false,
    outstanding: 'Generate a keypair client-side, encrypt it with the wallet password, and persist the envelope.',
  };
}

// ── Comparing the recovery ──────────────────────────────────────────────────

export interface ControlProofComparison {
  matched: boolean;
  refusal: 'ADDRESS_MISMATCH' | null;
  detail: string;
}

/**
 * The comparison the whole ceremony exists for.
 *
 * Separated from the route so it is testable without a network, a database or
 * a key: the property "a recovered address that differs is refused" should not
 * depend on anything that can be mocked into agreeing.
 */
export function compareRecoveredAddress(
  boundAddress: string,
  recoveredAddress: string | null,
): ControlProofComparison {
  if (!recoveredAddress) {
    return {
      matched: false,
      refusal: 'ADDRESS_MISMATCH',
      detail:
        'No address could be recovered from the signature, so nothing demonstrates that the stored envelope ' +
        'holds a real key.',
    };
  }
  if (recoveredAddress.toLowerCase() !== boundAddress.toLowerCase()) {
    return {
      matched: false,
      refusal: 'ADDRESS_MISMATCH',
      detail:
        'The signature recovers a different address than the one bound to this persona. The stored envelope ' +
        'does not hold the key for the recorded address — which is precisely the failure a stored envelope ' +
        'alone cannot rule out.',
    };
  }
  return {
    matched: true,
    refusal: null,
    detail: 'A fresh nonce was signed locally and the recovered address matches the bound address.',
  };
}

// ── The superseded placeholder ──────────────────────────────────────────────

export interface SupersededPlaceholder {
  address: string;
  capability: 'ADDRESS_ONLY';
  status: 'superseded';
  signing: 'non-signing';
  supersededBy: string;
  supersededAt: string;
  reason: string;
}

/**
 * Preserved, never deleted.
 *
 *   > "Preserve the old placeholder in audit history: ADDRESS_ONLY /
 *   >  superseded / non-signing."
 *
 * Deleting it would erase the only record that the persona once presented an
 * address that could not sign — and that record is what makes the other twenty
 * personas legible when someone comes to classify them. An absent row reads as
 * "this never happened"; a superseded one reads as "this happened and was
 * handled".
 */
export function supersedePlaceholder(input: {
  placeholderAddress: string;
  newPrincipalAddress: string;
  supersededAt: string;
}): SupersededPlaceholder {
  return {
    address: input.placeholderAddress.toLowerCase(),
    capability: 'ADDRESS_ONLY',
    status: 'superseded',
    signing: 'non-signing',
    supersededBy: input.newPrincipalAddress.toLowerCase(),
    supersededAt: input.supersededAt,
    reason:
      'Twenty random bytes recorded as an address with no key material behind it. Superseded by a ' +
      'first-party principal wallet whose control was freshly proven. Retained as audit history; never ' +
      'reinstated, never signed against.',
  };
}
