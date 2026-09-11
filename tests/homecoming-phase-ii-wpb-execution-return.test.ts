/**
 * Homecoming Phase II WP-B — Execution Return, the cybernetic return path.
 *
 * The Implementation Pack sends bounded intent OUTWARD; Execution Return
 * brings evidence of what executed back IN. These tests pin: a valid
 * pack-linked return is accepted; an unknown/missing packId fails closed;
 * malformed/incomplete evidence never advances the stage; valid evidence
 * DOES make the stage eligible to advance; a duplicate/replayed return is
 * handled deterministically (no second receipt, same evidence returned);
 * pre-existing implementation-pack generation is unchanged; the Execution
 * Return path never becomes a new authority mechanism (no
 * `deployment_authorized`, actor identity preserved verbatim, never
 * attributed to "DevOn"); and the existing autonomous dispatch path is
 * untouched.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetActivePersona = vi.fn();
vi.mock('@/services/identity/getActivePersona', () => ({
  getActivePersona: (req: unknown) => mockGetActivePersona(req),
}));

const mockVerifyPackExists = vi.fn();
const mockFindAcceptedExecutionReturn = vi.fn();
const mockRecordExecutionReturn = vi.fn();
vi.mock('@/services/constitutional/executionReturn', async () => {
  const actual = await vi.importActual<typeof import('@/services/constitutional/executionReturn')>(
    '@/services/constitutional/executionReturn',
  );
  return {
    ...actual,
    verifyPackExists: (packId: string) => mockVerifyPackExists(packId),
    findAcceptedExecutionReturn: (packId: string) => mockFindAcceptedExecutionReturn(packId),
    recordExecutionReturn: (input: unknown) => mockRecordExecutionReturn(input),
  };
});

import { POST, parseExecutionReturn } from '@/app/api/constitutional/execution-return/route';
import { canEnterValidation, advanceStage, createDevLoopSession } from '@/services/devCommandCenter';
import type { DevLoopState } from '@/types/devCommandCenter';

const EXECUTION_RETURN_ROUTE_SOURCE = readFileSync(
  path.join(process.cwd(), 'app/api/constitutional/execution-return/route.ts'),
  'utf-8',
);
const EXECUTION_RETURN_SERVICE_SOURCE = readFileSync(
  path.join(process.cwd(), 'services/constitutional/executionReturn.ts'),
  'utf-8',
);
const IMPLEMENTATION_LAYOUT_SOURCE = readFileSync(
  path.join(process.cwd(), 'components/devcommandcenter/layouts/ImplementationLayout.tsx'),
  'utf-8',
);
const IMPLEMENTATION_PACK_ROUTE_SOURCE = readFileSync(
  path.join(process.cwd(), 'app/api/constitutional/implementation-pack/route.ts'),
  'utf-8',
);
const DEV_LOOP_SOURCE = readFileSync(
  path.join(process.cwd(), 'services/devCommandCenter/devLoop.ts'),
  'utf-8',
);

function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const VALID_RETURN = {
  packId: 'pack-abc123',
  actor: 'claude-code',
  branch: 'aigentz/pack-abc123',
  commits: ['deadbeef'],
  pullRequest: { number: 42, url: 'https://github.com/x/y/pull/42' },
  filesChanged: ['services/foo.ts'],
  validationResults: [{ name: 'tsc', status: 'passed' }],
  deviationsFromPack: [],
  failuresOrEscalations: [],
  discoveries: [],
  consequenceObservations: [],
  completedAt: '2026-08-16T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: true } });
});

describe('parseExecutionReturn — pure validation, no mocking needed', () => {
  it('accepts a fully-formed, valid Execution Return', () => {
    const parsed = parseExecutionReturn(VALID_RETURN);
    expect(typeof parsed).not.toBe('string');
  });

  it('rejects a missing packId', () => {
    const { packId, ...rest } = VALID_RETURN;
    expect(parseExecutionReturn(rest)).toMatch(/packId/);
  });

  it('rejects malformed validationResults (bad status enum)', () => {
    const bad = { ...VALID_RETURN, validationResults: [{ name: 'tsc', status: 'maybe' }] };
    expect(parseExecutionReturn(bad)).toMatch(/validationResults/);
  });

  it('rejects a non-array filesChanged', () => {
    const bad = { ...VALID_RETURN, filesChanged: 'not-an-array' };
    expect(parseExecutionReturn(bad)).toMatch(/filesChanged/);
  });

  it('rejects a missing completedAt', () => {
    const { completedAt, ...rest } = VALID_RETURN;
    expect(parseExecutionReturn(rest)).toMatch(/completedAt/);
  });
});

describe('POST /api/constitutional/execution-return', () => {
  it('1 — a valid pack-linked return is accepted', async () => {
    mockVerifyPackExists.mockResolvedValue(true);
    mockFindAcceptedExecutionReturn.mockResolvedValue(null);
    mockRecordExecutionReturn.mockResolvedValue('receipt-xyz');

    const res = await POST(makeRequest(VALID_RETURN));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, receiptId: 'receipt-xyz' });
    expect(mockRecordExecutionReturn).toHaveBeenCalledTimes(1);
  });

  it('2 — an unknown packId fails closed (refused, not silently accepted)', async () => {
    mockVerifyPackExists.mockResolvedValue(false);
    const res = await POST(makeRequest(VALID_RETURN));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(data.error).toBe('pack-not-found');
    expect(mockRecordExecutionReturn).not.toHaveBeenCalled();
  });

  it('2b — a packId the verification check could not confirm (null, not false) is ALSO refused — fail closed on doubt, not just on confirmed absence', async () => {
    mockVerifyPackExists.mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_RETURN));
    expect(res.status).toBe(400);
    expect(mockRecordExecutionReturn).not.toHaveBeenCalled();
  });

  it('3 — malformed/incomplete evidence is refused before any pack check or recording — never reaches the stage-eligible state', async () => {
    const res = await POST(makeRequest({ packId: 'x' })); // missing every other required field
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.ok).toBe(false);
    expect(mockVerifyPackExists).not.toHaveBeenCalled();
    expect(mockRecordExecutionReturn).not.toHaveBeenCalled();
  });

  it('5 — a duplicate/replayed return is handled deterministically: the existing receipt is returned, no second receipt is written', async () => {
    mockVerifyPackExists.mockResolvedValue(true);
    mockFindAcceptedExecutionReturn.mockResolvedValue('receipt-original');

    const res = await POST(makeRequest(VALID_RETURN));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ ok: true, receiptId: 'receipt-original', replayed: true });
    expect(mockRecordExecutionReturn).not.toHaveBeenCalled();
  });

  it('a duplicate-check failure (undefined) also fails closed — refuses rather than risk writing a second, divergent record', async () => {
    mockVerifyPackExists.mockResolvedValue(true);
    mockFindAcceptedExecutionReturn.mockResolvedValue(undefined);
    const res = await POST(makeRequest(VALID_RETURN));
    expect(res.status).toBe(503);
    expect(mockRecordExecutionReturn).not.toHaveBeenCalled();
  });

  it('the actor identity is preserved verbatim into the recorded evidence — never overwritten with "DevOn"', async () => {
    mockVerifyPackExists.mockResolvedValue(true);
    mockFindAcceptedExecutionReturn.mockResolvedValue(null);
    mockRecordExecutionReturn.mockImplementation(async (input: { ret: { actor: string } }) => {
      expect(input.ret.actor).toBe('claude-code');
      expect(input.ret.actor).not.toMatch(/devon/i);
      return 'receipt-xyz';
    });
    await POST(makeRequest(VALID_RETURN));
    expect(mockRecordExecutionReturn).toHaveBeenCalledTimes(1);
  });

  it('non-admin callers are refused (spine-gated, same convention as the sibling implementation-pack route)', async () => {
    mockGetActivePersona.mockResolvedValue({ personaId: 'persona-1', cartridgeFlags: { isAdmin: false } });
    const res = await POST(makeRequest(VALID_RETURN));
    expect(res.status).toBe(403);
  });
});

describe('4 — valid, accepted evidence makes the Implementation stage eligible to advance', () => {
  function sessionAtImplementation(overrides: Partial<DevLoopState> = {}): DevLoopState {
    return {
      ...createDevLoopSession(),
      stage: 'implementation',
      implementationBrief: 'a real brief',
      ...overrides,
    };
  }

  it('canEnterValidation is false for a pack-linked session with NO accepted Execution Return', () => {
    const session = sessionAtImplementation({ generatedPack: { id: 'pack-1' } });
    expect(canEnterValidation(session)).toBe(false);
  });

  it('canEnterValidation is true once an accepted Execution Return matches the session\'s pack', () => {
    const session = sessionAtImplementation({
      generatedPack: { id: 'pack-1' },
      acceptedExecutionReturn: { packId: 'pack-1', receiptId: 'r-1', recordedAt: '2026-08-16T00:00:00.000Z' },
    });
    expect(canEnterValidation(session)).toBe(true);
  });

  it('canEnterValidation is false when the accepted return is for a DIFFERENT pack than the session currently holds', () => {
    const session = sessionAtImplementation({
      generatedPack: { id: 'pack-2' },
      acceptedExecutionReturn: { packId: 'pack-1', receiptId: 'r-1', recordedAt: '2026-08-16T00:00:00.000Z' },
    });
    expect(canEnterValidation(session)).toBe(false);
  });

  it('canEnterValidation is TRUE for a session with no generated pack at all (manually-authored brief, unchanged prior behavior)', () => {
    const session = sessionAtImplementation({ generatedPack: null });
    expect(canEnterValidation(session)).toBe(true);
  });

  it('advanceStage refuses to leave Implementation for a pack-linked session without an accepted return (no claimed completion from narrative alone)', () => {
    const session = sessionAtImplementation({ generatedPack: { id: 'pack-1' } });
    const next = advanceStage(session);
    expect(next.stage).toBe('implementation');
  });

  it('advanceStage DOES leave Implementation once the evidence is admissible', () => {
    const session = sessionAtImplementation({
      generatedPack: { id: 'pack-1' },
      acceptedExecutionReturn: { packId: 'pack-1', receiptId: 'r-1', recordedAt: '2026-08-16T00:00:00.000Z' },
    });
    const next = advanceStage(session);
    expect(next.stage).toBe('consequence_validation');
  });

  it('advanceStage on every OTHER stage is completely unaffected by this guard (scoped exactly to "implementation")', () => {
    const session: DevLoopState = {
      ...createDevLoopSession(),
      stage: 'intent_capture',
      intent: { status: 'approved' } as unknown as DevLoopState['intent'],
    };
    const next = advanceStage(session);
    expect(next.stage).toBe('context_assembly');
  });
});

describe('6 — pre-existing implementation-pack generation is unchanged, only additively extended', () => {
  it('the implementation_pack_generated receipt call still carries every original field, plus exactly one addition (actionInput)', () => {
    const callBlock = IMPLEMENTATION_PACK_ROUTE_SOURCE.slice(
      IMPLEMENTATION_PACK_ROUTE_SOURCE.indexOf("actionType: 'implementation_pack_generated'") - 100,
      IMPLEMENTATION_PACK_ROUTE_SOURCE.indexOf("actionType: 'implementation_pack_generated'") + 1200,
    );
    expect(callBlock).toMatch(/personaId:\s*gate\.persona\.personaId/);
    expect(callBlock).toMatch(/summary:/);
    expect(callBlock).toMatch(/activeCartridge:\s*'agentiq'/);
    expect(callBlock).toMatch(/invariantsUsed:/);
    expect(callBlock).toMatch(/actionInput:\s*\{\s*pack_id:\s*pack\.id\s*\}/);
  });
});

describe('Execution Return never becomes a new authority mechanism', () => {
  it('the service and route never ACTUALLY WRITE a deployment_authorized receipt (checked in code, not doc-comment prose explaining that they don\'t)', () => {
    const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly(EXECUTION_RETURN_SERVICE_SOURCE)).not.toMatch(/actionType:\s*['"]deployment_authorized['"]/);
    expect(codeOnly(EXECUTION_RETURN_ROUTE_SOURCE)).not.toMatch(/actionType:\s*['"]deployment_authorized['"]/);
  });

  it('the route never calls the autonomous dispatch/merge surfaces', () => {
    expect(EXECUTION_RETURN_ROUTE_SOURCE).not.toMatch(/repository_dispatch/);
    expect(EXECUTION_RETURN_ROUTE_SOURCE).not.toMatch(/dev-command-center\/implement/);
    expect(EXECUTION_RETURN_ROUTE_SOURCE).not.toMatch(/github\/merge/);
  });

  it('the recorded receipt summary explicitly states it does not authorize deployment', () => {
    expect(EXECUTION_RETURN_SERVICE_SOURCE).toMatch(/does not itself authorize deployment/i);
  });
});

describe('the existing autonomous "Dispatch to Claude" path is untouched', () => {
  it('ImplementationLayout still calls /api/dev-command-center/implement for dispatch, unchanged by the new Execution Return affordance', () => {
    expect(IMPLEMENTATION_LAYOUT_SOURCE).toMatch(/\/api\/dev-command-center\/implement["']/);
    expect(IMPLEMENTATION_LAYOUT_SOURCE).toMatch(/dispatchToClaude/);
  });

  it('the Execution Return submit handler posts to the NEW route, not the dispatch route', () => {
    const fnSource = IMPLEMENTATION_LAYOUT_SOURCE.slice(
      IMPLEMENTATION_LAYOUT_SOURCE.indexOf('const submitExecutionReturn'),
      IMPLEMENTATION_LAYOUT_SOURCE.indexOf('const submitExecutionReturn') + 1500,
    );
    expect(fnSource).toMatch(/\/api\/constitutional\/execution-return/);
    expect(fnSource).not.toMatch(/dev-command-center\/implement/);
  });
});

describe('the returned evidence is visible to Validate (spec acceptance canary), read-only', () => {
  const VALIDATION_LAYOUT_SOURCE = readFileSync(
    path.join(process.cwd(), 'components/devcommandcenter/layouts/ValidationLayout.tsx'),
    'utf-8',
  );

  it('ValidationLayout renders session.acceptedExecutionReturn when present', () => {
    expect(VALIDATION_LAYOUT_SOURCE).toMatch(/session\.acceptedExecutionReturn/);
  });

  it('the card states it is evidence only — never a validation verdict or deployment authorization', () => {
    const block = VALIDATION_LAYOUT_SOURCE.slice(
      VALIDATION_LAYOUT_SOURCE.indexOf('Execution Return accepted'),
      VALIDATION_LAYOUT_SOURCE.indexOf('Execution Return accepted') + 700,
    );
    expect(block).toMatch(/not itself a validation verdict or a deployment authorization/);
  });
});

describe('canEnterValidation is additive — devLoop.ts documents it as layered on canAdvance, not a replacement', () => {
  it('canAdvance itself is untouched (still exported, still the base check canEnterValidation calls)', () => {
    expect(DEV_LOOP_SOURCE).toMatch(/export function canAdvance/);
    expect(DEV_LOOP_SOURCE).toMatch(/export function canEnterValidation[\s\S]{0,50}\{\s*\n\s*if \(!canAdvance\(state\)\) return false;/);
  });
});
