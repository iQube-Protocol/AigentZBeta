import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getActivePersonaByPublicRef: vi.fn(),
  getAgreement: vi.fn(),
  listIQubes: vi.fn(),
  resolveIQube: vi.fn(),
  getSupabaseServer: vi.fn(),
}));

vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersonaByPublicRef: mocks.getActivePersonaByPublicRef,
}));
vi.mock('@/services/constitutional/constitutionalAgreement', () => ({
  agreementOwnerCommitment: (personaId: string) => `owner:${personaId}`,
  getAgreement: mocks.getAgreement,
}));
vi.mock('@/services/registry/resolver', () => ({
  listIQubes: mocks.listIQubes,
  resolveIQube: mocks.resolveIQube,
}));
vi.mock('@/app/api/_lib/supabaseServer', () => ({
  getSupabaseServer: mocks.getSupabaseServer,
}));

import {
  getAccessibleIQube,
  listAccessibleIQubes,
  resolvePersonaIQubeAuthority,
} from '@/services/threshold/personaIQubeProjection';
import { callTool, listTools, type GatewayContext } from '@/services/threshold/gateway';
import type { ActivePersonaContext } from '@/types/access';
import type { ScopedSession } from '@/services/threshold/gatewaySession';

const ARK_PERSONA: ActivePersonaContext = {
  personaId: 'persona-ark',
  authProfileId: 'same-human',
  identifiability: 'semi_anonymous',
  cartridgeFlags: { isAdmin: false, isPartner: false, adminCartridges: [] },
  cohortMemberships: [],
  source: 'api-key',
};
const AIGENT_Z_PERSONA: ActivePersonaContext = {
  ...ARK_PERSONA,
  personaId: 'persona-aigent-z',
};

function session(principalPublicRef: string, overrides: Partial<ScopedSession> = {}): ScopedSession {
  return {
    id: `session-${principalPublicRef}`,
    principalPublicRef,
    agentAlias: 'companion-bound',
    agreementId: `agreement-${principalPublicRef}`,
    scope: ['iqube.read'],
    initiatingService: 'polity-passport',
    expiresAt: null,
    serviceAgreements: {},
    ...overrides,
  };
}

function agreementFor(personaId: string, selectedAgentRef = 'companion-bound') {
  return {
    status: 'authorized',
    selectedAgentRef,
    object: {
      ownership: { ownerCommitment: `owner:${personaId}` },
      payload: { delegatedAuthority: { allowedActions: ['iqube.read'] } },
    },
  };
}

describe('Threshold persona-scoped iQube projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listIQubes.mockResolvedValue({
      entries: [
        { iqube_id: 'iqube-shared' },
        { iqube_id: 'iqube-ark-only' },
        { iqube_id: 'iqube-aigent-z-only' },
      ],
    });
    mocks.getActivePersonaByPublicRef.mockImplementation(async (ref: string) =>
      ref === 'ark-public-ref' ? ARK_PERSONA : ref === 'aigentz-public-ref' ? AIGENT_Z_PERSONA : null,
    );
    mocks.getAgreement.mockImplementation(async (id: string) =>
      id.includes('ark-public-ref') ? agreementFor('persona-ark') : agreementFor('persona-aigent-z'),
    );
    mocks.resolveIQube.mockImplementation(async (id: string, opts: { persona?: ActivePersonaContext }) => ({
      iqube_id: id,
      primitive_type: 'ContentQube',
      display_name: id,
      surface_lifecycle: 'canonized',
      mint_status: 'minted',
      visibility_state: 'public_meta_private_payload',
      gating: ['persona'],
      caller_owns:
        id === 'iqube-shared' ||
        id === `iqube-${opts.persona?.personaId === 'persona-ark' ? 'ark' : 'aigent-z'}-only`,
      caller_can_read:
        id === 'iqube-shared' ||
        id === `iqube-${opts.persona?.personaId === 'persona-ark' ? 'ark' : 'aigent-z'}-only`,
      cartridge_bindings: ['test'],
    }));
  });

  it('keeps two personas owned by the same human isolated', async () => {
    const ark = await listAccessibleIQubes(session('ark-public-ref'));
    const aigentZ = await listAccessibleIQubes(session('aigentz-public-ref'));
    expect(ark.ok && ark.entries.map((x) => x.iqube_id)).toEqual(['iqube-shared', 'iqube-ark-only']);
    expect(aigentZ.ok && aigentZ.entries.map((x) => x.iqube_id)).toEqual(['iqube-shared', 'iqube-aigent-z-only']);
    expect(JSON.stringify({ ark, aigentZ })).not.toContain('same-human');
    expect(JSON.stringify({ ark, aigentZ })).not.toContain('persona-ark');
    expect(JSON.stringify({ ark, aigentZ })).not.toContain('persona-aigent-z');
  });

  it('uses an explicit Registry scan cursor for catalogues larger than one batch', async () => {
    const result = await listAccessibleIQubes(session('ark-public-ref'), { scanOffset: 500 });
    expect(result.ok).toBe(true);
    expect(mocks.listIQubes).toHaveBeenCalledWith({ limit: 500, offset: 500 });
    expect(result).toMatchObject({ scanOffset: 500, scanComplete: true, nextScanOffset: null });
  });

  it('fails closed when scope, persona binding, or exact agent binding is absent', async () => {
    expect((await resolvePersonaIQubeAuthority(session('ark-public-ref', { scope: [] }))).ok).toBe(false);
    expect((await resolvePersonaIQubeAuthority(session('unknown-ref'))).ok).toBe(false);
    mocks.getAgreement.mockResolvedValueOnce(agreementFor('persona-ark', 'different-agent'));
    expect((await resolvePersonaIQubeAuthority(session('ark-public-ref'))).ok).toBe(false);
    expect(mocks.listIQubes).not.toHaveBeenCalled();
  });

  it('does not distinguish a missing iQube from another persona\'s iQube', async () => {
    const result = await getAccessibleIQube(session('ark-public-ref'), 'iqube-aigent-z-only');
    expect(result).toEqual({ ok: false, error: 'iQube not found or not authorized for this persona.' });
  });

  it('advertises and dispatches the global tools through the injected adapter', async () => {
    expect(listTools().map((t) => t.name)).toEqual(expect.arrayContaining([
      'list_accessible_iqubes',
      'get_accessible_iqube',
      'read_accessible_iqube_text',
    ]));
    const list = vi.fn().mockResolvedValue({ ok: true, entries: [], totalAccessible: 0 });
    const ctx: GatewayContext = {
      origin: 'https://example.test',
      gatewayUrl: 'https://example.test/api/threshold/mcp',
      session: session('ark-public-ref'),
      iqubeProjection: {
        list,
        get: vi.fn(),
        readText: vi.fn(),
      },
    };
    const result = await callTool('list_accessible_iqubes', { limit: 10 }, ctx);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
    expect(result).not.toHaveProperty('isError');
  });
});
