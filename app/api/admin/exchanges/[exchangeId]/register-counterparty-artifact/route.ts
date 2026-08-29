import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { isCartridgeAdmin } from '@/services/access/requireCartridgeAdmin';
import { registerArtifactOperatorAssisted } from '@/services/research/reciprocalExchange';

const OCSGA_V13_FINGERPRINT = '9f33939112351d811337475c3ed4ebcb78bb993d066232ab06d187098f7c1331';

/**
 * POST /api/admin/exchanges/[exchangeId]/register-counterparty-artifact
 *
 * Admin-authenticated route for operator-assisted artifact registration.
 * Registers Party B artifact on behalf of a principal who holds an active
 * research-lab grant and verified Passport. Principal must confirm via MCP
 * before freeze/sign can proceed.
 *
 * Enforces byte-level provenance (server-computed SHA-256) and records
 * three distinct evidentiary identities: bound principal, registering operator, and
 * (where applicable) delegated executing agent.
 */

export async function POST(
  req: NextRequest,
  context: { params: { exchangeId: string } },
) {
  try {
    const exchangeId = context.params.exchangeId;

    // Parse request body
    const body = await req.json();
    const { artifactBytes, mimeType, authorityBasis, boundPrincipalId } = body;

    if (!artifactBytes || typeof artifactBytes !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'artifactBytes is required (base64-encoded)' },
        { status: 400 },
      );
    }

    if (!mimeType || typeof mimeType !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'mimeType is required' },
        { status: 400 },
      );
    }

    if (!boundPrincipalId || typeof boundPrincipalId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'boundPrincipalId is required' },
        { status: 400 },
      );
    }

    // Verify admin access
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const caller = await getActivePersona(req);
    if (!caller) {
      return NextResponse.json(
        { ok: false, error: 'authentication failed' },
        { status: 401 },
      );
    }

    if (!isCartridgeAdmin(caller, 'irl-cartridge')) {
      return NextResponse.json(
        { ok: false, error: 'admin access required' },
        { status: 403 },
      );
    }

    // Decode artifact bytes and compute SHA-256
    const artifactBuffer = Buffer.from(artifactBytes, 'base64');
    const contentHash = createHash('sha256').update(artifactBuffer).digest('hex');

    // Verify fingerprint matches OCSGA v1.3
    if (contentHash !== OCSGA_V13_FINGERPRINT) {
      return NextResponse.json(
        {
          ok: false,
          error: `Artifact fingerprint mismatch. Expected ${OCSGA_V13_FINGERPRINT}, got ${contentHash}`,
        },
        { status: 400 },
      );
    }

    // Resolve target — confirm the persona genuinely exists. Passport
    // usability and research-lab grant scope are NOT re-checked here: they
    // are the canonical service's own job, enforced structurally by
    // registerArtifactOperatorAssisted's resolveMembership invariant below
    // (a principal can only be bound to Party B via
    // services/journey/boundaryResearchExchangeAdmission.ts's admission
    // flow, which already verified Passport + grant before binding). This
    // route does not reconstruct that doctrine with its own table queries.
    const { data: personaRow, error: personaError } = await admin
      .from('personas')
      .select('id')
      .eq('id', boundPrincipalId)
      .maybeSingle();

    if (personaError) {
      return NextResponse.json({ ok: false, error: personaError.message }, { status: 500 });
    }
    if (!personaRow) {
      return NextResponse.json(
        { ok: false, error: 'principal persona not found' },
        { status: 404 },
      );
    }

    // Register artifact via canonical service. boundPrincipalPersonaId is
    // re-verified for real inside the service — it refuses 'not-a-party' if
    // this persona is not the exchange's currently bound Party B.
    const result = await registerArtifactOperatorAssisted(admin, {
      exchangeId,
      boundPrincipalPersonaId: boundPrincipalId,
      registeringOperatorPersonaId: caller.personaId,
      authorityBasis: authorityBasis || 'operator-assisted registration under research-lab grant',
      title: 'OCSGA v1.3 — Operator-Registered Boundary Research Artifact',
      artifactClass: 'operator-registered-deposit',
      sourceType: 'immutable-reference',
      sourceReference: 'operator-assisted-registration',
      contentHash,
      mimeType,
      ownershipDeclaration:
        'Registered via operator-assisted workflow under boundary research exchange admission protocol.',
      rightsForExchange:
        'Authorized under active research-lab grant and verified Passport, confirmed via canonical exchange membership.',
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      artifact: result.artifact,
      contentHash,
      boundPrincipalId,
      registeringOperatorPersonaId: caller.personaId,
      message: 'Artifact registered with pending_principal_attestation=true. Principal must confirm via MCP before freeze/sign.',
    });
  } catch (err) {
    console.error('[admin/exchanges] registration error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown error' },
      { status: 500 },
    );
  }
}
