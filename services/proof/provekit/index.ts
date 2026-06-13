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

const PROVEKIT_API_KEY = process.env.PROVEKIT_API_KEY ?? '';
const PROVEKIT_CIRCUIT_REGISTRY = process.env.PROVEKIT_CIRCUIT_REGISTRY ?? '';

function chooseMode(): ProveKitMode {
  if (PROVEKIT_API_KEY && PROVEKIT_CIRCUIT_REGISTRY) return 'live';
  return 'stub';
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
    // Phase B circuits — shaped placeholder so the demo path still completes.
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
      note: `Circuit ${circuit} is Phase B — placeholder commitment ref returned. proof_of_personhood and proof_of_delegation_authority ship in the demo cut.`,
    };
  }

  if (mode === 'stub') {
    const commitmentRef = `provekit:${circuit}:stub:${hash(
      circuit,
      JSON.stringify(input),
      generatedAt,
    ).slice(0, 32)}`;
    const proofToken = `${commitmentRef}.${hash(commitmentRef, 'provekit-stub').slice(0, 48)}`;
    return {
      circuit,
      proofToken,
      commitmentRef,
      mode,
      generatedAt,
      note: 'Stub mode — install the ProveKit SDK and set PROVEKIT_API_KEY + PROVEKIT_CIRCUIT_REGISTRY to generate real zk proofs.',
    };
  }

  // Live mode — TBD.
  throw new Error(
    'Live ProveKit generation not yet wired — install the ProveKit SDK and configure PROVEKIT_API_KEY + PROVEKIT_CIRCUIT_REGISTRY.',
  );
}

export interface VerifyResult {
  valid: boolean;
  circuit: ProveKitCircuit;
  mode: ProveKitMode;
  commitmentRef: string | null;
  error?: string;
  notYetImplemented?: boolean;
}

export function verifyProveKitProof(circuit: ProveKitCircuit, proofToken: string): VerifyResult {
  const mode = chooseMode();
  const supported = SUPPORTED_CIRCUITS.has(circuit);

  if (!supported) {
    // Phase B placeholders verify as "shaped but not zk-proven".
    return {
      valid: false,
      circuit,
      mode: 'stub',
      commitmentRef: null,
      notYetImplemented: true,
      error: `Circuit ${circuit} is Phase B — token is a shape placeholder, not a verified proof.`,
    };
  }

  // Stub-mode verification recomputes the deterministic signature.
  if (mode === 'stub' || proofToken.includes(':stub:')) {
    const dotIdx = proofToken.lastIndexOf('.');
    if (dotIdx < 0) {
      return { valid: false, circuit, mode, commitmentRef: null, error: 'Malformed token' };
    }
    const ref = proofToken.slice(0, dotIdx);
    const sig = proofToken.slice(dotIdx + 1);
    const expectedSig = hash(ref, 'provekit-stub').slice(0, 48);
    if (expectedSig !== sig) {
      return { valid: false, circuit, mode, commitmentRef: null, error: 'Signature mismatch' };
    }
    return { valid: true, circuit, mode, commitmentRef: ref };
  }

  return {
    valid: false,
    circuit,
    mode,
    commitmentRef: null,
    error: 'Live ProveKit verification not yet wired',
  };
}
