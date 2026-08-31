/**
 * The Constitutional Runtime — the canonical invocation seam (2026-08-31,
 * "CTP foundation", CTP-001 charter §7, delivery amendment §2.2):
 *
 *   constitutionalRuntime.execute(primitiveId, context, input)
 *
 * Channels stop calling state-changing services directly and call this
 * instead. It performs the charter's twelve-step sequence through ONE
 * canonical path, never a per-channel variant of it:
 *
 *   resolve primitive -> resolve subject/principal/actor/delegate/channel ->
 *   resolve authority -> read canonical prior state -> project consequence ->
 *   evaluate authorization -> verify active implementation binding ->
 *   execute canonical transition -> verify resulting state ->
 *   realize/observe consequence -> write canonical evidence -> return
 *   result + receipt/refusal evidence.
 *
 * Authorization and execution are separate decisions (charter §8, delivery
 * amendment #29) — `authorize()` never performs a write, and the bound
 * implementation is invoked ONLY after authorization succeeds.
 *
 * This runtime performs NO mutation of protected state itself — every write
 * happens inside the primitive's own bound `execute()`, which (per
 * CTP-001A §3, "bind, don't rewrite") is the EXISTING canonical service
 * function. The runtime's only writes are evidence (success receipt or
 * refusal), never the constitutional transition itself.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolvePrimitive } from './registry';
import { writeRefusalEvidence, writeTransitionReceipt } from './evidence';
import type { ConstitutionalContext, ConstitutionalTransitionEvidence } from '@/types/ctp';

export type ConstitutionalExecuteResult<TImplResult = unknown> =
  | { ok: true; outcome: 'SUCCESS'; receipt: ConstitutionalTransitionEvidence; result: TImplResult }
  | { ok: false; outcome: 'REFUSED'; refusal: ConstitutionalTransitionEvidence };

async function execute<TInput = unknown, TImplResult = unknown>(
  admin: SupabaseClient,
  primitiveId: string,
  ctx: ConstitutionalContext,
  input: TInput,
): Promise<ConstitutionalExecuteResult<TImplResult>> {
  const refuse = (args: {
    primitiveVersion: string | null;
    subjectPersonaId: string | null;
    reasonCode: string;
    reason: string;
  }) =>
    writeRefusalEvidence(admin, {
      primitiveId,
      primitiveVersion: args.primitiveVersion,
      subjectPersonaId: args.subjectPersonaId,
      callerPersonaId: ctx.callerPersonaId,
      channel: ctx.channel,
      channelSessionRef: ctx.channelSessionRef,
      reasonCode: args.reasonCode,
      reason: args.reason,
    }).then((refusal) => ({ ok: false as const, outcome: 'REFUSED' as const, refusal }));

  // 1. Resolve primitive — fails closed for an unknown/inactive primitive
  //    (delivery amendment #36).
  const primitive = resolvePrimitive(primitiveId);
  if (!primitive) {
    return refuse({
      primitiveVersion: null,
      subjectPersonaId: null,
      reasonCode: 'UNKNOWN_PRIMITIVE',
      reason: `No active Constitutional Transition Primitive is registered for '${primitiveId}'.`,
    });
  }
  if (!primitive.permittedChannels.includes(ctx.channel)) {
    return refuse({
      primitiveVersion: primitive.version,
      subjectPersonaId: null,
      reasonCode: 'CHANNEL_NOT_PERMITTED',
      reason: `'${primitive.primitiveId}' is not permitted through the '${ctx.channel}' channel.`,
    });
  }

  // 2. Resolve subject/principal/actor/delegate/channel — the ONLY place
  //    THIS invocation decides who is acting.
  const resolved = await primitive.resolveParticipants(admin, ctx, input);
  if (!resolved.ok) {
    return refuse({
      primitiveVersion: primitive.version,
      subjectPersonaId: null,
      reasonCode: resolved.reasonCode,
      reason: resolved.reason,
    });
  }
  const participants = resolved.participants;

  // 3. Resolve authority (durable) — distinct from authorization (charter §8).
  const authority = await primitive.resolveAuthority(admin, participants, input);
  if (authority.result === 'INVALID') {
    return refuse({
      primitiveVersion: primitive.version,
      subjectPersonaId: participants.subjectPersonaId,
      reasonCode: 'AUTHORITY_INVALID',
      reason: authority.reason,
    });
  }
  if (participants.actorKind === 'delegate' && !primitive.delegability) {
    return refuse({
      primitiveVersion: primitive.version,
      subjectPersonaId: participants.subjectPersonaId,
      reasonCode: 'DELEGATION_NOT_PERMITTED',
      reason: `'${primitive.primitiveId}' is not delegable — it must be performed by the principal directly.`,
    });
  }

  // 4. Read canonical prior state.
  const priorState = await primitive.readPriorState(admin, participants, input);

  // 5. Project consequence — pure, from prior state + input.
  const projection = primitive.projectConsequence(priorState, input);

  // 6. Evaluate authorization — a SEPARATE decision from authority, and
  //    still no write.
  const authorization = primitive.authorize(participants, authority, priorState, projection, input);
  if (authorization.result === 'REFUSED') {
    return refuse({
      primitiveVersion: primitive.version,
      subjectPersonaId: participants.subjectPersonaId,
      reasonCode: authorization.reasonCode,
      reason: authorization.reason,
    });
  }

  // 7. Verify active implementation binding — the registry lookup above IS
  //    this verification (registerPrimitive refuses a second, different
  //    binding for the same id/version); implementationHash rides onto the
  //    receipt as evidence of which binding executed.

  // 8. Execute the canonical transition. The bound implementation is the
  //    EXISTING service function — this runtime performs no mutation of
  //    its own.
  const executed = await primitive.execute(admin, participants, input);
  if (!executed.ok) {
    return refuse({
      primitiveVersion: primitive.version,
      subjectPersonaId: participants.subjectPersonaId,
      reasonCode: 'IMPLEMENTATION_REFUSED',
      reason: executed.error,
    });
  }

  // 9. Verify resulting state — derived from the implementation's own
  //    result, never a second, possibly-racing read.
  const resultingState = primitive.resultingStateFrom(executed.result);

  // 10. Realize/observe immediate consequence, if the primitive defines one.
  const realizedConsequence = primitive.realizeConsequence ? primitive.realizeConsequence(executed.result) : null;

  // 11. Write canonical transition evidence.
  const receipt = await writeTransitionReceipt(admin, {
    primitiveId: primitive.primitiveId,
    primitiveVersion: primitive.version,
    implementationRef: primitive.implementationRef,
    implementationHash: primitive.implementationHash,
    subjectPersonaId: participants.subjectPersonaId,
    principalPersonaId: participants.principalPersonaId,
    actorPersonaId: participants.actorPersonaId,
    actorKind: participants.actorKind,
    delegateGrantRef: participants.delegateGrantRef,
    channel: ctx.channel,
    channelSessionRef: ctx.channelSessionRef,
    callerPersonaId: ctx.callerPersonaId,
    authorityResolution: authority,
    authorizationResolution: authorization,
    priorState,
    projectedConsequence: projection,
    resultingState,
    realizedConsequence,
  });

  // 12. Return result + receipt.
  return { ok: true, outcome: 'SUCCESS', receipt, result: executed.result as TImplResult };
}

export const constitutionalRuntime = { execute };
