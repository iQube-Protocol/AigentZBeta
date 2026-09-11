/**
 * Linked external wallets — a wallet the operator genuinely controls, held
 * BESIDE the principal wallet and never inside it.
 *
 * ── Why this record exists at all ──────────────────────────────────────────
 *
 * The wallet-binding trace (#121) found the operator's real MetaMask address
 * sitting in `personas.evm_address` — the PRINCIPAL address field — because
 * `app/api/iqube/persona/passport/mint` persisted `body.ownerAddress` after
 * validating it as well-FORMED. That write path is closed (commit 125234815).
 * Closing it does not answer the question it raised: the address is real, the
 * operator does control it, and deleting it would sever a genuine binding.
 *
 * The operator's ruling (2026-08-02):
 *
 *   > "Preserve the external wallet relationship but remove it from
 *   >  principal-wallet authority."
 *
 * That requires somewhere for it to GO. `wallet_alias_commitments` is not that
 * place: its own migration header states it stores ONLY commitment hashes and
 * never plaintext addresses, it is keyed by `did_persona_id` / `root_identity_id`
 * for ICP Escrow alias ROTATION (`alias_ttl_days`, `expires_at`), and it has no
 * column for a provider, a proof, or an authority role. A hash cannot be
 * compared against an address recovered from a MetaMask signature, so proving
 * control against it is not merely awkward — it is impossible.
 *
 * ── The distinction this record encodes ────────────────────────────────────
 *
 * A principal wallet and a linked external wallet are not two grades of the
 * same thing. The principal wallet signs constitutional authority under local
 * first-party custody. An external wallet is an EXECUTION INSTRUMENT: it can
 * hold value, receive, pay, and prove it is the operator's — and it may never
 * carry a principal mandate, however well proven, because the mandate's
 * authority derives from custody the platform can reason about.
 *
 * So `maySignPrincipalMandate` is not a column an administrator could flip. It
 * is a type-level `false` and a function that ignores its input.
 */

import type { WalletCapability } from '@/services/wallet/pilotWalletException';

// ── The record ──────────────────────────────────────────────────────────────

export type LinkedWalletProvider = 'metamask' | 'phantom' | 'unisat' | 'walletconnect' | 'unknown';

export type LinkedWalletChain = 'evm' | 'btc' | 'sol';

/**
 * Whether anyone has demonstrated they hold the key.
 *
 * `unproven` is the state EVERY migrated binding starts in, without exception
 * — see `SUBMISSION_IS_NOT_PROOF`.
 */
export type ExternalControlStatus = 'unproven' | 'proven';

/**
 * What a linked wallet is FOR. One value today, and it is a union rather than
 * a literal so that a future role has to be added deliberately — with a
 * corresponding decision about `maySignPrincipalMandate`, which is the only
 * question that adding one would raise.
 */
export type ExternalAuthorityRole = 'execution_instrument';

export interface LinkedExternalWallet {
  id: string;
  /** The persona this wallet belongs to. T0 — owner self-view only. */
  subjectPersonaId: string;
  /** Never anything else. The field exists so a reader cannot mistake the row. */
  walletType: 'external_linked';
  provider: LinkedWalletProvider;
  chain: LinkedWalletChain;
  /** Plaintext, lowercased. This is the whole point of not using the commitment table. */
  address: string;
  controlStatus: ExternalControlStatus;
  /** The signing_requests id (or equivalent) that proved control. Null while unproven. */
  proofRef: string | null;
  provenAt: string | null;
  authorityRole: ExternalAuthorityRole;
  /** Type-level, not merely a default. See `externalWalletMaySignPrincipalMandate`. */
  maySignPrincipalMandate: false;
  /**
   * Where this binding came from — so a migrated row is never indistinguishable
   * from one the operator deliberately linked. `passport-mint-route` means the
   * platform wrote it on the operator's behalf without asking.
   */
  originatingWritePath: string;
  createdAt: string;
}

// ── Submission is not proof ─────────────────────────────────────────────────

/**
 * The refusal that keeps a migrated binding honest.
 *
 * The operator was explicit:
 *
 *   > "Do not classify the existing MetaMask address as proven merely because
 *   >  it was submitted to the mint route."
 *
 * And the reason is not pedantry. `body.ownerAddress` arrived as a STRING in a
 * request body. Nothing about that string demonstrated a key: no nonce, no
 * signature, no recovery. Anyone who could call the route could have put any
 * address there. Treating a submitted address as a proven one would mean the
 * platform's record of "the operator controls this wallet" rests on the
 * operator's own unverified claim — which is exactly the class of assumption
 * that put the address in the principal field to begin with.
 */
export const SUBMISSION_IS_NOT_PROOF =
  'This address was submitted to an API route and validated only as well-formed. No nonce was ' +
  'issued, no signature was produced, and no address was recovered — so nothing about it ' +
  'demonstrates key control. It is recorded as a linked external wallet in the unproven state ' +
  'until a fresh proof ceremony completes.';

/**
 * Build the binding for an address found in the principal field.
 *
 * Always `unproven`, and the signature deliberately offers no way to say
 * otherwise: there is no `controlStatus` parameter to pass, so no caller can
 * migrate a row straight into `proven` by mistake or by conviction.
 */
export function migrateAddressToLinkedBinding(input: {
  id: string;
  subjectPersonaId: string;
  provider: LinkedWalletProvider;
  chain: LinkedWalletChain;
  address: string;
  originatingWritePath: string;
  createdAt: string;
}): LinkedExternalWallet {
  return {
    id: input.id,
    subjectPersonaId: input.subjectPersonaId,
    walletType: 'external_linked',
    provider: input.provider,
    chain: input.chain,
    address: input.address.toLowerCase(),
    controlStatus: 'unproven',
    proofRef: null,
    provenAt: null,
    authorityRole: 'execution_instrument',
    maySignPrincipalMandate: false,
    originatingWritePath: input.originatingWritePath,
    createdAt: input.createdAt,
  };
}

// ── Proving control ─────────────────────────────────────────────────────────

export type ExternalProofRefusal =
  | 'NONCE_NOT_ISSUED'
  | 'NONCE_MISMATCH'
  | 'NO_SIGNATURE'
  | 'RECOVERY_FAILED'
  | 'RECOVERED_ADDRESS_MISMATCH'
  | 'WRONG_SUBJECT';

export interface ExternalProofOutcome {
  proven: boolean;
  refusal: ExternalProofRefusal | null;
  detail: string;
}

/**
 * The ceremony the operator specified, step for step:
 *
 *   > "Issue a fresh nonce → have MetaMask sign it → recover the address →
 *   >  compare → record the proof."
 *
 * The comparison is what makes it a proof. A ceremony that issued a nonce and
 * then trusted the client's claim about who signed it would be theatre — so
 * `recoveredAddress` is a required input and a mismatch is a named refusal
 * rather than a boolean false.
 */
export function verifyExternalControlProof(input: {
  wallet: LinkedExternalWallet;
  issuedNonce: string | null;
  signedNonce: string | null;
  signature: string | null;
  /** Recovered by the SERVER from (signedNonce, signature). Never supplied by the client. */
  recoveredAddress: string | null;
  subjectPersonaId: string;
}): ExternalProofOutcome {
  const refuse = (refusal: ExternalProofRefusal, detail: string): ExternalProofOutcome => ({
    proven: false,
    refusal,
    detail,
  });

  if (input.wallet.subjectPersonaId !== input.subjectPersonaId) {
    return refuse(
      'WRONG_SUBJECT',
      'This binding belongs to a different persona. A proof produced by one persona cannot establish ' +
        "control of another persona's linked wallet.",
    );
  }
  if (!input.issuedNonce) {
    return refuse(
      'NONCE_NOT_ISSUED',
      'No nonce was issued for this proof, so any signature presented could have been produced at any ' +
        'time and replayed. Start the ceremony by issuing a fresh nonce.',
    );
  }
  if (!input.signedNonce || input.signedNonce !== input.issuedNonce) {
    return refuse(
      'NONCE_MISMATCH',
      'The signed message is not the nonce that was issued for this ceremony. A signature over any ' +
        'other message proves nothing about this moment.',
    );
  }
  if (!input.signature) {
    return refuse('NO_SIGNATURE', 'No signature was presented, so there is nothing to recover an address from.');
  }
  if (!input.recoveredAddress) {
    return refuse(
      'RECOVERY_FAILED',
      'No address could be recovered from the signature. The signature is malformed or was produced over ' +
        'a different message encoding.',
    );
  }
  if (input.recoveredAddress.toLowerCase() !== input.wallet.address.toLowerCase()) {
    return refuse(
      'RECOVERED_ADDRESS_MISMATCH',
      'The signature recovers a different address than the one bound here. Whoever signed it holds a ' +
        'key — but not the key for this wallet.',
    );
  }

  return {
    proven: true,
    refusal: null,
    detail: 'A fresh nonce was signed and the recovered address matches this binding.',
  };
}

/** Apply a successful proof. Refuses to mutate on anything but a real outcome. */
export function recordExternalControlProof(
  wallet: LinkedExternalWallet,
  outcome: ExternalProofOutcome,
  proofRef: string,
  provenAt: string,
): LinkedExternalWallet {
  if (!outcome.proven) return wallet;
  return { ...wallet, controlStatus: 'proven', proofRef, provenAt };
}

// ── Capability, and the ceiling above it ────────────────────────────────────

/**
 * How a linked wallet appears to the capability classifier.
 *
 * Proving control genuinely changes something — a proven external wallet may
 * be shown as the operator's own and may be offered as a payment instrument,
 * where an unproven one may only be shown as a claim. What it does NOT change
 * is principal authority, which is why both values are separate from
 * `SIGNER_CONFIGURED` rather than a step on the way to it.
 */
export function externalWalletCapability(wallet: LinkedExternalWallet): WalletCapability {
  return wallet.controlStatus === 'proven' ? 'EXTERNAL_PROVEN' : 'EXTERNAL_UNPROVEN';
}

/**
 * Always false, for every wallet, in every state.
 *
 * A function rather than a field read because a field can be spread over, and
 * `{ ...wallet, maySignPrincipalMandate: true }` would not typecheck today but
 * would the moment someone widened the field to `boolean` for a plausible
 * reason. The operator's constraint is not a default:
 *
 *   > "Neither may satisfy principal mandate authority."
 */
export function externalWalletMaySignPrincipalMandate(_wallet: LinkedExternalWallet): false {
  return false;
}

export const EXTERNAL_WALLET_AUTHORITY_CEILING =
  'A linked external wallet is an execution instrument. Proving control establishes that the operator ' +
  'holds its key — not that the platform may treat it as principal custody. The principal mandate is ' +
  'signed by a first-party wallet whose key envelope the platform can reason about; an external wallet ' +
  'is beside that wallet, never inside it.';

// ── The resolver boundary ───────────────────────────────────────────────────

/**
 * Recorded here because the constraint is architectural, not local:
 *
 *   > "Do not make the principal-wallet resolver read external linked-wallet
 *   >  records. Preserve: principal wallet resolver = first-party principal
 *   >  custody only / external-wallet resolver = linked execution instruments
 *   >  only."
 *
 * The reason a single resolver is tempting is exactly the reason it is wrong:
 * one function answering "what address does this persona have" reads naturally
 * and quietly re-creates the mint route's defect — a real external address
 * standing where principal custody is expected, indistinguishable at the call
 * site. Two resolvers make the caller say which question it is asking.
 *
 * `tests/linked-external-wallet.test.ts` greps the principal resolver for any
 * reference to this module or its table.
 */
export const RESOLVER_SEPARATION =
  'services/identity/personaAddressResolver.ts resolves FIRST-PARTY principal custody only and must ' +
  'never read linked_external_wallets. Linked execution instruments are resolved separately and are ' +
  'never returned where a principal address is expected.';

// ── Receipts ────────────────────────────────────────────────────────────────

/**
 * The five receipt types the repair emits (operator ruling, 2026-08-02).
 *
 * Separate types rather than one `wallet_repaired` because they are separate
 * facts with separate consequences: superseding a placeholder and provisioning
 * a wallet can each happen without the other, and proving control of an
 * external wallet must never read as proving control of the principal one.
 */
export const WALLET_REPAIR_RECEIPT_TYPES = Object.freeze([
  'address_only_placeholder_superseded',
  'external_wallet_binding_migrated',
  'principal_wallet_provisioned',
  'principal_wallet_control_proven',
  'external_wallet_control_proven',
] as const);

export type WalletRepairReceiptType = (typeof WALLET_REPAIR_RECEIPT_TYPES)[number];

// ── Scope of the repair ─────────────────────────────────────────────────────

/**
 * One persona. Twenty others catalogued and untouched.
 *
 *   > "Proceed with the active operator persona only. Leave the other 20 rows
 *   >  unchanged and non-signing. Create a remediation inventory, but do not
 *   >  bulk migrate, provision, or delete anything."
 *
 * A bulk migration would be one query and would be wrong in a way no query can
 * detect: the same row shape — address present, no key material — is produced
 * both by a keyless placeholder and by a real external wallet, and the two have
 * OPPOSITE remedies. Supersede a placeholder and nothing is lost; supersede a
 * real wallet and a genuine binding is severed. The row cannot tell you which
 * it is, so a person has to.
 */
export const WALLET_REPAIR_SCOPE = Object.freeze({
  appliesTo: 'The active operator persona only',
  otherPersonas: 'quarantined-from-automatic-signing',
  permitted: Object.freeze([
    'Record a remediation inventory of the other personas',
    'Classify each individually, on its own evidence',
  ]),
  prohibited: Object.freeze([
    'Bulk migration of external bindings',
    'Bulk provisioning of principal wallets',
    'Erasing recorded addresses',
    'Automatic signing on any un-repaired persona',
  ]),
});
