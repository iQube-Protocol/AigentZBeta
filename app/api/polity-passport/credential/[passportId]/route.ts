/**
 * GET  /api/polity-passport/credential/[passportId] — preview the passport
 *      credential envelope (Phase A). Does NOT mark as claimed.
 * POST /api/polity-passport/credential/[passportId] — claim the passport
 *      credential, mark credential_claimed_at, and return the VC.
 *
 * W3C-VC-shaped JSON envelope the agent/operator holds. Issued lazily from the
 * passport record — steward pipeline untouched. Public route: every field in
 * the envelope already appears in the public registry projection (commitment
 * refs only; T0 identifiers never serialise here).
 *
 * Claimable states — citizen: active / renewal_due; participant: approved /
 * provisionally_issued / restricted, and not revoked. Anything else → 409
 * with the reason, so callers can distinguish "not yet" from "not found".
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import {
  buildPassportCredential,
  isClaimable,
  type PassportRecordRow,
} from '@/services/passport/passportCredential';
import { publicOrigin } from '@/utils/publicOrigin';

export const dynamic = 'force-dynamic';

// persona_id is T0 — selected for the server-side ownership gate on POST
// only; it never serialises into the credential or any response body.
// credential_claimed_at ships in migration 20260612100000 — until the
// operator runs it, fall back to the legacy column set so the public
// credential GET (live since Phase A) keeps working.
const SELECT_COLS =
  'passport_id, passport_class, citizen_status, participant_status, passport_grade, kybe_did_public_ref, persona_public_ref, registry_record_id, issuer_id, issued_at, expires_at, revoked, credential_claimed_at, persona_id';
const SELECT_COLS_LEGACY =
  'passport_id, passport_class, citizen_status, participant_status, passport_grade, kybe_did_public_ref, persona_public_ref, registry_record_id, issuer_id, issued_at, expires_at, revoked, persona_id';

function isMissingClaimColumn(message: string | undefined) {
  return !!message && message.includes('credential_claimed_at');
}

async function loadAndBuild(passportId: string, admin: ReturnType<typeof getSupabaseServer>, host: string) {
  let migrated = true;
  let { data, error } = await admin!
    .from('polity_passport_records')
    .select(SELECT_COLS)
    .eq('passport_id', passportId)
    .maybeSingle();
  if (error && isMissingClaimColumn(error.message)) {
    migrated = false;
    ({ data, error } = await admin!
      .from('polity_passport_records')
      .select(SELECT_COLS_LEGACY)
      .eq('passport_id', passportId)
      .maybeSingle());
  }
  if (error) return { err: NextResponse.json({ ok: false, error: error.message }, { status: 500 }) };
  if (!data) return { err: NextResponse.json({ ok: false, error: 'Passport not found' }, { status: 404 }) };

  const record = data as unknown as PassportRecordRow & { credential_claimed_at?: string | null };
  const claim = isClaimable(record);
  if (!claim.claimable) {
    return { err: NextResponse.json({ ok: false, error: 'Passport not claimable', reason: claim.reason }, { status: 409 }) };
  }
  return { record, migrated, credential: buildPassportCredential(record, host) };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ passportId: string }> },
) {
  try {
    const { passportId } = await context.params;
    if (!/^[a-z0-9-]{4,80}$/i.test(passportId)) {
      return NextResponse.json({ ok: false, error: 'Invalid passport id' }, { status: 400 });
    }
    const admin = getSupabaseServer();
    if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

    const result = await loadAndBuild(passportId, admin, publicOrigin(req));
    if (result.err) return result.err;

    return NextResponse.json(
      {
        ok: true,
        credential: result.credential,
        claimed: !!result.record!.credential_claimed_at,
        note: 'Hold this envelope — it is your passport credential. Phase A proof is a Bureau HMAC stub; a publicly verifiable asymmetric proof ships in Phase C.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Credential fetch failed' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ passportId: string }> },
) {
  try {
    const { passportId } = await context.params;
    if (!/^[a-z0-9-]{4,80}$/i.test(passportId)) {
      return NextResponse.json({ ok: false, error: 'Invalid passport id' }, { status: 400 });
    }
    const admin = getSupabaseServer();
    if (!admin) return NextResponse.json({ ok: false, error: 'Supabase configuration missing' }, { status: 500 });

    // Claiming mutates the record — gate on the holder. The preview GET
    // stays public (capability of knowing the passportId; envelope is
    // public-safe), but only the bound persona may flip the claimed flag.
    const persona = await getActivePersona(req);
    if (!persona?.personaId) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const result = await loadAndBuild(passportId, admin, publicOrigin(req));
    if (result.err) return result.err;

    // Sponsor-custodian authorization (Phase 1 / G2): a polity_bound agent has
    // no spine session of its own, so the citizen who sponsors it may claim the
    // agent's Participant Passport on its behalf. Resolve sponsorship up front
    // via the application's agent_card_url → agent_root_identity.sponsor_persona_id
    // (also reused below to bind bound_passport_id). This ADDS an authorized
    // principal — the verified sponsor — without weakening the holder gate.
    let sponsorCustodian = false;
    let agentCardUrl: string | null = null;
    if (result.record!.passport_class !== 'citizen') {
      const { data: appRow } = await admin
        .from('polity_passport_applications')
        .select('agent_card_url')
        .eq('passport_id', passportId)
        .not('agent_card_url', 'is', null)
        .maybeSingle();
      agentCardUrl = appRow?.agent_card_url ?? null;
      if (agentCardUrl) {
        const { data: agentRow } = await admin
          .from('agent_root_identity')
          .select('sponsor_persona_id')
          .eq('agent_card_url', agentCardUrl)
          .maybeSingle();
        if (agentRow?.sponsor_persona_id && agentRow.sponsor_persona_id === persona.personaId) {
          sponsorCustodian = true;
        }
      }
    }

    const recordPersonaId = (result.record as unknown as { persona_id: string | null }).persona_id;
    if (recordPersonaId && recordPersonaId !== persona.personaId && !sponsorCustodian) {
      return NextResponse.json(
        { ok: false, error: 'Passport is not held by the active persona' },
        { status: 403 },
      );
    }

    if (!result.migrated) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Claim storage not migrated',
          detail: 'Run migration 20260612100000_passport_credential_claimed.sql in Supabase to enable passport claiming.',
        },
        { status: 503 },
      );
    }

    if (!result.record!.credential_claimed_at) {
      await admin
        .from('polity_passport_records')
        .update({ credential_claimed_at: new Date().toISOString() })
        .eq('passport_id', passportId);

      // Bind participant passports to their agent_root_identity.
      // Look up the application by passport_id to find the agent_card_url,
      // then update agent_root_identity.bound_passport_id so the sponsor
      // can see the agent's passport in their "Sponsored Agents" view.
      if (result.record!.passport_class !== 'citizen' && agentCardUrl) {
        try {
          await admin
            .from('agent_root_identity')
            .update({ bound_passport_id: passportId })
            .eq('agent_card_url', agentCardUrl)
            .is('bound_passport_id', null);
        } catch {
          // Non-fatal — binding is best-effort during claim.
          // The sponsor can still see the passport via the registry.
        }
      }
    }

    return NextResponse.json(
      {
        ok: true,
        credential: result.credential,
        claimed: true,
        note: 'Passport credential claimed and stored as a PassportQube in your wallet.',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Credential claim failed' }, { status: 500 });
  }
}
