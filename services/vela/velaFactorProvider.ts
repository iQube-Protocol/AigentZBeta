/**
 * Factor's confidential-compute provider factory (Factor + Aegis PRD tranche:
 * "integrate the existing Vela SDK test TEE and prepare Factor for a
 * controlled end-to-end Horizen Journey Spine rehearsal").
 *
 * Reuses the EXISTING Vela machinery wholesale — `VelaConfidentialProjectionProvider`
 * (services/vela/velaProjectionProvider.ts), `VelaTestTransport` (services/
 * vela/velaTestTransport.ts) and `VELA_LOCAL_DEPLOYMENT` (services/vela/
 * velaConfig.ts) — this file invents no new simulator, no new Vela
 * abstraction, and no new confidential-compute state machine. It is the
 * FIRST real application-layer caller of `ConfidentialProjectionProvider`
 * (services/constitutionalCommerce/unifiedConsequenceProjection.ts already
 * consumes its OUTPUT shape, but nothing before this ever drove the
 * prepare→submit→observe→evidence→verify sequence outside a test/script).
 *
 * WHY THE TEST TRANSPORT, HONESTLY: `services/vela/velaConfig.ts`'s own doc
 * comment states there is no production/testnet Vela deployment configured
 * anywhere — `resolveVelaDeployment` only resolves `'local'`, which targets a
 * literal `localhost:8545` Docker Compose stack unreachable from any deployed
 * environment (dev-beta or otherwise) or this sandbox. So the ONLY provider
 * this codebase can honestly construct today is the deterministic in-memory
 * test-TEE double — this factory makes that explicit rather than silently
 * defaulting to something that would fail. `getCapabilities().attestationMode`
 * reports `'NO_ATTESTATION_LOCAL'` structurally (from `VELA_LOCAL_DEPLOYMENT
 * .attestationMode: 'no_attestation'`) — no caller needs a separate
 * "simulated" flag; the provider's own attestation-mode vocabulary already
 * carries that truth (VELA-ATTESTATION-BOUNDARY-001).
 *
 * Memoized per (applicationId) for the process lifetime — mirrors
 * services/financialServices/providers/bankr/bankrProviderAdapter.ts's own
 * `cachedFakeTransport` reasoning exactly: a job submitted via one call must
 * still be visible to a LATER status/evidence read within the same process,
 * and a fresh `VelaTestTransport` per call would silently "forget" it.
 *
 * Server-side only.
 */

import { VelaConfidentialProjectionProvider } from './velaProjectionProvider';
import { VelaTestTransport } from './velaTestTransport';
import { VELA_LOCAL_DEPLOYMENT } from './velaConfig';
import type { ConfidentialProjectionProvider } from '@/types/confidentialProjection';

/** The registered-vs-signing distinction only matters for tests proving a
 *  tampered/mismatched result — production callers never need to supply
 *  these, so they default to the same fixed, deterministic address. */
const DEFAULT_TEE_SIGNER = '0x0000000000000000000000000000000000000001';

export interface FactorConfidentialProviderOptions {
  applicationId?: string;
  /** Decides the confidential app's coarse verdict for a given plaintext —
   *  see VelaTestTransportOptions.verdictFor. Defaults to a policy-threshold
   *  comparison matching the shape factorConfidentialWorkload.ts submits. */
  verdictFor?: (plaintextJson: string) => string | null;
  registeredTeeSigner?: string;
  signingTeeSigner?: string;
  errorCode?: number;
  pendingPolls?: number;
}

function defaultVerdictFor(plaintextJson: string): string | null {
  try {
    const parsed = JSON.parse(plaintextJson) as { inputs?: Record<string, number> };
    const inputs = parsed.inputs ?? {};
    const readinessScore = inputs.readinessScore;
    const policyThreshold = inputs.policyThreshold;
    if (typeof readinessScore !== 'number' || typeof policyThreshold !== 'number') {
      return JSON.stringify({ verdict: 'UNRESOLVED' });
    }
    return JSON.stringify({ verdict: readinessScore >= policyThreshold ? 'ACCEPTABLE' : 'UNACCEPTABLE' });
  } catch {
    return JSON.stringify({ verdict: 'UNRESOLVED' });
  }
}

let cachedProvider: ConfidentialProjectionProvider | null = null;
let cachedKey: string | null = null;

/**
 * Returns a memoized `VelaConfidentialProjectionProvider` over the
 * deterministic test transport. Pass `options` (a fresh applicationId, or a
 * `signingTeeSigner` distinct from `registeredTeeSigner`) to force a NEW,
 * unmemoized instance for a test that needs isolation or a tampered-signer
 * scenario — the memo key includes every option so two different test
 * configurations never collide.
 */
export function createFactorConfidentialProjectionProvider(
  options: FactorConfidentialProviderOptions = {},
): ConfidentialProjectionProvider {
  const applicationId = options.applicationId ?? 'factor-confidential-workloads';
  const registeredTeeSigner = options.registeredTeeSigner ?? DEFAULT_TEE_SIGNER;
  const key = JSON.stringify({
    applicationId,
    registeredTeeSigner,
    signingTeeSigner: options.signingTeeSigner ?? registeredTeeSigner,
    errorCode: options.errorCode ?? 0,
    pendingPolls: options.pendingPolls ?? 0,
    customVerdict: Boolean(options.verdictFor),
  });
  if (cachedProvider && cachedKey === key) return cachedProvider;

  const transport = new VelaTestTransport({
    deployment: VELA_LOCAL_DEPLOYMENT,
    registeredTeeSigner,
    signingTeeSigner: options.signingTeeSigner,
    verdictFor: options.verdictFor ?? defaultVerdictFor,
    errorCode: options.errorCode,
    pendingPolls: options.pendingPolls,
  });
  const provider = new VelaConfidentialProjectionProvider(transport, applicationId);
  cachedProvider = provider;
  cachedKey = key;
  return provider;
}

/** Test-only: clears the memoized provider so each test starts isolated. */
export function resetFactorConfidentialProjectionProviderForTests(): void {
  cachedProvider = null;
  cachedKey = null;
}
