import { activationProvenanceBlockers } from '@/services/ops/canisterSourceManifest';

export type Cap1ActivationStatus =
  | 'not_run'
  | 'in_progress'
  | 'blocked_external_substrate'
  | 'passed'
  | 'failed';

/**
 * CAP-1 is the final activation gate for the PoS/BTC leg.
 *
 * This record is intentionally explicit and manually advanced. A4 provenance
 * can be proven entirely from artifacts and module hashes; CAP-1 cannot. CAP-1
 * passes only when an independent observer can start from a real Bitcoin
 * transaction and verify OP_RETURN(root) -> Merkle proof -> H.
 *
 * Current state, 2026-08-08: the ceremony reached the live Bitcoin boundary
 * but the IC Bitcoin Testnet canister was stalled at height 147508 while the
 * funding transaction existed at 147513 and the external Testnet4 chain had
 * advanced to at least 147515. The signer therefore saw no UTXO and failed
 * closed before signing or broadcasting anything.
 */
export const CAP1_ACTIVATION_EVIDENCE = {
  status: 'blocked_external_substrate' as Cap1ActivationStatus,
  canonicalSourceCommit: '7387fc1a1ecb58ffd7f81d15c9fe5b51d19b0d7c',
  proofOfStateCanisterId: 'cz7nu-zyaaa-aaaao-qqavq-cai',
  signerCanisterId: 'c66la-uaaaa-aaaao-qqava-cai',
  rootHex: 'a3e774cb030179e5257b4d8e929f4f09bb368848a9ee933a97b310d47db4e978',
  hHexes: [
    'bfee174c36cb98116cd3eec835d4e20460ef4be713f5edd691b7df6b2d379c78',
    'ee958f3f18c36d38fb3af27f593603050e22b206380b4677cebb9f4b31a3412c',
    '97b0b969c55b2e231dde79f24a6b54ca6ed47857b949bbe3e83b43fb145b8acc',
  ],
  signerAddress: 'tb1qyyr0hdq7ck3wrtgup6cxy5egh5frvyft7p0qd6',
  fundingTxid: 'ef1721b54e3348b594531d01f257b3562f9a95524277c1a20cff3f4198fa5097',
  fundingVout: 1,
  fundingValueSats: 1_000_000,
  fundingBlockHeight: 147_513,
  lastObservedExternalTip: 147_515,
  lastObservedIcBitcoinTip: 147_508,
  anchorTxid: null as string | null,
  anchorBlockHeight: null as number | null,
  blocker:
    'ICP Bitcoin Testnet substrate had not reached the funding block, so bitcoin_get_utxos returned an empty set. Constitutional Anchor v2 refused before signing/broadcast; proof_of_state_v2 remained Unanchored.',
  lastObservedAt: '2026-08-08',
} as const;

export function bitcoinAnchorActivationBlockers(): string[] {
  const blockers = activationProvenanceBlockers().map((entry) => `provenance:${entry.name}`);
  if (CAP1_ACTIVATION_EVIDENCE.status !== 'passed') {
    blockers.push(`cap1:${CAP1_ACTIVATION_EVIDENCE.status}`);
  }
  return blockers;
}

export function bitcoinAnchorActivationReady(): boolean {
  return bitcoinAnchorActivationBlockers().length === 0;
}
