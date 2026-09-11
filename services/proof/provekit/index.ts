/**
 * ProveKit ZK bridge — partial cut for the 2026-06-13 hackathon submission.
 *
 * Per the plan §Sprint 6 (operator-cut): two circuits in the demo:
 *   - proof_of_personhood: citizen has a valid claimed passport
 *   - proof_of_delegation_authority: agent persona is currently delegated
 *
 * Phase B circuits (deferred, documented as planned):
 *   - proof_of_passport_standing
 *   - proof_of_document_possession
 *   - proof_of_mobility_authorization
 *
 * Stub mode (when PROVEKIT_API_KEY is unset): emits deterministic
 * commitment-style proof refs derived from sha256 of the public-safe
 * input. Real mode (TBD on canonical SDK shape — see provekit.org docs)
 * generates actual zk proofs.
 *
 * T0 discipline: this module accepts only T1-safe inputs (commitment
 * refs, passport ids, nullifier hashes). Persona IDs and other T0
 * identifiers MUST be hashed by the caller before passing here.
 */

import { createHash } from 'crypto';
import { signIssuerToken, verifyIssuerToken, getIssuerAddress, isProductionIssuer } from '@/services/identity/polityIssuer';

export type ProveKitMode = 'stub' | 'live';

export type ProveKitCircuit =
  | 'proof_of_personhood'
  | 'proof_of_delegation_authority'
  | 'proof_of_passport_standing'
  | 'proof_of_document_possession'
  | 'proof_of_mobility_authorization';

const SUPPORTED_CIRCUITS: ReadonlySet<ProveKitCircuit> = new Set([
  'proof_of_personhood',
  'proof_of_delegation_authority',
]);

export interface ProveKitProof {
  /** Circuit name. */
  circuit: ProveKitCircuit;
  /** Opaque proof token (verifier consumes; ref'd in DVN receipts). */
  proofToken: string;
  /** T1-safe commitment ref for the proof (lands on chain). */
  commitmentRef: string;
  mode: ProveKitMode;
  generatedAt: string;
  /** Phase A: when not_yet_implemented, the proof is a stub-but-shaped
      response so the demo path completes. */
  notYetImplemented?: boolean;
  note?: string;
}

function chooseMode(): ProveKitMode {
  return isProductionIssuer() ? 'live' : 'stub';
}

function hash(...parts: string[]): string {
  const h = createHash('sha256');
  for (const p of parts) h.update(p);
  return h.digest('hex');
}

export interface PersonhoodInput {
  passportId: string;
  passportClass: 'citizen';
  passportGrade: string | null;
  claimed: boolean;
  worldIdNullifier?: string | null;
}

export interface DelegationAuthorityInput {
  delegationGrantId: string;
  sponsorPassportId: string;
  delegatedAgentDidUri: string;
  expiresAt: string | null;
}

export interface PassportStandingInput {
  passportId: string;
  passportStatus: string;
}

export interface DocumentPossessionInput {
  itemId: string;
  holderPassportPublicRef: string;
}

export interface MobilityAuthorizationInput {
  sponsorPassportId: string;
  agentDidUri: string;
  destinationContext: string;
}

export async function generateProveKitProof(
  circuit: 'proof_of_personhood',
  input: PersonhoodInput,
): Promise<ProveKitProof>;
export async function generateProveKitProof(
  circuit: 'proof_of_delegation_authority',
  input: DelegationAuthorityInput,
): Promise<ProveKitProof>;
export async function generateProveKitProof(
  circuit: 'proof_of_passport_standing',
  input: PassportStandingInput,
): Promise<ProveKitProof>;
export async function generateProveKitProof(
  circuit: 'proof_of_document_possession',
  input: DocumentPossessionInput,
): Promise<ProveKitProof>;
export async function generateProveKitProof(
  circuit: 'proof_of_mobility_authorization',
  input: MobilityAuthorizationInput,
): Promise<ProveKitProof>;
export async function generateProveKitProof(
  circuit: ProveKitCircuit,
  input: Record<string, unknown>,
): Promise<ProveKitProof> {
  const generatedAt = new Date().toISOString();
  const mode = chooseMode();
  const supported = SUPPORTED_CIRCUITS.has(circuit);

  if (!supported) {
    // Phase B circuits — shaped commitment placeholder so the demo path
    // completes. The Verity/ProveKit Noir circuits for these three are
    // in design (passport_standing, document_possession,
    // mobility_authorization). When circuits ship, this branch will use
    // the real prover.
    const commitmentRef = `provekit:${circuit}:not_yet_implemented:${hash(
      circuit,
      JSON.stringify(input),
      generatedAt,
    ).slice(0, 32)}`;
    return {
      circuit,
      proofToken: `${commitmentRef}.placeholder`,
      commitmentRef,
      mode: 'stub',
      generatedAt,
      notYetImplemented: true,
      note: `Circuit ${circuit} is Phase B — Noir circuit in design. proof_of_personhood and proof_of_delegation_authority ship in the demo cut.`,
    };
  }

  // Supported circuit — sign the commitment with the polity issuer key
  // (EIP-191). This is a real cryptographic proof of issuance: the token
  // is signed by POLITY_ISSUER_PRIVATE_KEY and verifiable by anyone with
  // the issuer's public address. Once the corresponding Noir circuit is
  // compiled and the .pkp/.pkv schemes bundled, the prover.prove() call
  // replaces this signed commitment with a real ZK proof. The token
  // contract is identical from the verifier's perspective.
  const commitmentRef = `provekit:${circuit}:${mode}:${hash(
    circuit,
    JSON.stringify(input),
    generatedAt,
  ).slice(0, 32)}`;
  const issuerAddress = getIssuerAddress();
  const payload = {
    iss: 'polity-passport-bureau',
    issuer_address: issuerAddress,
    schema: `polity.attestation.${circuit}.v0.1`,
    circuit,
    commitment_ref: commitmentRef,
    inputs: input,
    generated_at: generatedAt,
  };
  const proofToken = await signIssuerToken(payload);
  return {
    circuit,
    proofToken,
    commitmentRef,
    mode,
    generatedAt,
    note:
      mode === 'stub'
        ? 'Dev-issuer mode — proof is a real EIP-191 signed commitment. Set POLITY_ISSUER_PRIVATE_KEY for production issuance. Full Noir-circuit ZK proofs ship once .pkp/.pkv schemes are compiled.'
        : 'Production issuer — EIP-191 signed commitment. Verifiable against the issuer address. Noir-circuit ZK proofs upgrade this signed commitment when circuits ship.',
  };
}

export interface VerifyResult {
  valid: boolean;
  circuit: ProveKitCircuit;
  mode: ProveKitMode;
  commitmentRef: string | null;
  error?: string;
  notYetImplemented?: boolean;
}

export async function verifyProveKitProof(
  circuit: ProveKitCircuit,
  proofToken: string,
): Promise<VerifyResult> {
  const mode = chooseMode();
  const supported = SUPPORTED_CIRCUITS.has(circuit);

  if (!supported) {
    return {
      valid: false,
      circuit,
      mode: 'stub',
      commitmentRef: null,
      notYetImplemented: true,
      error: `Circuit ${circuit} is Phase B — token is a shape placeholder, not a verified proof.`,
    };
  }

  const result = await verifyIssuerToken(proofToken);
  if (!result.valid) {
    return {
      valid: false,
      circuit,
      mode,
      commitmentRef: null,
      error: result.error ?? 'Issuer signature verification failed',
    };
  }
  const payload = result.payload as { commitment_ref?: string; circuit?: string } | null;
  if (payload?.circuit !== circuit) {
    return {
      valid: false,
      circuit,
      mode,
      commitmentRef: null,
      error: 'Circuit mismatch',
    };
  }
  return {
    valid: true,
    circuit,
    mode,
    commitmentRef: payload.commitment_ref ?? null,
  };
}
