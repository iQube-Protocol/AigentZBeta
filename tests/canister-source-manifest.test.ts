/**
 * CROSS-REPO PROVENANCE CANARY (operator ruling, 2026-08-08).
 *
 * Enforces that every canister this repo talks to names where its
 * implementation actually lives, so a repository boundary can never again
 * become an epistemic boundary — the failure that let "cross_chain_service's
 * source is not in this repo" stand in for "its behaviour is unknowable",
 * while `attestation_count >= 2` with no signature verification and a batch
 * root over receipt IDs sat plainly readable in iQubeBeta-Program.
 *
 * The strongest assertion here is the one about `deployedModuleHash`: this
 * manifest may claim "this is the source repo" and must NOT be read as "the
 * live canister runs this source". Those are different claims and the second
 * has not been proven for any canister.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync } from 'fs';
import { join } from 'path';
import { CANISTER_SOURCE_MANIFEST, canisterSourceFor, unlocatedCanisters } from '@/services/ops/canisterSourceManifest';
import { readSource } from './_lib/sourceAuthority';

describe('canister source manifest', () => {
  it('covers every canister this repo holds an IDL for', () => {
    const idlFiles = readdirSync(join(process.cwd(), 'services', 'ops', 'idl'))
      .filter((f) => f.endsWith('.ts'))
      .map((f) => f.replace(/\.ts$/, ''));
    const manifested = new Set(CANISTER_SOURCE_MANIFEST.map((e) => e.name));
    const unmanifested = idlFiles.filter((n) => !manifested.has(n));
    expect(
      unmanifested,
      `These canisters have an IDL in this repo but no entry in canisterSourceManifest.ts, so an agent ` +
        `cannot discover where their implementation lives: ${unmanifested.join(', ')}. Add them rather ` +
        `than copying their source here.`,
    ).toEqual([]);
  });

  it('a located entry names a real repo and path; an unlocated one records where the search has been', () => {
    for (const e of CANISTER_SOURCE_MANIFEST) {
      if (e.sourceLocationStatus === 'located') {
        expect(e.canonicalRepo, `${e.name} is 'located' but names no repo`).toMatch(/^[\w.-]+\/[\w.-]+$/);
        expect((e.canonicalPath ?? '').length, `${e.name} is 'located' but names no path`).toBeGreaterThan(0);
      } else {
        // An unlocated entry must hand the next agent the search already done,
        // or the hunt restarts from zero every time — which is how the
        // cross_chain_service source stayed "unavailable" for hours.
        expect((e.note ?? '').length, `${e.name} is 'unlocated' but records no search note`).toBeGreaterThan(80);
      }
      expect(e.canisterId.length).toBeGreaterThan(0);
    }
  });

  /*
   * Unlocated canisters are a KNOWN, TRACKED gap — not a failure. This test
   * exists to keep them visible and to make the count deliberate: if it grows,
   * someone added an IDL without recording where its implementation lives.
   */
  it('keeps unlocated canisters visible rather than omitting them', () => {
    const names = unlocatedCanisters().map((e) => e.name).sort();
    expect(names).toEqual(['dbc', 'escrow', 'evm_rpc_full', 'fbc', 'sol_rpc']);
  });

  /*
   * The distinction the operator called out explicitly: naming a source repo is
   * weaker than proving the deployment runs it. A non-null hash here would be
   * asserting the stronger claim, and no such verification has been performed —
   * so a filled-in value can only be a guess, which is worse than a gap.
   */
  it('does not claim deployment provenance it has not verified', () => {
    for (const e of CANISTER_SOURCE_MANIFEST) {
      if (e.deployedModuleHash !== null) {
        expect(
          e.deployedModuleHash,
          `${e.name} claims a deployed module hash. That is the strong claim "the live canister runs ` +
            `this exact source" and requires a real module-hash comparison. If one was performed, keep ` +
            `it and record how; if not, this must be null.`,
        ).toMatch(/^[0-9a-f]{64}$/);
      }
    }
  });

  it('records the observed caveats that a source reading alone would miss', () => {
    // Every canister we have live evidence about must carry it here, so the
    // next reader meets the observation before forming a belief from source.
    for (const name of ['cross_chain_service', 'proof_of_state', 'btc_signer_psbt']) {
      const entry = CANISTER_SOURCE_MANIFEST.find((e) => e.name === name)!;
      expect(entry, `${name} missing from manifest`).toBeDefined();
      expect(entry.observedCaveats.length, `${name} records no observed caveats`).toBeGreaterThan(0);
    }
  });

  it('is reachable by canister id — the form an investigation actually starts from', () => {
    // An agent debugging a live call has a principal, not a name.
    expect(canisterSourceFor('sp5ye-2qaaa-aaaao-qkqla-cai')?.name).toBe('cross_chain_service');
    expect(canisterSourceFor('n2hhv-aaaaa-aaaas-qccza-cai')?.name).toBe('proof_of_state');
    expect(canisterSourceFor('not-a-canister')).toBeUndefined();
  });

  it('AGENTS.md carries the rule the manifest exists to serve', () => {
    const agents = readSource('AGENTS.md');
    expect(agents).toContain('Repository boundaries are not epistemic boundaries');
    expect(agents).toContain('canisterSourceManifest.ts');
    // The two ownership halves must both be named, or the boundary reads as an
    // accident rather than a decision.
    expect(agents).toContain('iQubeBeta-Program');
    expect(agents).toContain('Canonical canister implementation');
  });
});
