/**
 * POST /api/journey/moneypenny-horizen/register/{mandate/prepare,
 * mandate/approve, invocation/approve} — the Register ceremony's own routes
 * (Wallet Signing Topology, operator ruling 2026-08-01), replacing the
 * retired register/prepare + register/broadcast direct-signing path. Every
 * real dependency mocked; exercises the route handlers directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

import { readSource, stripComments } from './_lib/sourceAuthority';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

vi.mock('@/app/api/agents/_lib/requestOrigin', () => ({
  resolveRequestOrigin: () => 'https://dev-beta.aigentz.me',
}));

const mockPrepareMandate = vi.fn();
const mockApproveMandate = vi.fn();
const mockApproveInvocation = vi.fn();
vi.mock('@/services/horizen/registerCeremony', () => ({
  prepareRegistrationMandate: (...args: any[]) => mockPrepareMandate(...args),
  approvePrincipalRegistrationMandate: (...args: any[]) => mockApproveMandate(...args),
  approveAgentRegistryInvocation: (...args: any[]) => mockApproveInvocation(...args),
}));

import { POST as prepareMandateRoute } from '@/app/api/journey/moneypenny-horizen/register/mandate/prepare/route';
import { POST as approveMandateRoute } from '@/app/api/journey/moneypenny-horizen/register/mandate/approve/route';
import { POST as approveInvocationRoute } from '@/app/api/journey/moneypenny-horizen/register/invocation/approve/route';

function makeRequest(body?: unknown): NextRequest {
  return { json: async () => body ?? {} } as unknown as NextRequest;
}

beforeEach(() => {
  mockGetActivePersona.mockReset();
  mockPrepareMandate.mockReset();
  mockApproveMandate.mockReset();
  mockApproveInvocation.mockReset();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-operator-1' });
});

describe('POST register/mandate/prepare', () => {
  it('401s when unauthenticated', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await prepareMandateRoute(makeRequest({ agentSlug: 'nakamoto' }));
    expect(res.status).toBe(401);
    expect(mockPrepareMandate).not.toHaveBeenCalled();
  });

  it('400s when agentSlug is missing', async () => {
    const res = await prepareMandateRoute(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('resolves the caller as the principalPersonaId — never a client-supplied one', async () => {
    mockPrepareMandate.mockResolvedValue({ ok: true, value: { id: 'sr_1', status: 'pending' } });
    await prepareMandateRoute(makeRequest({ agentSlug: 'nakamoto', principalPersonaId: 'someone-else' }));
    expect(mockPrepareMandate.mock.calls[0][0]).toMatchObject({ agentSlug: 'nakamoto', principalPersonaId: 'persona-operator-1' });
  });

  it('passes through a refusal verbatim', async () => {
    mockPrepareMandate.mockResolvedValue({ ok: false, refusalCode: 'NO_PRINCIPAL_WALLET', detail: 'no wallet on file' });
    const res = await prepareMandateRoute(makeRequest({ agentSlug: 'nakamoto' }));
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.refusalCode).toBe('NO_PRINCIPAL_WALLET');
  });
});

describe('POST register/mandate/approve', () => {
  it('401s when unauthenticated', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await approveMandateRoute(makeRequest({ requestId: 'sr_1', signature: '0xsig' }));
    expect(res.status).toBe(401);
  });

  it('400s when requestId or signature is missing', async () => {
    const res = await approveMandateRoute(makeRequest({ requestId: 'sr_1' }));
    expect(res.status).toBe(400);
    expect(mockApproveMandate).not.toHaveBeenCalled();
  });

  it('resolves the caller as principalPersonaId and returns both the mandate and the follow-on agent invocation request', async () => {
    mockApproveMandate.mockResolvedValue({
      ok: true,
      value: {
        mandateRequest: { id: 'sr_1', status: 'approved' },
        agentInvocationRequest: { id: 'sr_2', status: 'pending', walletRef: 'aigent-nakamoto' },
      },
    });
    const res = await approveMandateRoute(makeRequest({ requestId: 'sr_1', signature: '0xsig' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.mandateRequest.status).toBe('approved');
    expect(json.agentInvocationRequest.walletRef).toBe('aigent-nakamoto');
    expect(mockApproveMandate.mock.calls[0][0]).toMatchObject({ requestId: 'sr_1', principalPersonaId: 'persona-operator-1', signature: '0xsig' });
  });

  it('passes through SIGNER_MISMATCH verbatim — never treats a bad signature as success', async () => {
    mockApproveMandate.mockResolvedValue({ ok: false, refusalCode: 'SIGNER_MISMATCH', detail: 'wrong signer' });
    const res = await approveMandateRoute(makeRequest({ requestId: 'sr_1', signature: '0xbad' }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.refusalCode).toBe('SIGNER_MISMATCH');
  });
});

describe('POST register/invocation/approve', () => {
  it('401s when unauthenticated', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await approveInvocationRoute(makeRequest({ requestId: 'sr_2' }));
    expect(res.status).toBe(401);
  });

  it('400s when requestId is missing', async () => {
    const res = await approveInvocationRoute(makeRequest({}));
    expect(res.status).toBe(400);
    expect(mockApproveInvocation).not.toHaveBeenCalled();
  });

  it('returns the broadcast outcome on success', async () => {
    mockApproveInvocation.mockResolvedValue({
      ok: true,
      value: { request: { id: 'sr_2', status: 'executed' }, txHash: '0xdeadbeef', ownerWalletAddress: '0xOwner', network: 'base-sepolia' },
    });
    const res = await approveInvocationRoute(makeRequest({ requestId: 'sr_2' }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.txHash).toBe('0xdeadbeef');
    expect(json.ownerWalletAddress).toBe('0xOwner');
  });

  it('never accepts a raw private key or signature in the request body — this action has no such field', async () => {
    // Passing extraneous fields must have no effect; the route only reads requestId.
    mockApproveInvocation.mockResolvedValue({ ok: true, value: { request: {}, txHash: '0x1', ownerWalletAddress: '0x2', network: 'base-sepolia' } });
    await approveInvocationRoute(makeRequest({ requestId: 'sr_2', privateKey: '0xshouldbeignored' }));
    expect(mockApproveInvocation.mock.calls[0][0]).toEqual({ requestId: 'sr_2' });
  });

  it('passes through BROADCAST_FAILED verbatim', async () => {
    mockApproveInvocation.mockResolvedValue({ ok: false, refusalCode: 'BROADCAST_FAILED', detail: 'no custodied wallet' });
    const res = await approveInvocationRoute(makeRequest({ requestId: 'sr_2' }));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.refusalCode).toBe('BROADCAST_FAILED');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// The NO_PRINCIPAL_WALLET refusal names WHICH lookup is empty
// ─────────────────────────────────────────────────────────────────────────

describe('NO_PRINCIPAL_WALLET — the refusal stands, but says what to fix', () => {
  const RESOLVER = 'services/identity/personaAddressResolver.ts';
  const CEREMONY = 'services/horizen/registerCeremony.ts';

  it('still refuses rather than fabricating a mandate signature', () => {
    const src = readSource(CEREMONY);
    expect(src).toContain('Never fabricating a mandate signature');
    expect(src).toContain("refusalCode: 'NO_PRINCIPAL_WALLET'");
  });

  it('distinguishes the three genuinely different causes, plus store-unavailable', () => {
    const src = readSource(RESOLVER);
    for (const reason of ['needs-backfill', 'no-key-material', 'malformed-address', 'store-unavailable']) {
      expect(src, `"${reason}" must be a distinguishable outcome`).toContain(reason);
    }
  });

  it('a backfill gap points at the sync route, not at creating a wallet that already exists', () => {
    const src = readSource(RESOLVER);
    expect(src).toContain('/api/admin/identity/sync-persona-evm-addresses');
  });

  it('absent key material says a wallet must be CREATED — no backfill can invent one', () => {
    const src = readSource(RESOLVER);
    expect(src).toMatch(/no EVM wallet key material at all/);
    expect(src).toMatch(/Create a metaMe wallet/);
  });

  it('a store outage is UNKNOWN, never rendered as "you have no wallet"', () => {
    const src = readSource(RESOLVER);
    const at = src.indexOf("reason: 'store-unavailable'");
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + 400)).toMatch(/unknown rather than absent/);
  });

  it('the diagnosis only enriches — it can never change or suppress the refusal', () => {
    const src = stripComments(readSource(CEREMONY));
    const at = src.indexOf("refusalCode: 'NO_PRINCIPAL_WALLET'");
    expect(at).toBeGreaterThan(-1);
    // The enrichment is wrapped so its failure cannot alter the outcome.
    const block = src.slice(src.indexOf('let detail ='), at);
    expect(block).toContain('try {');
    expect(block).toContain('} catch {');
  });
});
