/**
 * POST /api/polity-passport/attest/[type]
 *
 * Generates a ProveKit ZK proof for one of five attestation types.
 * Per the 2026-06-13 hackathon plan §Sprint 6 (operator-cut):
 *   - proof_of_personhood  — IN DEMO CUT
 *   - proof_of_delegation_authority  — IN DEMO CUT
 *   - proof_of_passport_standing  — PHASE B (placeholder)
 *   - proof_of_document_possession  — PHASE B (placeholder)
 *   - proof_of_mobility_authorization  — PHASE B (placeholder)
 *
 * Phase B circuits return a shaped placeholder commitment ref so the
 * end-to-end demo flow completes; verification returns
 * notYetImplemented=true for them.
 *
 * T0 discipline: this endpoint accepts only T1-safe inputs (passport
 * IDs, grant IDs, agent DIDs, World ID nullifier hashes). The caller's
 * persona_id is used server-side ONLY to verify ownership; never
 * serialised into the proof.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  generateProveKitProof,
  type ProveKitCircuit,
} from '@/services/proof/provekit';

export const dynamic = 'force-dynamic';

const VALID_CIRCUITS: ReadonlySet<ProveKitCircuit> = new Set([
  'proof_of_personhood',
  'proof_of_delegation_authority',
  'proof_of_passport_standing',
  'proof_of_document_possession',
  'proof_of_mobility_authorization',
]);

interface RouteParams {
  params: Promise<{ type: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { type } = await params;
    if (!VALID_CIRCUITS.has(type as ProveKitCircuit)) {
      return NextResponse.json(
        { ok: false, error: `Unknown circuit: ${type}` },
        { status: 400 },
      );
    }
    const circuit = type as ProveKitCircuit;

    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, string | null>;

    if (circuit === 'proof_of_personhood') {
      const passportId = body.passportId;
      if (!passportId) {
        return NextResponse.json({ ok: false, error: 'passportId required' }, { status: 400 });
      }
      const { data: pp } = await admin
        .from('polity_passport_records')
        .select('passport_id, persona_id, passport_class, passport_grade, citizen_status, credential_claimed_at, world_id_nullifier_hash')
        .eq('passport_id', passportId)
        .maybeSingle();
      if (!pp) return NextResponse.json({ ok: false, error: 'Passport not found' }, { status: 404 });
      if (pp.persona_id && pp.persona_id !== persona.personaId) {
        return NextResponse.json({ ok: false, error: 'Caller does not own this passport' }, { status: 403 });
      }
      if (pp.passport_class !== 'citizen') {
        return NextResponse.json({ ok: false, error: 'proof_of_personhood requires a citizen passport' }, { status: 400 });
      }
      if (pp.citizen_status !== 'active' || !pp.credential_claimed_at) {
        return NextResponse.json({ ok: false, error: 'passport must be active and claimed' }, { status: 400 });
      }
      const proof = await generateProveKitProof('proof_of_personhood', {
        passportId: pp.passport_id,
        passportClass: 'citizen',
        passportGrade: pp.passport_grade,
        claimed: true,
        worldIdNullifier: pp.world_id_nullifier_hash ?? null,
      });
      return NextResponse.json({ ok: true, proof });
    }

    if (circuit === 'proof_of_delegation_authority') {
      const delegationGrantId = body.delegationGrantId;
      const sponsorPassportId = body.sponsorPassportId;
      const delegatedAgentDidUri = body.delegatedAgentDidUri;
      const expiresAt = body.expiresAt ?? null;
      if (!delegationGrantId || !sponsorPassportId || !delegatedAgentDidUri) {
        return NextResponse.json(
          { ok: false, error: 'delegationGrantId, sponsorPassportId, and delegatedAgentDidUri required' },
          { status: 400 },
        );
      }
      // Sponsor ownership check (citizen).
      const { data: pp } = await admin
        .from('polity_passport_records')
        .select('passport_id, persona_id, passport_class')
        .eq('passport_id', sponsorPassportId)
        .maybeSingle();
      if (!pp) return NextResponse.json({ ok: false, error: 'Sponsor passport not found' }, { status: 404 });
      if (pp.persona_id && pp.persona_id !== persona.personaId) {
        return NextResponse.json({ ok: false, error: 'Caller does not own the sponsor passport' }, { status: 403 });
      }

      const proof = await generateProveKitProof('proof_of_delegation_authority', {
        delegationGrantId,
        sponsorPassportId,
        delegatedAgentDidUri,
        expiresAt,
      });
      return NextResponse.json({ ok: true, proof });
    }

    // Phase B circuits — return shaped placeholder. The proof generator
    // emits notYetImplemented=true in the response.
    const proof = await generateProveKitProof(
      circuit as 'proof_of_passport_standing',
      body as never,
    );
    return NextResponse.json({ ok: true, proof });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Attestation generation failed' },
      { status: 500 },
    );
  }
}
