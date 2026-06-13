/**
 * /api/access/delegation/agentkit-attest
 *
 * POST — issue an AgentKit attestation for an existing bounded-delegation
 *        grant. Body: { delegationGrantId, sponsorPassportId,
 *        delegatedAgentRootId, allowedActions?, expiresAt? }
 *
 * GET  ?token=<...>  — verify an attestation token. Returns the decoded
 *        payload if valid; 401 otherwise.
 *
 * Per the 2026-06-13 hackathon plan §Sprint 5.
 *
 * Critical contract: this endpoint is ADDITIVE to the bounded-delegation
 * framework. The grant is the source of truth; AgentKit attaches a
 * cryptographic proof to it. If AgentKit fails or env is unset, the
 * grant remains valid — it just doesn't carry the verified-human
 * attestation badge.
 *
 * T0 discipline: sponsor_persona_id is queried server-side for the
 * ownership check + row write; never serialised. The attestation token
 * carries only T1-safe fields (passport_id, World ID nullifier hash,
 * agent DID, scopes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  issueAgentKitAttestation,
  verifyAgentKitAttestation,
} from '@/services/delegation/agentKitBridge';

export const dynamic = 'force-dynamic';

interface AttestBody {
  delegationGrantId: string;
  sponsorPassportId: string;
  delegatedAgentRootId: string;
  allowedActions?: string[];
  expiresAt?: string;
}

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await req.json()) as AttestBody;
    if (!body?.delegationGrantId || !body?.sponsorPassportId || !body?.delegatedAgentRootId) {
      return NextResponse.json(
        { ok: false, error: 'delegationGrantId, sponsorPassportId, and delegatedAgentRootId are required' },
        { status: 400 },
      );
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    // 1. Verify sponsor passport belongs to caller AND fetch World ID
    //    verification state in one read.
    const { data: passport, error: ppErr } = await admin
      .from('polity_passport_records')
      .select('passport_id, persona_id, passport_class, world_id_nullifier_hash, world_id_verified_at')
      .eq('passport_id', body.sponsorPassportId)
      .maybeSingle();

    if (ppErr) {
      return NextResponse.json({ ok: false, error: ppErr.message }, { status: 500 });
    }
    if (!passport) {
      return NextResponse.json({ ok: false, error: 'Sponsor passport not found' }, { status: 404 });
    }
    if (passport.persona_id && passport.persona_id !== persona.personaId) {
      return NextResponse.json(
        { ok: false, error: 'Caller does not own the sponsor passport' },
        { status: 403 },
      );
    }
    if (passport.passport_class !== 'citizen') {
      return NextResponse.json(
        { ok: false, error: 'Only citizen passports may issue AgentKit attestations' },
        { status: 400 },
      );
    }

    // 2. Resolve the agent DID so the attestation carries it.
    const { data: agent, error: agentErr } = await admin
      .from('agent_root_identity')
      .select('id, did_uri, agent_class')
      .eq('id', body.delegatedAgentRootId)
      .maybeSingle();

    if (agentErr) {
      return NextResponse.json({ ok: false, error: agentErr.message }, { status: 500 });
    }
    if (!agent) {
      return NextResponse.json({ ok: false, error: 'Delegated agent not found' }, { status: 404 });
    }

    // 3. Issue the attestation. Stub mode emits a deterministic JWT-like
    //    token when AgentKit env is unset.
    const result = await issueAgentKitAttestation({
      delegationGrantId: body.delegationGrantId,
      sponsorPassportId: body.sponsorPassportId,
      sponsorWorldIdNullifier: passport.world_id_nullifier_hash ?? null,
      delegatedAgentDidUri: agent.did_uri,
      delegatedAgentRootId: body.delegatedAgentRootId,
      allowedActions: body.allowedActions ?? ['read', 'request_access'],
      expiresAt: body.expiresAt ?? null,
    });

    // 4. Persist receipt.
    const { data: row, error: insertErr } = await admin
      .from('delegation_agentkit_attestations')
      .insert({
        delegation_grant_id: body.delegationGrantId,
        sponsor_persona_id: persona.personaId,
        sponsor_passport_id: body.sponsorPassportId,
        sponsor_world_id_nullifier: passport.world_id_nullifier_hash ?? null,
        delegated_agent_root_id: body.delegatedAgentRootId,
        attestation_token: result.attestationToken,
        attestation_ref: result.attestationRef,
        mode: result.mode,
        verified_human: result.verifiedHuman,
        issued_at: result.issuedAt,
        expires_at: body.expiresAt ?? null,
      })
      .select('attestation_id, attestation_ref, mode, verified_human, issued_at, expires_at')
      .single();

    if (insertErr) {
      if (insertErr.message.includes('delegation_agentkit_attestations')) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Pending migration: 20260613400000_delegation_agentkit_attestations.sql must be applied in Supabase.',
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      attestation: {
        attestationId: row.attestation_id,
        attestationRef: row.attestation_ref,
        attestationToken: result.attestationToken,
        verifiedHuman: row.verified_human,
        mode: row.mode,
        issuedAt: row.issued_at,
        expiresAt: row.expires_at,
      },
      note: result.note,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Attestation failed' },
      { status: 500 },
    );
  }
}

/**
 * GET — verify an AgentKit attestation. Public (verification is
 * intended for external counsel/partners who do not have spine auth).
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ ok: false, error: 'token query param required' }, { status: 400 });
  }

  const verification = verifyAgentKitAttestation(token);
  if (!verification.valid) {
    return NextResponse.json(
      { ok: false, valid: false, mode: verification.mode, error: verification.error },
      { status: 401 },
    );
  }
  return NextResponse.json(
    { ok: true, valid: true, mode: verification.mode, payload: verification.payload },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
