/**
 * Projection T0-leakage CI gate (PRD v1.0 §5.2 / v1.1 §B.2 / §B.4).
 *
 * Property-based assertions that none of the 3 registry projections
 * ever leak T0 fields (personaId, authProfileId, rootDid,
 * kybeAttestation, cross-persona fioHandle) into their return shape.
 *
 * Strategy: generate internal records with T0 fields populated to
 * recognisable sentinel strings, project, then assert no sentinel
 * appears anywhere in the serialised projection.
 */

import { describe, expect, it } from 'vitest';

import { projectAdmin } from '@/services/registry/projections/admin';
import { projectCartridge } from '@/services/registry/projections/cartridge';
import { projectPublic } from '@/services/registry/projections/public';
import type { CanonicalIQubeInternalRecord } from '@/types/registry-canonical';

// ── Sentinels (T0 markers that must NEVER appear in any projection) ───────

const T0_SENTINELS = {
  personaId: 'T0-SENTINEL-PERSONA-ID-c7f9e1a2-must-not-leak',
  authProfileId: 'T0-SENTINEL-AUTH-PROFILE-ID-9d3b0e15-must-not-leak',
  rootDid: 'did:fio:T0-SENTINEL-ROOT-DID-must-not-leak',
  kybeAttestation: 'T0-SENTINEL-KYBE-ATTESTATION-must-not-leak',
  fioHandle: 'T0-SENTINEL-FIO-HANDLE@must-not-leak',
};

function makeInternalRecord(overrides: Partial<CanonicalIQubeInternalRecord> = {}): CanonicalIQubeInternalRecord {
  return {
    iqube_id: '00000000-0000-4000-8000-000000000001',
    primitive_type: 'ContentQube',
    instance_type: 'instance',

    meta_qube_id: 'meta-001',
    blak_qube_id: 'blak-001',
    token_qube_id: 'token-001',

    creator_persona_id: T0_SENTINELS.personaId,
    steward_persona_id: T0_SENTINELS.personaId,
    creator_identity_state: 'pseudonymous',
    creator_alias_commitment: 'T2-alias-commitment-public-safe-0xabc',
    origin: 'native',
    ingestion_intake_id: undefined,

    internal_lifecycle: 'canonized',
    surface_lifecycle: 'canonized',
    canonicalization_status: 'canonized',
    wip_supabase_only: false,
    visibility_state: 'public',

    gating: ['open'],

    mint_status: 'minted',
    chain_anchor: { chain_id: 8453, contract: '0xtest', token_id: '1', tx_hash: '0xtx' },

    instance_model: 'singleton',

    dvn_receipt_index: { receipt_count: 0 },
    cartridge_bindings: ['test-cartridge'],
    card_url: '/api/iqubes/00000000-0000-4000-8000-000000000001/card',

    version: '1.0',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function serialised(value: unknown): string {
  return JSON.stringify(value);
}

describe('registry-projections: admin projection', () => {
  it('redacts every T0 sentinel from a populated internal record', () => {
    const rec = makeInternalRecord({
      // Maximally hostile input: every T0 field carries its sentinel
      creator_persona_id: T0_SENTINELS.personaId,
      steward_persona_id: T0_SENTINELS.personaId,
    });
    const projected = projectAdmin(rec);
    const json = serialised(projected);

    for (const [name, sentinel] of Object.entries(T0_SENTINELS)) {
      expect(
        json.includes(sentinel),
        `Admin projection leaked T0 sentinel ${name}: ${sentinel}`,
      ).toBe(false);
    }
  });

  it('exposes creator.identity_state + creator.alias_commitment (T1/T2 only)', () => {
    const rec = makeInternalRecord();
    const projected = projectAdmin(rec);
    expect(projected.creator.identity_state).toBe('pseudonymous');
    expect(projected.creator.alias_commitment).toBe('T2-alias-commitment-public-safe-0xabc');
  });
});

describe('registry-projections: cartridge projection', () => {
  it('redacts every T0 sentinel', () => {
    const rec = makeInternalRecord();
    const projected = projectCartridge(rec, true, true);
    const json = serialised(projected);
    for (const [name, sentinel] of Object.entries(T0_SENTINELS)) {
      expect(
        json.includes(sentinel),
        `Cartridge projection leaked T0 sentinel ${name}: ${sentinel}`,
      ).toBe(false);
    }
  });

  it('does not include any T2 alias_commitment or T1 creator identity (cartridge view is iQube-shape only)', () => {
    const rec = makeInternalRecord();
    const projected = projectCartridge(rec);
    const json = serialised(projected);
    expect(json).not.toContain('T2-alias-commitment-public-safe-0xabc');
  });
});

describe('registry-projections: public projection', () => {
  it('redacts every T0 sentinel', () => {
    const rec = makeInternalRecord({ visibility_state: 'public' });
    const projected = projectPublic(rec);
    const json = serialised(projected);
    for (const [name, sentinel] of Object.entries(T0_SENTINELS)) {
      expect(
        json.includes(sentinel),
        `Public projection leaked T0 sentinel ${name}: ${sentinel}`,
      ).toBe(false);
    }
  });

  it('throws on private / wip records (fail loud, never leak)', () => {
    const rec = makeInternalRecord({ visibility_state: 'private' });
    expect(() => projectPublic(rec)).toThrow(/refusing to project visibility_state='private'/);
  });

  it('throws on unlisted records', () => {
    const rec = makeInternalRecord({ visibility_state: 'unlisted' });
    expect(() => projectPublic(rec)).toThrow();
  });

  it('does not include creator_alias_commitment (registry public view is T2-only for the iQube itself, not for persons)', () => {
    const rec = makeInternalRecord({ visibility_state: 'public' });
    const projected = projectPublic(rec);
    const json = serialised(projected);
    expect(json).not.toContain('T2-alias-commitment-public-safe-0xabc');
  });
});

describe('registry-projections: cross-projection invariants', () => {
  it('no projection ever serialises blak_qube_id (BlakQube REFERENCE rule, PRD §3)', () => {
    // blak_qube_id is internal-only. Projections don't expose the ref
    // string because callers requesting payload access go through
    // evaluateAccess → streamStateCPlaintext, never via the projection.
    const rec = makeInternalRecord({ blak_qube_id: 'BLAK-REF-SENTINEL-must-not-leak' });

    expect(serialised(projectAdmin(rec))).not.toContain('BLAK-REF-SENTINEL-must-not-leak');
    expect(serialised(projectCartridge(rec))).not.toContain('BLAK-REF-SENTINEL-must-not-leak');
    expect(serialised(projectPublic({ ...rec, visibility_state: 'public' }))).not.toContain(
      'BLAK-REF-SENTINEL-must-not-leak',
    );
  });

  it('no projection ever serialises secret_ref values from CanonicalToolBlock', () => {
    const rec = makeInternalRecord({
      primitive_type: 'ToolQube',
      tool: {
        tool_subtype: 'connector',
        wrapper_strategy: 'mcp',
        endpoint_url: 'https://test.example/mcp',
        transport: 'http',
        protocol: 'mcp',
        auth_scheme: 'api_key',
        secret_ref: 'SECRET-REF-SENTINEL-vault:test/key-must-not-leak',
      },
    });

    expect(serialised(projectAdmin(rec))).not.toContain('SECRET-REF-SENTINEL');
    expect(serialised(projectCartridge(rec))).not.toContain('SECRET-REF-SENTINEL');
    expect(serialised(projectPublic({ ...rec, visibility_state: 'public' }))).not.toContain(
      'SECRET-REF-SENTINEL',
    );
  });
});
