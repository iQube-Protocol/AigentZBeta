import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCallerIdentityContext } from '@/services/identity/getActivePersona';
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

    const caller = await getCallerIdentityContext(req, admin);
    if (!caller.ok) {
      return NextResponse.json(
        { ok: false, error: 'authentication failed' },
        { status: 401 },
      );
    }

    if (!caller.isAdmin) {
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

    // Verify principal has active Passport and research-lab grant
    const { data: personaRow, error: personaError } = await admin
      .from('personas')
      .select('id, persona_label')
      .eq('id', boundPrincipalId)
      .maybeSingle();

    if (personaError || !personaRow) {
      return NextResponse.json(
        { ok: false, error: 'principal persona not found' },
        { status: 404 },
      );
    }

    // Verify active Passport
    const { data: passportRow, error: passportError } = await admin
      .from('passports')
      .select('id, passport_status, revoked_at')
      .eq('persona_id', boundPrincipalId)
      .eq('passport_status', 'ACTIVE')
      .is('revoked_at', null)
      .maybeSingle();

    if (passportError || !passportRow) {
      return NextResponse.json(
        { ok: false, error: 'principal lacks active verified Passport' },
        { status: 403 },
      );
    }

    // Verify active research-lab grant
    const { data: grantRows, error: grantError } = await admin
      .from('capability_grants')
      .select('id, capability_class, grant_status, expires_at')
      .eq('persona_id', boundPrincipalId)
      .eq('capability_class', 'research-lab')
      .eq('grant_status', 'active');

    if (grantError || !grantRows || grantRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'principal lacks active research-lab grant' },
        { status: 403 },
      );
    }

    // Verify grant has not expired
    const now = new Date();
    const validGrant = grantRows.find((g) => !g.expires_at || new Date(g.expires_at) > now);
    if (!validGrant) {
      return NextResponse.json(
        { ok: false, error: 'principal research-lab grant has expired' },
        { status: 403 },
      );
    }

    // Register artifact via canonical service
    const result = await registerArtifactOperatorAssisted(admin, {
      exchangeId,
      partySlot: 'B',
      artifactHash: contentHash,
      mimeType,
      boundPrincipalId,
      registeringOperatorPersonaId: caller.personaId,
      authorityBasis: authorityBasis || 'operator-assisted registration under research-lab grant',
      originChannel: 'operator-assisted',
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error ?? result.reason },
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
