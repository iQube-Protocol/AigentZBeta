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
 * actorType (principal vs delegated agent) is resolved SERVER-SIDE via
 * resolveConstitutionalContext — the same primitive
 * services/delegation/delegationAuthorityGate.ts uses to distinguish a
 * delegated Agent's action from the human default identity — and is NEVER
 * accepted from the request body. `freeze` and `sign` refuse when a
 * delegated Agent is the currently-assigned actor: the ritual requires the
 * PRINCIPAL's own attestation.
 *
 * Actions: invite | deposit | freeze | sign | acknowledge | withdraw |
 *          revoke | open-comparison | add-derivative
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { resolveConstitutionalContext } from '@/services/identity/constitutionalContext';
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
} from '@/services/research/reciprocalExchange';
import type { ActorType, ArtifactSourceType, ComparisonClassification, CompatibilityKind } from '@/types/reciprocalExchange';
import { publicOrigin } from '@/utils/publicOrigin';

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
  const personaId = persona.personaId;

  // Resolved ONCE, server-side, never from client input. A non-null
  // currentAigentMe means a delegated Agent is presently acting for this
  // persona — see the module doc comment.
  const cc = await resolveConstitutionalContext(req);
  const actorType: ActorType = cc.currentAigentMe ? 'delegated_agent' : 'principal';

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
