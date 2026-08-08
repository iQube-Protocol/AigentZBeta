/**
 * CANISTER SOURCE MANIFEST — where the code behind each deployed canister
 * actually lives (operator ruling, 2026-08-08).
 *
 * ── THE FAILURE THIS PREVENTS ──────────────────────────────────────────────
 *
 * On 2026-08-08 an investigation concluded that `cross_chain_service`'s source
 * was "not in this repo" and therefore unavailable — and stopped there. It was
 * available: it lives in `iQube-Protocol/iQubeBeta-Program`, whose `dfx.json`
 * owns both `cross_chain_service` and `proof_of_state`. Because the source was
 * treated as unreachable, two facts went unverified for hours and were nearly
 * accepted as unknowable:
 *
 *   - the DVN readiness rule is literally `attestation_count >= 2`, and
 *     `submit_attestation` performs NO validator authorization and NO
 *     signature verification — it appends whatever it is handed;
 *   - `proof_of_state` builds its batch root from receipt IDs (not
 *     `data_hash`), leaves `merkle_proof` empty, and synthesises its
 *     `btc_anchor_txid` on both the success and error branches.
 *
 * A repository boundary became an epistemic boundary. This manifest exists so
 * that cannot happen silently again: every deployed canister names its
 * canonical repo and path, so "I searched this repo" is never the end of the
 * enquiry.
 *
 * ── WHAT THIS MANIFEST DOES *NOT* CLAIM ────────────────────────────────────
 *
 * Naming a source repo is the claim "this is where the code is maintained".
 * It is emphatically NOT the stronger claim "the live canister is running
 * exactly this source". Nothing here verifies deployment provenance, and the
 * distinction matters precisely because the checked-in code contains mock
 * Bitcoin behaviour: until a deployed module hash is compared against a build
 * of `sourceCommit`, an observation of the live canister always outranks a
 * reading of the source. `deployedModuleHash` is therefore OPTIONAL and
 * currently unset everywhere — an honest null, not a placeholder to be filled
 * with something plausible.
 */

export interface CanisterSourceEntry {
  /** The canister's name in its canonical repo's dfx.json. */
  name: string;
  /** Deployed canister principal. */
  canisterId: string;
  network: 'ic' | 'local';
  /**
   * owner/repo that MAINTAINS this canister's implementation, or `null` when
   * the source has NOT been located. Null is a tracked, visible gap — never a
   * reason to omit the canister from this manifest, which would hide it.
   */
  canonicalRepo: string | null;
  /** Path within `canonicalRepo`, or null when unlocated. */
  canonicalPath: string | null;
  /**
   * `located`   — source found and read.
   * `unlocated` — an IDL exists and is USED, but no implementation has been
   *               found in any known repo. `note` must say what was searched,
   *               so the next agent resumes the hunt instead of restarting it.
   */
  sourceLocationStatus: 'located' | 'unlocated';
  /** Required when unlocated: where the search has already been.  */
  note?: string;
  /**
   * The commit of `canonicalRepo` whose source was last READ and compared
   * against observed canister behaviour. Not a deployment claim — see header.
   */
  sourceCommitLastVerified: string | null;
  /** ISO date of that verification. */
  lastVerifiedAt: string | null;
  /** This repo's local IDL binding — the adapter surface AigentZBeta owns. */
  localIdlPath: string;
  /**
   * sha256 of the deployed WASM module, when it has been obtained. NULL means
   * "we have not proven the deployed code matches the source", which is the
   * current, honest state for every entry. Never fill this speculatively.
   */
  deployedModuleHash: string | null;
  /**
   * Behaviours OBSERVED on the deployed canister that a reader must not
   * assume away. Recorded here because they are the difference between "the
   * source looks fine" and "the live system does what it claims".
   */
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
    deployedModuleHash: null,
    observedCaveats: [
      'get_ready_messages() is UNREADABLE on the deployed canister: the ready set exceeds the IC 3 MiB query response cap (IC0504). A read failure here must never be reported as an empty set.',
      'Readiness is attestation_count >= 2 (REQUIRED_ATTESTATIONS). This is a STATE TRANSITION, not verification.',
      'submit_attestation performs no validator authorization and no signature verification — it appends the supplied validator/signature verbatim. Fabricated attestations therefore promote messages to ready.',
    ],
  },
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
    deployedModuleHash: null,
    observedCaveats: [
      'The batch root commits to RECEIPT IDS, not data_hash. Proven live: 20/20 sampled batches satisfy root == sha256(concat receipt_ids); 0/20 satisfy root == sha256(concat data_hashes).',
      'merkle_proof is empty on all 186 receipts in anchored batches, and the root is a single sequential SHA256 over concatenated ids — not a Merkle tree, so no per-leaf inclusion proof is constructible.',
      'btc_anchor_txid is synthesised ("mock_btc_txid_<root[..8]>") on ALL 76 anchored batches; anchor() discards the BTC signer response on both the Ok and Err branches.',
      'btc_block_height is the hardcoded constant 800000 on every batch.',
      'issue_receipt(data_hash) derives its id from the clock and never deduplicates by data_hash — repeat calls create duplicate receipts, so retries are NOT idempotent.',
    ],
  },
  {
    name: 'btc_signer_psbt',
    sourceLocationStatus: 'located',
    canisterId: 'uxrrr-q7777-77774-qaaaq-cai',
    network: 'ic',
    canonicalRepo: 'iQube-Protocol/iQubeBeta-Program',
    canonicalPath: 'canisters/btc_signer_psbt/src/lib.rs',
    sourceCommitLastVerified: 'db6e562821c086acd530b5e9bdafaf575e775995',
    lastVerifiedAt: '2026-08-08',
    localIdlPath: '(none — reached only via proof_of_state.anchor())',
    deployedModuleHash: null,
    observedCaveats: [
      'create_anchor_transaction computes _op_return_script and DISCARDS it (underscore-prefixed, never used). The data hash is never encoded into transaction bytes.',
      'Outputs carry the literal strings "OP_RETURN" and "change_address" in their address field; no Bitcoin transaction is ever serialised.',
      'sign_transaction sets txid = first 32 bytes of the SIGNATURE, not the double-SHA256 of a serialised transaction, and raw_tx = the string "signed_tx_<hex>".',
      'get_btc_address returns "tb1q" + hex of the first 20 pubkey bytes — not bech32 (no checksum, no 5-bit encoding, not a hash of the pubkey).',
      'create_and_broadcast_anchor uses a mock UTXO with an all-zero txid.',
    ],
  },
  // ── Canonical in iQubeBeta-Program, not yet behaviourally audited ────────
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
    deployedModuleHash: null,
    observedCaveats: ['Source located but NOT yet read or behaviourally audited — no caveats recorded either way.'],
  },
  // ── Canonical in THIS repo (AigentZBeta owns these outright) ─────────────
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
    observedCaveats: ['Declared in THIS repo\'s dfx.json — AigentZBeta is the canonical owner, unlike the ICP substrate canisters above.'],
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
    observedCaveats: ['Declared in THIS repo\'s dfx.json — AigentZBeta is the canonical owner.'],
  },
  /*
   * ── UNLOCATED ───────────────────────────────────────────────────────────
   * Each of these has an IDL in this repo that PRODUCTION CODE CALLS, and no
   * implementation found in either known repo. They are recorded rather than
   * omitted precisely because omission is what let cross_chain_service pass
   * for "unavailable". A visible gap can be closed; an invisible one cannot.
   */
  ...(['dbc', 'escrow', 'fbc', 'evm_rpc_full', 'sol_rpc'] as const).map((name) => ({
    name,
    sourceLocationStatus: 'unlocated' as const,
    canisterId: 'unknown',
    network: 'ic' as const,
    canonicalRepo: null,
    canonicalPath: null,
    note:
      `Searched 2026-08-08: absent from iQube-Protocol/AigentZBeta (dfx.json declares only rqh + reward_hub; ` +
      `src/ holds proof_of_state as THREE ZERO-BYTE FILES — a hollow shell that reads as local source and is ` +
      `not) and absent from iQube-Protocol/iQubeBeta-Program (dfx.json declares cross_chain_service, evm_rpc, ` +
      `btc_signer_psbt, proof_of_state, solana_signer_ed25519, reputation_qube). No canister id found in ` +
      `.env.example. The IDL is nonetheless imported by live routes, so an implementation exists somewhere — ` +
      `likely a third repo or an externally-operated canister. Ask the operator before assuming behaviour.`,
    sourceCommitLastVerified: null,
    lastVerifiedAt: null,
    localIdlPath: `services/ops/idl/${name}.ts`,
    deployedModuleHash: null,
    observedCaveats: [],
  })),
];

export function canisterSourceFor(canisterId: string): CanisterSourceEntry | undefined {
  return CANISTER_SOURCE_MANIFEST.find((e) => e.canisterId === canisterId);
}

/** Canisters whose implementation has not been found — the open provenance gaps. */
export function unlocatedCanisters(): CanisterSourceEntry[] {
  return CANISTER_SOURCE_MANIFEST.filter((e) => e.sourceLocationStatus === 'unlocated');
}
