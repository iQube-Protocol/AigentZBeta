/**
 * CANISTER SOURCE MANIFEST — cross-repo source and deployment provenance.
 *
 * Repository boundaries are not epistemic boundaries. This manifest records
 * where each canister's canonical implementation lives and, separately, what
 * has actually been observed about a deployment. A deployed module hash is an
 * observation; it becomes source provenance only after the deployment artifact
 * and an independent rebuild of the pinned source both match that hash.
 */

export interface CanisterSourceEntry {
  /** The canister's name in its canonical repo's dfx.json. */
  name: string;
  /** Deployed canister principal, or an explicit local/unknown marker. */
  canisterId: string;
  network: 'ic' | 'local';
  canonicalRepo: string | null;
  canonicalPath: string | null;
  sourceLocationStatus: 'located' | 'unlocated';
  /** Required when unlocated; may also record lineage/context for located entries. */
  note?: string;
  /** Pinned canonical source commit that was read and verified. */
  sourceCommitLastVerified: string | null;
  lastVerifiedAt: string | null;
  /** AigentZBeta-owned consumer binding. */
  localIdlPath: string;
  /** sha256 observed from the deployed IC module. */
  deployedModuleHash: string | null;
  /**
   * sha256 of the exact staged artifact used by the deployment session, after
   * verifying it equals deployedModuleHash. This is the first half of A4.
   */
  deploymentArtifactHashVerified: string | null;
  /**
   * sha256 of a fresh independent rebuild of sourceCommitLastVerified, after
   * verifying it equals deployedModuleHash. This is the second half of A4.
   */
  moduleHashVerifiedAgainstSource: string | null;
  observedCaveats: string[];
}

export const CANISTER_SOURCE_MANIFEST: CanisterSourceEntry[] = [
  {
    name: 'cross_chain_service',
    sourceLocationStatus: 'located',
    canisterId: 'sp5ye-2qaaa-aaaao-qkqla-cai',
    network: 'ic',
    canonicalRepo: 'iQube-Protocol/iQubeBeta-Program',
    canonicalPath: 'canisters/cross_chain_service/src/lib.rs',
    sourceCommitLastVerified: 'db6e562821c086acd530b5e9bdafaf575e775995',
    lastVerifiedAt: '2026-08-08',
    localIdlPath: 'services/ops/idl/cross_chain_service.ts',
    deployedModuleHash: '72a026cab892ac65690c2b001216dc844b7d4f9ed286da53977df1eae18ce16e',
    deploymentArtifactHashVerified: null,
    moduleHashVerifiedAgainstSource: null,
    observedCaveats: [
      'get_ready_messages() is UNREADABLE on the deployed canister: the ready set exceeds the IC 3 MiB query response cap (IC0504). A read failure here must never be reported as an empty set.',
      'Readiness is attestation_count >= 2 (REQUIRED_ATTESTATIONS). This is a state transition, not cryptographic verification.',
      'submit_attestation performs no validator authorization and no signature verification; supplied validator/signature values are appended verbatim.',
    ],
  },

  // Legacy Proof-of-State deployment. Historical state remains untouched.
  {
    name: 'proof_of_state',
    sourceLocationStatus: 'located',
    canisterId: 'n2hhv-aaaaa-aaaas-qccza-cai',
    network: 'ic',
    canonicalRepo: 'iQube-Protocol/iQubeBeta-Program',
    canonicalPath: 'canisters/proof_of_state/src/lib.rs',
    sourceCommitLastVerified: 'db6e562821c086acd530b5e9bdafaf575e775995',
    lastVerifiedAt: '2026-08-08',
    localIdlPath: 'services/ops/idl/proof_of_state.ts',
    deployedModuleHash: '97b83aa2d4af6b9c324a6a2120633db14704018f492fd6d5bf25f0cbee2c4b7b',
    deploymentArtifactHashVerified: null,
    moduleHashVerifiedAgainstSource: null,
    note: 'Legacy deployment retained for historical state only; it is not the CAP-1 activation target.',
    observedCaveats: [
      'The live batch root commits to receipt IDs, not data_hash/H: 20/20 sampled batches matched sha256(concat receipt_ids), 0/20 matched sha256(concat data_hashes).',
      'merkle_proof is empty on all sampled anchored receipts and the root is not a Merkle tree, so no per-leaf inclusion proof is constructible.',
      'All 76 historically anchored batches carry synthesised mock_btc_txid_* values; btc_block_height is hardcoded to 800000.',
      'issue_receipt is clock-id keyed rather than H-keyed, so retries are not idempotent.',
    ],
  },

  // CAP-1 Proof-of-State v2 deployment. New canister; no in-place legacy upgrade.
  {
    name: 'proof_of_state_v2',
    sourceLocationStatus: 'located',
    canisterId: 'cz7nu-zyaaa-aaaao-qqavq-cai',
    network: 'ic',
    canonicalRepo: 'iQube-Protocol/iQubeBeta-Program',
    canonicalPath: 'canisters/proof_of_state_v2/src/lib.rs',
    sourceCommitLastVerified: '7387fc1a1ecb58ffd7f81d15c9fe5b51d19b0d7c',
    lastVerifiedAt: '2026-08-08',
    localIdlPath: 'services/ops/idl/proof_of_state_v2.ts',
    deployedModuleHash: '23d24ddb1496aa4c5352c252259f2109e4d7712701c962e743ee953aa1b6b741',
    deploymentArtifactHashVerified: '23d24ddb1496aa4c5352c252259f2109e4d7712701c962e743ee953aa1b6b741',
    moduleHashVerifiedAgainstSource: null,
    note: 'CAP-1 deployment. Init config points to Constitutional Anchor v2, separates operator/reconciler principals, and requires one Bitcoin confirmation.',
    observedCaveats: [
      'A live three-H CAP-1 batch reproduced the normative domain-separated Merkle root a3e774cb030179e5257b4d8e929f4f09bb368848a9ee933a97b310d47db4e978 independently.',
      'Stored H1 and H3 inclusion proofs replay successfully; the odd third leaf records Promoted as required.',
      'Two request_anchor attempts failed before signing because the configured signer could not see a spendable UTXO through the stale IC Bitcoin Testnet view. Batch state correctly remained Unanchored.',
      'moduleHashVerifiedAgainstSource independent-rebuild claim NOT reproduced: rebuilding the pinned commit via dfx build (local and --network ic context) with rustc 1.94.1 (sandbox default) produced a078948d…, and with rustc 1.89.0 (the version pinned by this repo’s own CI, icp-ci.yml) produced a third, different hash — neither matches the deployed 23d24ddb…. iQubeBeta-Program has no rust-toolchain.toml pinning the exact compiler used for the original claimed rebuild, so that claim is not independently reproducible as recorded. deploymentArtifactHashVerified (live on-chain module_hash) was independently re-confirmed by live network query and stands.',
    ],
  },

  // Constitutional Anchor v2. This is the first genuine IC deployment of the signer.
  {
    name: 'btc_signer_psbt',
    sourceLocationStatus: 'located',
    canisterId: 'c66la-uaaaa-aaaao-qqava-cai',
    network: 'ic',
    canonicalRepo: 'iQube-Protocol/iQubeBeta-Program',
    canonicalPath: 'constitutional-anchor/btc_signer_psbt/src/lib.rs',
    sourceCommitLastVerified: '7387fc1a1ecb58ffd7f81d15c9fe5b51d19b0d7c',
    lastVerifiedAt: '2026-08-08',
    localIdlPath: 'services/ops/idl/btc_signer_psbt.ts',
    deployedModuleHash: 'e594d99531a9d211f018184627a3501ad46bdf514012313e3a62d0a937cf341a',
    deploymentArtifactHashVerified: 'e594d99531a9d211f018184627a3501ad46bdf514012313e3a62d0a937cf341a',
    moduleHashVerifiedAgainstSource: null,
    note: 'The earlier uxrrr-q7777-77774-qaaaq-cai value was a local dfx id and is retired from active truth. No IC-mainnet signer existed before this CAP-1 deployment.',
    observedCaveats: [
      'Live threshold public key derives Testnet4 P2WPKH address tb1qyyr0hdq7ck3wrtgup6cxy5egh5frvyft7p0qd6, independently reproduced off-canister.',
      'Funding tx ef1721b54e3348b594531d01f257b3562f9a95524277c1a20cff3f4198fa5097 paid 1,000,000 sats to vout 1 and is confirmed externally in Testnet4 block 147513.',
      'Signer failed closed with No UTXOs rather than fabricating a transaction because the IC Bitcoin Testnet canister remained at height 147508 while the external chain advanced to at least 147515. No anchor transaction was signed or broadcast.',
      'moduleHashVerifiedAgainstSource independent-rebuild claim NOT reproduced: this canister is type=custom (no dfx post-processing possible), so its build is fully attributable to cargo/rustc alone. rustc 1.94.1 reproducibly gave e93d5566… (3/3 attempts: bare cargo, dfx build local, dfx build --network ic); rustc 1.89.0 (this repo’s own CI pin, icp-ci.yml) gave a third, different hash 3dde1799…. Neither matches the deployed e594d995…, and constitutional-anchor/Cargo.toml already pins codegen-units=1 + lto=true so this is not codegen-unit nondeterminism — it is an unpinned-toolchain gap. deploymentArtifactHashVerified (live on-chain module_hash) was independently re-confirmed by live network query and stands.',
    ],
  },

  {
    name: 'evm_rpc',
    sourceLocationStatus: 'located',
    canisterId: '7hfb6-caaaa-aaaar-qadga-cai',
    network: 'ic',
    canonicalRepo: 'iQube-Protocol/iQubeBeta-Program',
    canonicalPath: 'canisters/evm_rpc',
    sourceCommitLastVerified: null,
    lastVerifiedAt: null,
    localIdlPath: 'services/ops/idl/evm_rpc.ts',
    deployedModuleHash: 'f61b3c2970548b611fcc9285eca94aace166e3c295cb98287c9e009a1075d392',
    deploymentArtifactHashVerified: null,
    moduleHashVerifiedAgainstSource: null,
    observedCaveats: ['Source located but not yet behaviourally audited.'],
  },

  {
    name: 'reward_hub',
    sourceLocationStatus: 'located',
    canisterId: 'local-only',
    network: 'local',
    canonicalRepo: 'iQube-Protocol/AigentZBeta',
    canonicalPath: 'src/reward_hub',
    sourceCommitLastVerified: null,
    lastVerifiedAt: '2026-08-08',
    localIdlPath: 'services/ops/idl/reward_hub.ts',
    deployedModuleHash: null,
    deploymentArtifactHashVerified: null,
    moduleHashVerifiedAgainstSource: null,
    observedCaveats: ['Declared in this repo dfx.json; AigentZBeta is the canonical owner.'],
  },
  {
    name: 'rqh',
    sourceLocationStatus: 'located',
    canisterId: 'local-only',
    network: 'local',
    canonicalRepo: 'iQube-Protocol/AigentZBeta',
    canonicalPath: 'src/rqh',
    sourceCommitLastVerified: null,
    lastVerifiedAt: '2026-08-08',
    localIdlPath: 'services/ops/idl/rqh.ts',
    deployedModuleHash: null,
    deploymentArtifactHashVerified: null,
    moduleHashVerifiedAgainstSource: null,
    observedCaveats: ['Declared in this repo dfx.json; AigentZBeta is the canonical owner.'],
  },

  ...(['dbc', 'escrow', 'fbc', 'evm_rpc_full', 'sol_rpc'] as const).map((name) => ({
    name,
    sourceLocationStatus: 'unlocated' as const,
    canisterId: 'unknown',
    network: 'ic' as const,
    canonicalRepo: null,
    canonicalPath: null,
    note:
      `Searched 2026-08-08: absent from iQube-Protocol/AigentZBeta's canister ownership and absent from ` +
      `iQube-Protocol/iQubeBeta-Program's known canister sources. The IDL is imported by platform code, ` +
      `so an implementation exists elsewhere or is externally operated. Do not infer behaviour from the IDL.`,
    sourceCommitLastVerified: null,
    lastVerifiedAt: null,
    localIdlPath: `services/ops/idl/${name}.ts`,
    deployedModuleHash: null,
    deploymentArtifactHashVerified: null,
    moduleHashVerifiedAgainstSource: null,
    observedCaveats: [],
  })),
];

/** The generation intended for eventual PoS/BTC activation. */
export const BITCOIN_PATH_CANISTERS = ['proof_of_state_v2', 'btc_signer_psbt'] as const;

/**
 * A4 provenance gate only. Empty means source/deployment provenance is closed;
 * it does NOT mean CAP-1 has passed or that PoS submission may be activated.
 */
export function activationProvenanceBlockers(): CanisterSourceEntry[] {
  return CANISTER_SOURCE_MANIFEST.filter(
    (e) =>
      (BITCOIN_PATH_CANISTERS as readonly string[]).includes(e.name) &&
      (
        e.sourceCommitLastVerified === null ||
        e.deployedModuleHash === null ||
        e.deploymentArtifactHashVerified === null ||
        e.moduleHashVerifiedAgainstSource === null ||
        e.deploymentArtifactHashVerified !== e.deployedModuleHash ||
        e.moduleHashVerifiedAgainstSource !== e.deployedModuleHash
      ),
  );
}

export function canisterSourceFor(canisterId: string): CanisterSourceEntry | undefined {
  return CANISTER_SOURCE_MANIFEST.find((e) => e.canisterId === canisterId);
}

export function unlocatedCanisters(): CanisterSourceEntry[] {
  return CANISTER_SOURCE_MANIFEST.filter((e) => e.sourceLocationStatus === 'unlocated');
}
