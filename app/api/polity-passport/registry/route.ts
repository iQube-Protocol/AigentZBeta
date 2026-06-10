/**
 * GET /api/polity-passport/registry — public passport registry projection.
 *
 * Stage 5 (PRD §11, §12.3): the public listing of issued passports. The
 * projection is strictly public-safe:
 *   - passport_id, class, grade, per-class status, issued/expires timestamps
 *   - kybe_did_public_ref / persona_public_ref commitment hashes ONLY —
 *     never raw DIDs or persona ids (T0)
 *   - standing summary for participants; citizen rows additionally carry
 *     citizen_passport_irrevocable: true (Addendum D, a constitutional
 *     claim the public record must surface)
 *   - NO vault refs — encrypted-payload locations are holder-facing only
 *
 * Filters: ?class=citizen|agent_participant|… &status=<per-class status>
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

const CLASSES = ['citizen', 'agent_participant', 'robot_participant', 'organization_participant'];

export async function GET(req: NextRequest) {
  try {
    const admin = getSupabaseServer();
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: 'Supabase configuration missing' },
        { status: 500 },
      );
    }

    const url = new URL(req.url);
    const classFilter = url.searchParams.get('class');
    const statusFilter = url.searchParams.get('status');

    let query = admin
      .from('polity_passport_records')
      .select(
        'passport_id, passport_class, passport_grade, citizen_status, participant_status, persona_public_ref, kybe_did_public_ref, issued_at, expires_at, revoked, revoked_at',
      )
      .order('issued_at', { ascending: false })
      .limit(200);

    if (classFilter && CLASSES.includes(classFilter)) {
      query = query.eq('passport_class', classFilter);
    }
    if (statusFilter) {
      query = query.or(
        `citizen_status.eq.${statusFilter},participant_status.eq.${statusFilter}`,
      );
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      passports: (data ?? []).map((row) => {
        const isCitizen = row.passport_class === 'citizen';
        return {
          passportId: row.passport_id,
          passportClass: row.passport_class,
          passportGrade: row.passport_grade,
          passportStatus: isCitizen ? row.citizen_status : row.participant_status,
          personaPublicRef: row.persona_public_ref,
          kybeDidPublicRef: row.kybe_did_public_ref,
          issuedAt: row.issued_at,
          expiresAt: row.expires_at,
          ...(isCitizen
            ? { citizenPassportIrrevocable: true }
            : { revoked: Boolean(row.revoked), revokedAt: row.revoked_at }),
        };
      }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Registry lookup failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
