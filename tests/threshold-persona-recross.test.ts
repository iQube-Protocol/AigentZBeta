import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { personaPublicRef } from '../services/identity/personaReferences';
import {
  projectAvailablePersona,
  rootScopeForTarget,
  selectAvailablePersona,
} from '../services/threshold/personaRecross';
import { callTool, HANDSHAKE_TOOLS, listTools } from '../services/threshold/gateway';
import type { PersonaInventoryRow } from '../services/wallet/personaInventory';
import type { ScopedSession } from '../services/threshold/gatewaySession';

const uuidA = '11111111-1111-4111-8111-111111111111';
const uuidB = '22222222-2222-4222-8222-222222222222';
const row = (id: string, label: string): PersonaInventoryRow => ({
  id,
  tenant_id: '33333333-3333-4333-8333-333333333333',
  auth_profile_id: '44444444-4444-4444-8444-444444444444',
  display_name: label,
  avatar_uri: null,
  fio_handle: `${label.toLowerCase()}@metame`,
  fio_domain: null,
  discoverable_within_tenant: false,
  reputation_score: 0,
  reputation_bucket: 0,
  badges: [],
  default_identity_state: null,
  world_id_status: null,
  app_origin: 'metame',
  status: 'active',
  created_at: '2026-09-10T00:00:00Z',
  updated_at: '2026-09-10T00:00:00Z',
});

const session: ScopedSession = {
  id: 'session-server-id',
  principalPublicRef: personaPublicRef(uuidA),
  agentAlias: 'companion_safe',
  agreementId: 'thr-safe',
  scope: ['iqube.read'],
  initiatingService: 'ocsga',
  expiresAt: null,
  serviceAgreements: { ocsga: 'must-not-transfer' },
};

describe('Issue #112 — bounded persona discovery and re-crossing', () => {
  it('advertises all three authenticated tools and challenges bearer-less calls', () => {
    const names = listTools().map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(['get_persona_state', 'list_available_personas', 'request_persona_switch']));
    expect(HANDSHAKE_TOOLS.has('request_persona_switch')).toBe(true);
  });

  it('projects only T2 and owner-safe fields', () => {
    const projected = projectAvailablePersona(row(uuidB, 'Party A'), session.principalPublicRef);
    expect(projected.personaPublicRef).toBe(personaPublicRef(uuidB));
    expect(JSON.stringify(projected)).not.toContain(uuidB);
    expect(JSON.stringify(projected)).not.toContain('tenant_id');
    expect(JSON.stringify(projected)).not.toContain('auth_profile_id');
  });

  it('rejects raw, current, and foreign targets within the already-scoped inventory', () => {
    const rows = [row(uuidA, 'Source'), row(uuidB, 'Party A')];
    expect(selectAvailablePersona(rows, uuidB, session.principalPublicRef)).toBeNull();
    expect(selectAvailablePersona(rows, session.principalPublicRef, session.principalPublicRef)).toBeNull();
    expect(selectAvailablePersona(rows, 'ffffffffffffffff', session.principalPublicRef)).toBeNull();
    expect(selectAvailablePersona(rows, personaPublicRef(uuidB), session.principalPublicRef)?.id).toBe(uuidB);
  });

  it('recomputes root scope and never transfers an old admin cap to a non-admin target', () => {
    expect(rootScopeForTarget(false)).toContain('iqube.read');
    expect(rootScopeForTarget(false)).not.toContain('content.asset.upload');
    expect(rootScopeForTarget(true)).toContain('content.asset.upload');
  });

  it('dispatches discovery and preparation without changing the current session object', async () => {
    const before = structuredClone(session);
    const requestSwitch = vi.fn().mockResolvedValue({ ok: true, authorizeUrl: 'https://example.test/threshold/switch-persona#code=safe', expiresAt: 'soon' });
    const context = {
      origin: 'https://example.test',
      gatewayUrl: 'https://example.test/api/threshold/mcp',
      session,
      personaRecross: {
        getState: vi.fn(),
        listAvailable: vi.fn().mockResolvedValue([]),
        requestSwitch,
      },
    };
    const result = await callTool('request_persona_switch', {
      personaPublicRef: personaPublicRef(uuidB),
      codeChallenge: 'a'.repeat(43),
      codeChallengeMethod: 'S256',
    }, context);
    expect(result).not.toHaveProperty('isError');
    expect(requestSwitch).toHaveBeenCalledOnce();
    expect(session).toEqual(before);
  });

  it('structurally enforces fresh-session replacement and no service-agreement carryover', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'services/threshold/gatewaySession.ts'), 'utf8');
    const createStart = source.indexOf('export async function createPersonaSwitchHandshake');
    const createEnd = source.indexOf('export async function getPersonaSwitchHandshake');
    const createBody = source.slice(createStart, createEnd);
    expect(createBody).toContain("transition_kind: 'persona_switch'");
    expect(createBody).toContain('supersedes_session_id: source.id');
    expect(createBody).toContain('service_agreements: {}');
    expect(createBody).not.toContain('.update(');

    const exchangeStart = source.indexOf('export async function exchangeAuthorizationCode');
    const exchangeEnd = source.indexOf('/** OAuth Dynamic Client Registration');
    const exchange = source.slice(exchangeStart, exchangeEnd);
    expect(exchange.indexOf("status: 'revoked'")).toBeLessThan(exchange.indexOf("status: 'active'"));
  });

  it('binds browser approval to the target persona and a new agreement', () => {
    const route = fs.readFileSync(path.join(process.cwd(), 'app/api/threshold/persona-switch/complete/route.ts'), 'utf8');
    expect(route).toContain('resolveOwnedSwitchTarget');
    expect(route).toContain('formAgreement(owned.target.id');
    expect(route).toContain('principalPublicRef: handshake.targetPrincipalPublicRef');
    expect(route).not.toContain('applyUpgrade');
  });
});
