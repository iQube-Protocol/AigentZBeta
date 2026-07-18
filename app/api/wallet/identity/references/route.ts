/**
 * /api/wallet/identity/references — the owner-authenticated persona/agent
 * reference inventory (three-level reference model, 2026-07-18).
 *
 * GET  — the caller's complete identity inventory: every human persona,
 *        created agent persona, and citizen-bound delegate they own, each
 *        with its Private Persona UUID, Polity Public Reference, and any
 *        issued Pairwise External Service References.
 * POST — manage external refs: { personaId, audience } issues (idempotent),
 *        { personaId, audience, regenerate: true } rotates,
 *        { revokeRefId } revokes.
 *
 * T0 boundary note: this route DOES return raw persona UUIDs — deliberately.
 * It is a private, Bearer-authenticated OWNER SELF-VIEW, the same exposure
 * class as /api/wallet/persona (which already returns the caller's persona
 * ids). The client is the sovereign surface where an owner may see their own
 * BlakQube-secured identifiers. The T0 rule's enforcement boundary — DVN
 * receipts, chain payloads, locker metadata, persona broadcasts, the T1
 * active-persona surface — is untouched: nothing here feeds those paths.
 * Never call this route from any receipt/broadcast construction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import { getCallerIdentityContext } from '@/services/wallet/personaRepo';
import {
  issueExternalRef,
  listExternalRefs,
  pairwiseRefsEnabled,
  personaPublicRef,
  revokeExternalRef,
  type ExternalRefRow,
} from '@/services/identity/personaReferences';

export const dynamic = 'force-dynamic';

interface InventoryPersona {
  personaId: string;
  displayName: string | null;
  fioHandle: string | null;
  kind: 'human' | 'created_agent';
  status: string | null;
  publicRef: string;
  externalRefs: ExternalRefRow[];
}

interface InventoryAgent {
  /** The agent's identity persona UUID (agent_root_identity.agent_id). */
  agentPersonaId: string | null;
  /** The agent's wallet persona UUID (personas row, app_origin=aigent-me), when provisioned. */
  walletPersonaId: string | null;
  displayName: string | null;
  agentCardSlug: string | null;
  isAigentMe: boolean;
  bound: boolean;
  publicRef: string | null;
  walletPersonaPublicRef: string | null;
  externalRefs: ExternalRefRow[];
}

/** Resolve every persona UUID the caller owns (ownership set for POST checks). */
async function loadInventory(request: NextRequest) {
  const context = await getCallerIdentityContext(request);
  if (!context?.authProfileId) return null;
  const admin = getSupabaseServer();
  if (!admin) throw new Error('Supabase not configured');

  // Canonical cluster + active merged linked clusters (mirrors identity/profile).
  const clusterIds = [context.authProfileId];
  const { data: linkRows } = await admin
    .from('crm_auth_profile_links')
    .select('linked_auth_profile_id, relationship_mode, active')
    .eq('owner_auth_profile_id', context.authProfileId)
    .eq('active', true);
  for (const l of linkRows ?? []) {
    if ((l as Record<string, unknown>).relationship_mode === 'merged') {
      clusterIds.push(String((l as Record<string, unknown>).linked_auth_profile_id));
    }
  }

  const { data: personaRows } = await admin
    .from('personas')
    .select('id, display_name, fio_handle, app_origin, root_did, status, created_at')
    .in('auth_profile_id', clusterIds)
    .order('created_at', { ascending: true });
  const personas = personaRows ?? [];
  const personaIds = personas.map((p) => String(p.id));

  // Bound delegates: agents sponsored by any of the caller's personas.
  let agentRows: Record<string, unknown>[] = [];
  if (personaIds.length > 0) {
    const { data, error } = await admin
      .from('agent_root_identity')
      .select('id, agent_id, did_uri, display_name, agent_card_slug, is_aigent_me, bound_passport_id, sponsor_persona_id')
      .in('sponsor_persona_id', personaIds);
    if (!error) agentRows = data ?? [];
    else if (error.message.includes('is_aigent_me')) {
      const fallback = await admin
        .from('agent_root_identity')
        .select('id, agent_id, did_uri, display_name, agent_card_slug, bound_passport_id, sponsor_persona_id')
        .in('sponsor_persona_id', personaIds);
      agentRows = fallback.data ?? [];
    }
  }

  return { context, admin, personas, agentRows };
}

export async function GET(request: NextRequest) {
  try {
    const inv = await loadInventory(request);
    if (!inv) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { admin, personas, agentRows } = inv;

    const boundDids = new Set(agentRows.map((a) => String(a.did_uri)));

    // Wallet personas whose root_did matches a sponsored agent belong on the
    // agent's card (bound delegate), not the persona list.
    const walletPersonaByDid: Record<string, Record<string, unknown>> = {};
    const personaEntries: InventoryPersona[] = [];
    for (const p of personas) {
      const rootDid = (p.root_did as string | null) ?? null;
      const isAgentPersona = p.app_origin === 'aigent-me';
      if (isAgentPersona && rootDid && boundDids.has(rootDid)) {
        walletPersonaByDid[rootDid] = p as Record<string, unknown>;
        continue;
      }
      personaEntries.push({
        personaId: String(p.id),
        displayName: (p.display_name as string | null) ?? null,
        fioHandle: (p.fio_handle as string | null) ?? null,
        kind: isAgentPersona ? 'created_agent' : 'human',
        status: (p.status as string | null) ?? null,
        publicRef: personaPublicRef(String(p.id)),
        externalRefs: [],
      });
    }

    const agentEntries: InventoryAgent[] = agentRows.map((a) => {
      const agentPersonaId = a.agent_id ? String(a.agent_id) : null;
      const walletPersona = walletPersonaByDid[String(a.did_uri)];
      const walletPersonaId = walletPersona ? String(walletPersona.id) : null;
      return {
        agentPersonaId,
        walletPersonaId,
        displayName: (a.display_name as string | null) ?? null,
        agentCardSlug: (a.agent_card_slug as string | null) ?? null,
        isAigentMe: Boolean(a.is_aigent_me),
        bound: Boolean(a.bound_passport_id),
        publicRef: agentPersonaId ? personaPublicRef(agentPersonaId) : null,
        walletPersonaPublicRef: walletPersonaId ? personaPublicRef(walletPersonaId) : null,
        externalRefs: [],
      };
    });

    // Attach external refs across the whole inventory in one query.
    const allIds = [
      ...personaEntries.map((p) => p.personaId),
      ...agentEntries.flatMap((a) => [a.agentPersonaId, a.walletPersonaId].filter((x): x is string => Boolean(x))),
    ];
    const refs = await listExternalRefs(admin, allIds);
    const refsByPersona: Record<string, ExternalRefRow[]> = {};
    for (const r of refs) (refsByPersona[r.personaId] ??= []).push(r);
    for (const p of personaEntries) p.externalRefs = refsByPersona[p.personaId] ?? [];
    for (const a of agentEntries) {
      a.externalRefs = [
        ...(a.agentPersonaId ? refsByPersona[a.agentPersonaId] ?? [] : []),
        ...(a.walletPersonaId ? refsByPersona[a.walletPersonaId] ?? [] : []),
      ];
    }

    return NextResponse.json(
      {
        ok: true,
        pairwiseEnabled: pairwiseRefsEnabled(),
        personas: personaEntries,
        agents: agentEntries,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Inventory lookup failed' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const inv = await loadInventory(request);
    if (!inv) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { admin, personas, agentRows } = inv;

    const ownedIds = new Set<string>([
      ...personas.map((p) => String(p.id)),
      ...agentRows.map((a) => String(a.agent_id)).filter(Boolean),
    ]);

    const body = (await request.json().catch(() => ({}))) as {
      personaId?: string;
      audience?: string;
      regenerate?: boolean;
      revokeRefId?: string;
    };

    if (body.revokeRefId) {
      const ok = await revokeExternalRef(admin, body.revokeRefId, Array.from(ownedIds));
      if (!ok) return NextResponse.json({ ok: false, error: 'Reference not found or not yours' }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    if (!body.personaId || !body.audience) {
      return NextResponse.json({ ok: false, error: 'personaId and audience are required' }, { status: 400 });
    }
    if (!ownedIds.has(body.personaId)) {
      return NextResponse.json({ ok: false, error: 'Persona not in your inventory' }, { status: 403 });
    }
    if (!pairwiseRefsEnabled()) {
      return NextResponse.json(
        { ok: false, error: 'External references not configured (set PERSONA_PAIRWISE_REF_SECRET)' },
        { status: 503 },
      );
    }

    const ref = await issueExternalRef(admin, body.personaId, body.audience, {
      regenerate: Boolean(body.regenerate),
    });
    return NextResponse.json({ ok: true, ref });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Reference operation failed' },
      { status: 500 },
    );
  }
}
