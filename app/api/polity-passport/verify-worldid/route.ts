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
import { createActivityReceipt } from '@/services/receipts/activityReceiptService';

export const dynamic = 'force-dynamic';

interface VerifyRequest {
  passportId: string;
  proof: WorldIdProofPayload;
}

interface HardenResult {
  canonical: boolean;
  demotedSiblings: number;
  conversionCandidates: number;
  skipped?: 'migration_pending';
}

/**
 * Identity hardening sweep (Phase 1 / G3). Runs after the verified passport's
 * row has been stamped. Best-effort: any failure (typically the hardening
 * migration not yet applied) is logged and reported in the response under
 * `harden.skipped`, but does NOT roll back the World ID verification — the
 * verified_citizen grade alone is the operator-visible primary effect.
 *
 * Scope: linkable legacy duplicates only (same persona_id, root_identity_id,
 * or kybe_identity_id as the verified row). Cross-account duplicates are
 * inherently unlinkable here — surfaced to Bureau review in Phase 4.
 */
async function runHardeningSweep(
  admin: ReturnType<typeof getSupabaseServer>,
  callerPersonaId: string,
  verifiedPassportId: string,
): Promise<HardenResult> {
  if (!admin) return { canonical: false, demotedSiblings: 0, conversionCandidates: 0 };

  // Re-read with the identity FKs needed to find linkable siblings.
  const { data: verifiedRow, error: verifiedErr } = await admin
    .from('polity_passport_records')
    .select('id, passport_id, persona_id, root_identity_id, kybe_identity_id')
    .eq('passport_id', verifiedPassportId)
    .maybeSingle();
  if (verifiedErr || !verifiedRow) {
    return { canonical: false, demotedSiblings: 0, conversionCandidates: 0 };
  }

  // 1. Mark the verified row canonical. Migration-pending detection: if the
  //    column is missing, treat the whole sweep as skipped.
  const { error: canonicalErr } = await admin
    .from('polity_passport_records')
    .update({ canonical_citizen: true })
    .eq('passport_id', verifiedPassportId);
  if (canonicalErr) {
    if (canonicalErr.message.includes('canonical_citizen')) {
      console.warn('[hardening] migration 20260616000000 not applied; sweep skipped');
      return {
        canonical: false,
        demotedSiblings: 0,
        conversionCandidates: 0,
        skipped: 'migration_pending',
      };
    }
    console.error('[hardening] canonical flag write failed:', canonicalErr.message);
    return { canonical: false, demotedSiblings: 0, conversionCandidates: 0 };
  }

  // 2. Find linkable active sibling Citizen Passports.
  const linkageClauses: string[] = [];
  if (verifiedRow.persona_id) linkageClauses.push(`persona_id.eq.${verifiedRow.persona_id}`);
  if (verifiedRow.root_identity_id) linkageClauses.push(`root_identity_id.eq.${verifiedRow.root_identity_id}`);
  if (verifiedRow.kybe_identity_id) linkageClauses.push(`kybe_identity_id.eq.${verifiedRow.kybe_identity_id}`);
  if (linkageClauses.length === 0) {
    return { canonical: true, demotedSiblings: 0, conversionCandidates: 0 };
  }

  const { data: siblings } = await admin
    .from('polity_passport_records')
    .select('id, passport_id, persona_id, kybe_identity_id, citizen_status')
    .eq('passport_class', 'citizen')
    .in('citizen_status', ['active', 'renewal_due'])
    .neq('id', verifiedRow.id)
    .or(linkageClauses.join(','));

  if (!siblings || siblings.length === 0) {
    return { canonical: true, demotedSiblings: 0, conversionCandidates: 0 };
  }

  // 3. Demote each sibling + write audit + flag its Kybe for conversion + emit
  //    an anchorable receipt. All best-effort; the canonical election holds
  //    even if individual sibling writes fail (logged for operator follow-up).
  const verifiedAt = new Date().toISOString();
  let demotedSiblings = 0;
  const seenKybeIds = new Set<string>();

  for (const sibling of siblings) {
    const { error: demoteErr } = await admin
      .from('polity_passport_records')
      .update({
        citizen_status: 'superseded_non_canonical',
        canonical_citizen: false,
      })
      .eq('id', sibling.id);
    if (demoteErr) {
      console.error('[hardening] sibling demote failed', sibling.passport_id, demoteErr.message);
      continue;
    }
    demotedSiblings += 1;

    // Audit trail (reuse passport_status_transitions — the canonical audit log).
    await admin
      .from('passport_status_transitions')
      .insert({
        passport_record_id: sibling.id,
        from_status: sibling.citizen_status,
        to_status: 'superseded_non_canonical',
        passport_class: 'citizen',
        actor_type: 'system',
        actor_id: callerPersonaId,
        reason: 'World ID hardening: non-canonical Citizen Passport demoted at uniqueness verification',
        evidence_type: 'world_id_hardening',
        receipt_action: 'passport_status_changed',
        transitioned_at: verifiedAt,
      });

    // Activity receipt — rides the canonical anchorable pipeline.
    try {
      await createActivityReceipt({
        personaId: callerPersonaId,
        activeCartridge: 'polity-passport-bureau',
        actionType: 'passport_status_changed',
        summary: `Citizen Passport ${sibling.passport_id} demoted (superseded_non_canonical) by hardening event on ${verifiedPassportId}`,
      });
    } catch (e) {
      console.error('[hardening] receipt write failed:', e);
    }

    if (sibling.kybe_identity_id) seenKybeIds.add(String(sibling.kybe_identity_id));
  }

  // 4. Flag the demoted siblings' Kybe DIDs as agent-conversion candidates.
  let conversionCandidates = 0;
  if (seenKybeIds.size > 0) {
    const { data: flagged, error: flagErr } = await admin
      .from('kybe_identity')
      .update({
        agent_conversion_candidate: true,
        agent_conversion_candidate_at: verifiedAt,
      })
      .in('id', Array.from(seenKybeIds))
      .eq('agent_conversion_candidate', false)
      .select('id');
    if (flagErr) {
      if (!flagErr.message.includes('agent_conversion_candidate')) {
        console.error('[hardening] kybe candidate flag failed:', flagErr.message);
      }
    } else {
      conversionCandidates = flagged?.length ?? 0;
    }
  }

  return { canonical: true, demotedSiblings, conversionCandidates };
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

    // 4. Identity hardening sweep — best-effort; never rolls back verification.
    const harden = await runHardeningSweep(admin, persona.personaId, body.passportId);

    return NextResponse.json({
      ok: true,
      passportId: body.passportId,
      passportGrade: 'verified_citizen',
      worldIdVerificationLevel: body.proof.verification_level,
      worldIdNullifierHash: body.proof.nullifier_hash,
      verifiedAt,
      harden,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'World ID verify failed' },
      { status: 500 },
    );
  }
}
