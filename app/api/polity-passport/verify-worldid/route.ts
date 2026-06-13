/**
 * POST /api/polity-passport/verify-worldid
 *
 * Upgrades a Citizen Passport to "verified_citizen" grade using a World ID
 * proof. Per the 2026-06-13 hackathon-submission plan §Sprint 2.
 *
 * Body:
 *   {
 *     passportId: string,
 *     proof: { proof, merkle_root, nullifier_hash, verification_level, action?, signal? }
 *   }
 *
 * Flow:
 *   1. Resolve active persona via the spine.
 *   2. Verify the passport belongs to the caller (persona_id match).
 *   3. Verify the World ID proof via verifyWorldIdProof (Worldcoin Cloud
 *      Verifier or dev fallback).
 *   4. Persist nullifier_hash + verification_level + verified_at. Flip
 *      passport_grade to 'verified_citizen'. Unique index on
 *      nullifier_hash blocks the same human verifying a second passport.
 *   5. Return the updated passport summary.
 *
 * T0 discipline: persona_id queried server-side for the ownership check
 * only; never serialised in the response. nullifier_hash is T1-safe (ZK
 * commitment) so it lands in the response and the credential envelope.
 *
 * Non-verified passports remain first-class — this endpoint only adds
 * a badge, never demotes. PRD §6.1 contract.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { verifyWorldIdProof, type WorldIdProofPayload } from '@/services/passport/personhoodProof';

export const dynamic = 'force-dynamic';

interface VerifyRequest {
  passportId: string;
  proof: WorldIdProofPayload;
}

export async function POST(req: NextRequest) {
  try {
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = (await req.json()) as VerifyRequest;
    if (!body?.passportId || !body?.proof?.nullifier_hash) {
      return NextResponse.json(
        { ok: false, error: 'passportId and proof.nullifier_hash are required' },
        { status: 400 },
      );
    }

    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });
    }

    // 1. Fetch passport row + ownership check.
    const { data: record, error: lookupErr } = await admin
      .from('polity_passport_records')
      .select('passport_id, persona_id, passport_class, passport_grade, world_id_verified_at')
      .eq('passport_id', body.passportId)
      .maybeSingle();

    if (lookupErr) {
      return NextResponse.json({ ok: false, error: lookupErr.message }, { status: 500 });
    }
    if (!record) {
      return NextResponse.json({ ok: false, error: 'Passport not found' }, { status: 404 });
    }
    if (record.persona_id && record.persona_id !== persona.personaId) {
      return NextResponse.json(
        { ok: false, error: 'Caller does not own this passport' },
        { status: 403 },
      );
    }
    if (record.passport_class !== 'citizen') {
      return NextResponse.json(
        { ok: false, error: 'World ID upgrade only applies to citizen passports' },
        { status: 400 },
      );
    }
    if (record.world_id_verified_at) {
      return NextResponse.json(
        { ok: false, error: 'Passport already World ID verified' },
        { status: 409 },
      );
    }

    // 2. Verify the proof.
    const verification = await verifyWorldIdProof(body.proof);
    if (!verification.ok) {
      return NextResponse.json(
        { ok: false, error: verification.error ?? 'World ID verification failed' },
        { status: 400 },
      );
    }

    // 3. Stamp the row. Unique index on world_id_nullifier_hash will reject
    // the upsert if the same human tries to verify a second passport.
    const verifiedAt = new Date().toISOString();
    const { error: updateErr } = await admin
      .from('polity_passport_records')
      .update({
        passport_grade: 'verified_citizen',
        world_id_nullifier_hash: body.proof.nullifier_hash,
        world_id_verification_level: body.proof.verification_level,
        world_id_verified_at: verifiedAt,
      })
      .eq('passport_id', body.passportId);

    if (updateErr) {
      // Unique-violation == this nullifier already used on another row.
      if (updateErr.code === '23505' || updateErr.message.includes('uniq_pp_records_world_id_nullifier')) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'This World ID has already been used to verify a different Polity Passport. One human, one verified passport.',
          },
          { status: 409 },
        );
      }
      // Column-missing == migration hasn't been applied yet.
      if (updateErr.message.includes('world_id_nullifier_hash') || updateErr.message.includes('world_id_verified_at')) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'Pending migration: 20260613100000_passport_world_id_verification.sql must be applied in Supabase before World ID upgrades can persist.',
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      passportId: body.passportId,
      passportGrade: 'verified_citizen',
      worldIdVerificationLevel: body.proof.verification_level,
      worldIdNullifierHash: body.proof.nullifier_hash,
      verifiedAt,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'World ID verify failed' },
      { status: 500 },
    );
  }
}
