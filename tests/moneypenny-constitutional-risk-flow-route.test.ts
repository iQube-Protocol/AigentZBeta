/**
 * GET /api/moneypenny/constitutional-risk-flow — Use Case Zero build-order
 * item 10a. Proves the route layer: 401 when unauthenticated, 400 when
 * `requestRef` is missing/empty, persona-scoping (the resolved persona's
 * OWN personaId is passed through to the chain-projection service, never a
 * client-supplied one), and a happy-path 200 shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (...args: any[]) => mockGetActivePersona(...args),
}));

const mockGetConstitutionalRiskFlowState = vi.fn();
vi.mock('@/services/vela/velaUnderwritingChainProjection', () => ({
  getConstitutionalRiskFlowState: (...args: any[]) => mockGetConstitutionalRiskFlowState(...args),
}));

import { GET } from '@/app/api/moneypenny/constitutional-risk-flow/route';

function req(url: string) {
  return new NextRequest(`https://dev-beta.aigentz.me${url}`, { method: 'GET' });
}

const PERSONA_ID = 'persona-1';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/moneypenny/constitutional-risk-flow', () => {
  it('401 when unauthenticated', async () => {
    mockGetActivePersona.mockResolvedValue(null);
    const res = await GET(req('/api/moneypenny/constitutional-risk-flow?requestRef=req-1'));
    expect(res.status).toBe(401);
    expect(mockGetConstitutionalRiskFlowState).not.toHaveBeenCalled();
  });

  it('400 when requestRef is missing', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: PERSONA_ID });
    const res = await GET(req('/api/moneypenny/constitutional-risk-flow'));
    expect(res.status).toBe(400);
    expect(mockGetConstitutionalRiskFlowState).not.toHaveBeenCalled();
  });

  it('400 when requestRef is empty/whitespace', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: PERSONA_ID });
    const res = await GET(req('/api/moneypenny/constitutional-risk-flow?requestRef=%20%20'));
    expect(res.status).toBe(400);
    expect(mockGetConstitutionalRiskFlowState).not.toHaveBeenCalled();
  });

  it('passes the RESOLVED persona\'s own personaId — never a client-supplied one — and the requestRef verbatim', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: PERSONA_ID });
    mockGetConstitutionalRiskFlowState.mockResolvedValue({ requestRef: 'req-1', select: { state: 'not_started' } });
    const res = await GET(req('/api/moneypenny/constitutional-risk-flow?requestRef=req-1&personaId=someone-elses-persona'));
    expect(res.status).toBe(200);
    expect(mockGetConstitutionalRiskFlowState).toHaveBeenCalledWith({ personaId: PERSONA_ID, requestRef: 'req-1' });
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.state.requestRef).toBe('req-1');
  });
});
