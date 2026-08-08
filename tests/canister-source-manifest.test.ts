/**
 * CROSS-REPO PROVENANCE CANARY (operator ruling, 2026-08-08).
 *
 * Every canister adapter must identify its canonical source location and keep
 * deployment observation separate from reproducible-source provenance.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync } from 'fs';
import { join } from 'path';
import {
  CANISTER_SOURCE_MANIFEST,
  activationProvenanceBlockers,
  canisterSourceFor,
  unlocatedCanisters,
} from '@/services/ops/canisterSourceManifest';
import { readSource } from './_lib/sourceAuthority';

describe('canister source manifest', () => {
  it('covers every canister this repo holds a TypeScript IDL for', () => {
    const idlFiles = readdirSync(join(process.cwd(), 'services', 'ops', 'idl'))
      .filter((file) => file.endsWith('.ts'))
      .map((file) => file.replace(/\.ts$/, ''));
    const manifested = new Set(CANISTER_SOURCE_MANIFEST.map((entry) => entry.name));
    expect(idlFiles.filter((name) => !manifested.has(name))).toEqual([]);
  });

  it('requires a real source location or an explicit search trail', () => {
    for (const entry of CANISTER_SOURCE_MANIFEST) {
      if (entry.sourceLocationStatus === 'located') {
        expect(entry.canonicalRepo, `${entry.name} has no canonical repo`).toMatch(/^[\w.-]+\/[\w.-]+$/);
        expect((entry.canonicalPath ?? '').length, `${entry.name} has no canonical path`).toBeGreaterThan(0);
      } else {
        expect((entry.note ?? '').length, `${entry.name} has no search trail`).toBeGreaterThan(80);
      }
      expect(entry.canisterId.length).toBeGreaterThan(0);
    }
  });

  it('keeps the known unlocated set visible', () => {
    expect(unlocatedCanisters().map((entry) => entry.name).sort()).toEqual([
      'dbc',
      'escrow',
      'evm_rpc_full',
      'fbc',
      'sol_rpc',
    ]);
  });

  it('treats deployed hashes as observations and source matches as a separate stronger claim', () => {
    for (const entry of CANISTER_SOURCE_MANIFEST) {
      for (const [label, value] of [
        ['deployedModuleHash', entry.deployedModuleHash],
        ['deploymentArtifactHashVerified', entry.deploymentArtifactHashVerified],
        ['moduleHashVerifiedAgainstSource', entry.moduleHashVerifiedAgainstSource],
      ] as const) {
        if (value !== null) {
          expect(value, `${entry.name}.${label} is not a sha256`).toMatch(/^[0-9a-f]{64}$/);
        }
      }

      if (entry.deploymentArtifactHashVerified !== null) {
        expect(entry.deploymentArtifactHashVerified).toBe(entry.deployedModuleHash);
      }
      if (entry.moduleHashVerifiedAgainstSource !== null) {
        expect(entry.moduleHashVerifiedAgainstSource).toBe(entry.deployedModuleHash);
      }
    }
  });

  it('records both legacy failure evidence and the new CAP-1 live observations', () => {
    for (const name of ['cross_chain_service', 'proof_of_state', 'proof_of_state_v2', 'btc_signer_psbt']) {
      const entry = CANISTER_SOURCE_MANIFEST.find((candidate) => candidate.name === name);
      expect(entry, `${name} missing from manifest`).toBeDefined();
      expect(entry!.observedCaveats.length, `${name} records no observed caveats`).toBeGreaterThan(0);
    }
  });

  it('resolves both legacy and CAP-1 canisters by principal', () => {
    expect(canisterSourceFor('sp5ye-2qaaa-aaaao-qkqla-cai')?.name).toBe('cross_chain_service');
    expect(canisterSourceFor('n2hhv-aaaaa-aaaas-qccza-cai')?.name).toBe('proof_of_state');
    expect(canisterSourceFor('cz7nu-zyaaa-aaaao-qqavq-cai')?.name).toBe('proof_of_state_v2');
    expect(canisterSourceFor('c66la-uaaaa-aaaao-qqava-cai')?.name).toBe('btc_signer_psbt');
    expect(canisterSourceFor('not-a-canister')).toBeUndefined();
  });

  it('AGENTS.md carries the cross-repo ownership rule', () => {
    const agents = readSource('AGENTS.md');
    expect(agents).toContain('Repository boundaries are not epistemic boundaries');
    expect(agents).toContain('canisterSourceManifest.ts');
    expect(agents).toContain('iQubeBeta-Program');
    expect(agents).toContain('Canonical canister implementation');
  });
});

describe('activation gate — provenance (A4)', () => {
  it('is closed for the new CAP-1 Bitcoin-path deployment', () => {
    expect(activationProvenanceBlockers()).toEqual([]);
  });

  it('does not confuse A4 being green with CAP-1 being complete', () => {
    const pos = CANISTER_SOURCE_MANIFEST.find((entry) => entry.name === 'proof_of_state_v2')!;
    const signer = CANISTER_SOURCE_MANIFEST.find((entry) => entry.name === 'btc_signer_psbt')!;
    expect(pos.note).toContain('CAP-1');
    expect(signer.observedCaveats.join(' ')).toContain('No anchor transaction was signed or broadcast');
  });
});
