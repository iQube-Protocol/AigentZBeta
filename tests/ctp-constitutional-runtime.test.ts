/**
 * `services/ctp/constitutionalRuntime.ts` — the canonical invocation seam
 * (2026-08-31, "CTP foundation", CTP-001 charter §7 / delivery amendment
 * §2.2). Exercises the twelve-step sequence against a THROWAWAY test
 * primitive (never the real `ctp.exchange.artifact.confirm` — that
 * primitive's own resolution/authorization logic is pinned separately in
 * tests/ctp-exchange-artifact-confirm-primitive.test.ts) so this file pins
 * ONLY the runtime's own generic contract:
 *
 *   1. an unknown/inactive primitive fails closed, never throws;
 *   2. authorization is evaluated BEFORE and SEPARATELY from execution —
 *      a refused authorization never reaches the bound implementation;
 *   3. a refusal writes evidence WITHOUT touching protected state;
 *   4. a success writes a normalized receipt carrying every required field
 *      (delivery amendment §2.3 / #28-30);
 *   5. delegability is enforced structurally, not left to each primitive to
 *      remember.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFakeSupabase } from './_lib/fakeSupabase';
import { constitutionalRuntime } from '@/services/ctp/constitutionalRuntime';
import { registerPrimitive, __resetRegistryForTests } from '@/services/ctp/registry';
import type {
  AuthorityResolutionResult,
  AuthorizationResolutionResult,
  ConstitutionalContext,
  ConstitutionalTransitionPrimitive,
} from '@/types/ctp';

interface TestInput {
  shouldAuthorize?: boolean;
  actorKind?: 'principal' | 'delegate';
}
interface TestImplResult {
  mutated: true;
}

const EVIDENCE_TABLE = 'ctp_transition_evidence';

function baseCtx(overrides: Partial<ConstitutionalContext> = {}): ConstitutionalContext {
  return {
    channel: 'web',
    channelSessionRef: null,
    callerPersonaId: 'persona-caller-1',
    callerAuthProfileId: null,
    ...overrides,
  };
}

function makeTestPrimitive(overrides: Partial<ConstitutionalTransitionPrimitive<TestInput, TestImplResult>> = {}) {
  const executeSpy = vi.fn(async () => ({ ok: true as const, result: { mutated: true as const } }));
  const authority: AuthorityResolutionResult = { result: 'VALID', basis: ['test-basis'] };
  const authorizeFn = vi.fn(
    (_p, _a, _prior, _proj, input: TestInput): AuthorizationResolutionResult =>
      input.shouldAuthorize === false
        ? { result: 'REFUSED', reasonCode: 'TEST_REFUSAL', reason: 'test refused this authorization' }
        : { result: 'AUTHORIZED' },
  );
  const primitive: ConstitutionalTransitionPrimitive<TestInput, TestImplResult> = {
    primitiveId: 'ctp.test.subject.act',
    version: '1.0.0',
    status: 'ACTIVE',
    domain: 'test',
    description: 'a throwaway test primitive',
    subjectRequirement: 'PERSONHOOD',
    actorRequirement: ['AUTHORIZED_PRINCIPAL_IDENTITY'],
    delegability: false,
    permittedChannels: ['web', 'mcp'],
    invariantRefs: [],
    async resolveParticipants(_admin, ctx, input) {
      return {
        ok: true,
        participants: {
          subjectPersonaId: ctx.callerPersonaId,
          principalPersonaId: ctx.callerPersonaId,
          actorPersonaId: ctx.callerPersonaId,
          actorKind: input.actorKind ?? 'principal',
          delegateGrantRef: null,
        },
      };
    },
    async resolveAuthority() {
      return authority;
    },
    async readPriorState() {
      return { stateValue: 'PRIOR' };
    },
    projectConsequence() {
      return { effects: ['state changes'] };
    },
    authorize: authorizeFn,
    implementationRef: 'test#execute',
    implementationHash: 'sha256:test',
    execute: executeSpy,
    resultingStateFrom() {
      return { stateValue: 'RESULT' };
    },
    realizeConsequence() {
      return { observed: true };
    },
    ...overrides,
  };
  return { primitive, executeSpy, authorizeFn };
}

describe('constitutionalRuntime.execute — unknown/inactive primitive fails closed', () => {
  beforeEach(() => __resetRegistryForTests());

  it('an unregistered primitiveId is refused, never throws, and writes refusal evidence naming it', async () => {
    const { admin, tables } = createFakeSupabase();
    const outcome = await constitutionalRuntime.execute(admin, 'ctp.does.not.exist', baseCtx(), {});
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.refusal.reasonCode).toBe('UNKNOWN_PRIMITIVE');
    expect(outcome.refusal.outcome).toBe('REFUSED');
    expect(tables[EVIDENCE_TABLE]).toHaveLength(1);
    expect(tables[EVIDENCE_TABLE][0].reason_code).toBe('UNKNOWN_PRIMITIVE');
  });

  it('a DEPRECATED primitive is not executable — resolves as unknown', async () => {
    const { admin } = createFakeSupabase();
    const { primitive, executeSpy } = makeTestPrimitive({ status: 'DEPRECATED' });
    registerPrimitive(primitive);
    const outcome = await constitutionalRuntime.execute(admin, primitive.primitiveId, baseCtx(), {});
    expect(outcome.ok).toBe(false);
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('a channel the primitive does not permit is refused before any resolution', async () => {
    const { admin } = createFakeSupabase();
    const { primitive, executeSpy } = makeTestPrimitive({ permittedChannels: ['operator'] });
    registerPrimitive(primitive);
    const outcome = await constitutionalRuntime.execute(admin, primitive.primitiveId, baseCtx({ channel: 'web' }), {});
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.refusal.reasonCode).toBe('CHANNEL_NOT_PERMITTED');
    expect(executeSpy).not.toHaveBeenCalled();
  });
});

describe('constitutionalRuntime.execute — authorization is separate from, and gates, execution', () => {
  beforeEach(() => __resetRegistryForTests());

  it('a REFUSED authorization never reaches the bound implementation — no mutation occurs', async () => {
    const { admin } = createFakeSupabase();
    const { primitive, executeSpy } = makeTestPrimitive();
    registerPrimitive(primitive);
    const outcome = await constitutionalRuntime.execute(admin, primitive.primitiveId, baseCtx(), { shouldAuthorize: false });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.refusal.reasonCode).toBe('TEST_REFUSAL');
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('authorize() is called with authority + prior state + projection already resolved — the ordering the charter requires', async () => {
    const { admin } = createFakeSupabase();
    const { primitive, authorizeFn } = makeTestPrimitive();
    registerPrimitive(primitive);
    await constitutionalRuntime.execute(admin, primitive.primitiveId, baseCtx(), {});
    expect(authorizeFn).toHaveBeenCalledTimes(1);
    const [, authorityArg, priorStateArg, projectionArg] = authorizeFn.mock.calls[0];
    expect(authorityArg).toEqual({ result: 'VALID', basis: ['test-basis'] });
    expect(priorStateArg).toEqual({ stateValue: 'PRIOR' });
    expect(projectionArg).toEqual({ effects: ['state changes'] });
  });

  it('a delegate acting on a non-delegable primitive is refused before execution, even when authorize() would have said yes', async () => {
    const { admin } = createFakeSupabase();
    const { primitive, executeSpy } = makeTestPrimitive({ delegability: false });
    registerPrimitive(primitive);
    const outcome = await constitutionalRuntime.execute(admin, primitive.primitiveId, baseCtx(), { actorKind: 'delegate' });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.refusal.reasonCode).toBe('DELEGATION_NOT_PERMITTED');
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('a delegate acting on a DELEGABLE primitive proceeds to execution', async () => {
    const { admin } = createFakeSupabase();
    const { primitive, executeSpy } = makeTestPrimitive({ delegability: true });
    registerPrimitive(primitive);
    const outcome = await constitutionalRuntime.execute(admin, primitive.primitiveId, baseCtx(), { actorKind: 'delegate' });
    expect(outcome.ok).toBe(true);
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });
});

describe('constitutionalRuntime.execute — a success writes a normalized receipt', () => {
  beforeEach(() => __resetRegistryForTests());

  it('carries primitive id/version, implementation binding, every participant field, both resolutions, prior/resulting state and realized consequence', async () => {
    const { admin, tables } = createFakeSupabase();
    const { primitive } = makeTestPrimitive();
    registerPrimitive(primitive);
    const outcome = await constitutionalRuntime.execute(
      admin,
      primitive.primitiveId,
      baseCtx({ channel: 'mcp', channelSessionRef: 'agent-alias-1' }),
      {},
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('unreachable');
    const r = outcome.receipt;
    expect(r.outcome).toBe('SUCCESS');
    expect(r.primitiveId).toBe('ctp.test.subject.act');
    expect(r.primitiveVersion).toBe('1.0.0');
    expect(r.implementationRef).toBe('test#execute');
    expect(r.implementationHash).toBe('sha256:test');
    expect(r.subjectPersonaId).toBe('persona-caller-1');
    expect(r.principalPersonaId).toBe('persona-caller-1');
    expect(r.actorPersonaId).toBe('persona-caller-1');
    expect(r.actorKind).toBe('principal');
    expect(r.channel).toBe('mcp');
    expect(r.channelSessionRef).toBe('agent-alias-1');
    expect(r.authorityResolution).toEqual({ result: 'VALID', basis: ['test-basis'] });
    expect(r.authorizationResolution).toEqual({ result: 'AUTHORIZED' });
    expect(r.priorState).toEqual({ stateValue: 'PRIOR' });
    expect(r.resultingState).toEqual({ stateValue: 'RESULT' });
    expect(r.realizedConsequence).toEqual({ observed: true });
    expect(r.reasonCode).toBeNull();
    expect(outcome.result).toEqual({ mutated: true });

    expect(tables[EVIDENCE_TABLE]).toHaveLength(1);
    expect(tables[EVIDENCE_TABLE][0].outcome).toBe('SUCCESS');
  });

  it('an implementation-level failure (execute() returns ok:false) is refused, never thrown, and evidence names it', async () => {
    const { admin } = createFakeSupabase();
    const { primitive } = makeTestPrimitive({
      execute: vi.fn(async () => ({ ok: false as const, error: 'implementation-specific refusal' })),
    });
    registerPrimitive(primitive);
    const outcome = await constitutionalRuntime.execute(admin, primitive.primitiveId, baseCtx(), {});
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    expect(outcome.refusal.reasonCode).toBe('IMPLEMENTATION_REFUSED');
    expect(outcome.refusal.reason).toBe('implementation-specific refusal');
  });
});

describe('registerPrimitive — implementation singularity, structurally enforced', () => {
  beforeEach(() => __resetRegistryForTests());

  it('registering the SAME (id, version) with a DIFFERENT implementationRef is refused', () => {
    const { primitive: a } = makeTestPrimitive({ implementationRef: 'impl-a' });
    const { primitive: b } = makeTestPrimitive({ implementationRef: 'impl-b' });
    registerPrimitive(a);
    expect(() => registerPrimitive(b)).toThrow(/already bound to 'impl-a'/);
  });

  it('re-registering the SAME (id, version, implementationRef) is a benign no-op — module re-import must not crash the process', () => {
    const { primitive } = makeTestPrimitive();
    registerPrimitive(primitive);
    expect(() => registerPrimitive(primitive)).not.toThrow();
  });
});
