/**
 * POST /api/research/exchanges/[exchangeId]/actions — the Reciprocal
 * Artifact Exchange action dispatch (PRD-IRL-AX-001).
 *
 * ONE route, an `action` discriminator in the body — mirrors this repo's
 * existing PATCH-with-action convention (e.g.
 * app/api/steward/participation/invitations/route.ts) rather than one file
 * per verb, which would be twelve nearly-identical thin wrappers around the
 * same membership/authorization check.
 *
 * personaId AND actorType (principal vs delegated agent) are resolved
 * SERVER-SIDE via resolveExchangeActingPrincipal (2026-08-30, "OCSGA
 * completion path" fix — services/research/reciprocalExchange.ts) — never
 * accepted from the request body, and never merely the caller's ambient
 * "active persona" (whatever a session/localStorage happens to have
 * mounted). That resolver reaches directly for the exchange's own bound
 * party under the caller's auth profile — Ian's already-established
 * Passport-backed principal — so aigentMe may remain the active assisting
 * context without blocking a principal-only act performed on the bound
 * principal's behalf. `freeze` and `sign` still refuse when the RESOLVED
 * party is not of principal type: the ritual requires the PRINCIPAL's own
 * attestation, never an agent's in its place.
 *
 * Actions: invite | deposit | confirm | freeze | sign | acknowledge |
 *          withdraw | revoke | open-comparison | add-derivative
 *
 * `confirm` (OCSGA Bridge projection fix, 2026-08-29) is the bound
 * principal's own acceptance of an artifact an operator registered on their
 * behalf (registerArtifactOperatorAssisted) — the ONLY thing that clears
 * `pendingPrincipalAttestation`. As of 2026-08-31 ("CTP foundation" —
 * `ctp.exchange.artifact.confirm`, the first migrated OCSGA primitive) this
 * action is dispatched through `constitutionalRuntime.execute` rather than
 * calling `confirmOperatorAssistedArtifact` directly — the SAME canonical
 * implementation still runs (services/ctp/primitives/exchangeArtifactConfirm.ts
 * binds it, never reproduces it), now through the ONE constitutional
 * invocation seam every permitted channel shares. Every other action here
 * is UNCHANGED — this is a bounded first slice, not an estate-wide
 * migration (CTP-001A §2, "not a big-bang refactor").
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  inviteCounterparty,
  depositArtifact,
  declareFreeze,
  signInstrument,
  acknowledgeReceipt,
  withdrawPreExchange,
  revokeAccessPostExchange,
  openComparison,
  createDerivative,
  getExchangeView,
  resolveExchangeActingPrincipal,
} from '@/services/research/reciprocalExchange';
import type { ArtifactSourceType, ComparisonClassification, CompatibilityKind } from '@/types/reciprocalExchange';
import { publicOrigin } from '@/utils/publicOrigin';
import { constitutionalRuntime } from '@/services/ctp/constitutionalRuntime';
import '@/services/ctp/primitives/exchangeArtifactConfirm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ exchangeId: string }> }) {
  const persona = await getActivePersona(req);
  if (!persona?.personaId) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401, headers: noStore });
  }
  const admin = getSupabaseServer();
  if (!admin) return NextResponse.json({ ok: false, error: 'Service unavailable' }, { status: 503, headers: noStore });
  const { exchangeId } = await ctx.params;

  // Resolved ONCE, server-side, never from client input and never merely the
  // caller's ambient "active persona" — see the module doc comment and
  // resolveExchangeActingPrincipal's own doc comment (services/research/
  // reciprocalExchange.ts) for why this replaced resolveConstitutionalContext's
  // currentAigentMe check.
  const resolved = await resolveExchangeActingPrincipal(admin, {
    exchangeId,
    activePersonaId: persona.personaId,
    authProfileId: persona.authProfileId,
  });
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 403, headers: noStore });
  }
  const personaId = resolved.personaId;
  const actorType = resolved.actorType;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? '');

  switch (action) {
    case 'invite': {
      const result = await inviteCounterparty(admin, {
        exchangeId,
        personaId,
        expiresInDays: typeof body.expiresInDays === 'number' ? body.expiresInDays : undefined,
      });
      if (!result.ok) return NextResponse.json(result, { status: 400, headers: noStore });
      const origin = publicOrigin(req);
      return NextResponse.json(
        { ok: true, rawCode: result.rawCode, claimUrl: `${origin}/api/research/exchanges/join` },
        { headers: noStore },
      );
    }

    case 'deposit': {
      const d = body as {
        title?: string;
        artifactClass?: string;
        description?: string;
        sourceType?: ArtifactSourceType;
        sourceReference?: string;
        contentHash?: string;
        repositoryCommit?: string;
        storageReference?: string;
        mimeType?: string;
        confidentialityClass?: string;
        ownershipDeclaration?: string;
        rightsForExchange?: string;
      };
      if (!d.title || !d.artifactClass || !d.sourceType || !d.sourceReference || !d.contentHash || !d.ownershipDeclaration || !d.rightsForExchange) {
        return NextResponse.json(
          { ok: false, error: 'title, artifactClass, sourceType, sourceReference, contentHash, ownershipDeclaration and rightsForExchange are required' },
          { status: 400, headers: noStore },
        );
      }
      const result = await depositArtifact(admin, {
        exchangeId,
        personaId,
        title: d.title,
        artifactClass: d.artifactClass,
        description: d.description,
        sourceType: d.sourceType,
        sourceReference: d.sourceReference,
        contentHash: d.contentHash,
        repositoryCommit: d.repositoryCommit,
        storageReference: d.storageReference,
        mimeType: d.mimeType,
        confidentialityClass: d.confidentialityClass,
        ownershipDeclaration: d.ownershipDeclaration,
        rightsForExchange: d.rightsForExchange,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: noStore });
    }

    case 'confirm': {
      // Dispatched through the Constitutional Runtime (2026-08-31, "CTP
      // foundation") — `ctp.exchange.artifact.confirm` binds the SAME
      // `confirmOperatorAssistedArtifact` this route called directly before
      // this change; nothing about the underlying transition is different.
      // `ctx.callerPersonaId` is the RAW caller-asserted persona (not this
      // route's own already-resolved `personaId`) because the primitive's
      // own `resolveParticipants` performs that exact resolution itself —
      // passing the pre-resolved value here would resolve it twice for no
      // benefit. No agentRef: a direct bridge/UI POST is never "transmitted
      // through" an agent (contrast the MCP path, services/threshold/
      // mcpConstitutionalActs.ts, which legitimately sets agentRef to the
      // real acting agent session's own alias).
      const outcome = await constitutionalRuntime.execute(admin, 'ctp.exchange.artifact.confirm', {
        channel: 'web',
        channelSessionRef: null,
        callerPersonaId: persona.personaId,
        callerAuthProfileId: persona.authProfileId ?? null,
      }, { exchangeId });
      if (!outcome.ok) {
        return NextResponse.json({ ok: false, error: outcome.refusal.reason }, { status: 400, headers: noStore });
      }
      return NextResponse.json({ ok: true, artifact: outcome.result }, { status: 200, headers: noStore });
    }

    case 'freeze': {
      const result = await declareFreeze(admin, { exchangeId, personaId, actorType });
      const status = result.ok ? 200 : result.error === 'freeze-declaration-requires-principal' ? 403 : 400;
      return NextResponse.json(result, { status, headers: noStore });
    }

    case 'sign': {
      const result = await signInstrument(admin, { exchangeId, personaId, actorType });
      const status = result.ok ? 200 : result.error === 'instrument-signature-requires-principal' ? 403 : 400;
      return NextResponse.json(result, { status, headers: noStore });
    }

    case 'acknowledge': {
      const result = await acknowledgeReceipt(admin, { exchangeId, personaId });
      return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: noStore });
    }

    case 'withdraw': {
      const reason = typeof body.reason === 'string' ? body.reason : '';
      const result = await withdrawPreExchange(admin, { exchangeId, personaId, actorType, reason });
      const status = result.ok ? 200 : result.error === 'withdrawal-requires-principal' ? 403 : 400;
      return NextResponse.json(result, { status, headers: noStore });
    }

    case 'revoke': {
      const reason = typeof body.reason === 'string' ? body.reason : '';
      const result = await revokeAccessPostExchange(admin, { exchangeId, personaId, actorType, reason });
      const status = result.ok ? 200 : result.error === 'revocation-requires-principal' ? 403 : 400;
      return NextResponse.json(result, { status, headers: noStore });
    }

    case 'open-comparison': {
      const result = await openComparison(admin, { exchangeId, personaId });
      return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: noStore });
    }

    case 'add-derivative': {
      const d = body as {
        comparisonId?: string;
        title?: string;
        description?: string;
        sourceArtifactIds?: string[];
        classification?: ComparisonClassification;
        compatibilityKind?: CompatibilityKind;
      };
      if (!d.comparisonId || !d.title || !d.description || !Array.isArray(d.sourceArtifactIds)) {
        return NextResponse.json(
          { ok: false, error: 'comparisonId, title, description and sourceArtifactIds[] are required' },
          { status: 400, headers: noStore },
        );
      }
      const result = await createDerivative(admin, {
        comparisonId: d.comparisonId,
        personaId,
        title: d.title,
        description: d.description,
        sourceArtifactIds: d.sourceArtifactIds,
        classification: d.classification,
        compatibilityKind: d.compatibilityKind,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 400, headers: noStore });
    }

    default: {
      // Fall back to returning the caller's own view — a harmless no-op read
      // rather than a confusing 400 for an omitted/unknown action.
      const view = await getExchangeView(admin, { exchangeId, personaId });
      return NextResponse.json(
        { ok: false, error: `unknown action "${action}"`, view: view.ok ? view.view : undefined },
        { status: 400, headers: noStore },
      );
    }
  }
}
