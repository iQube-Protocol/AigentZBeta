/**
 * Vela local development deployment config — the exact coordinates proven
 * live during Slice 2A (VELA_LOCAL_READY): full deploy → register → deposit
 * → confidential balance read → two-party private transfer, all succeeding
 * against these addresses on the local `vela-starterkit` Docker Compose
 * stack. See docs/vela/VELA-ATTESTATION-BOUNDARY-001.md — this deployment
 * runs `NoAttestationTeeAuthenticator` (`attestationMode: 'no_attestation'`),
 * NOT a real Nitro-attested TeeAuthenticator.
 *
 * These values are the starter kit's own documented defaults
 * (`vela-starterkit/dockerfiles/README.md` §"Practical how-to") and were
 * independently confirmed against a live local run, not guessed.
 *
 * Server-side only — never import into client code (matches the CLAUDE.md
 * rule against NEXT_PUBLIC_-exposing any service-side config by accident;
 * nothing here is a secret, but the local stack is not a production target).
 */

import type { VelaDeploymentDescriptor } from './velaTypes';

export const VELA_LOCAL_DEPLOYMENT: VelaDeploymentDescriptor = {
  chainId: 31337,
  rpcUrl: 'http://localhost:8545',
  processorEndpointAddress: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
  teeAuthenticatorAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  authorityServiceUrl: 'http://localhost:8081',
  subgraphUrl: 'http://localhost:8000/subgraphs/name/hcce',
  attestationMode: 'no_attestation',
};

/**
 * No production/testnet Vela deployment exists yet — this is a documented
 * gap, not an omission. See docs/vela/VELA_EARLY_ACCESS_HANDOFF.md (to be
 * produced once local-provable work is exhausted, per VELA-001 §28) for the
 * exact infrastructure Horizen must provision before one can be added here.
 */
export function resolveVelaDeployment(env: 'local'): VelaDeploymentDescriptor {
  if (env !== 'local') {
    throw new Error(
      `resolveVelaDeployment: no Vela deployment configured for env "${env}" — ` +
        'only "local" exists until Horizen early-access infrastructure is provisioned (see VELA_EARLY_ACCESS_HANDOFF.md).',
    );
  }
  return VELA_LOCAL_DEPLOYMENT;
}
