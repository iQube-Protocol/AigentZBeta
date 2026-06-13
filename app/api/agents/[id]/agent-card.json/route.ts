/**
 * GET /api/agents/[id]/agent-card.json
 *
 * Dynamic Agent Card endpoint for any polity_bound agent created via
 * /api/agents/genesis. Reads from agent_root_identity by agent_card_slug
 * and renders an A2A-shape Agent Card JSON.
 *
 * Hand-curated cards (e.g. /api/agents/aletheon — Aletheon's canonical
 * card at app/api/agents/aletheon/route.ts) take precedence for their
 * own path and are not affected by this route.
 *
 * Per the 2026-06-13 hackathon plan §Sprint 3: every genesised agent
 * gets a stable card URL at /api/agents/<slug>/agent-card.json. This
 * route is the publisher.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id: slug } = await params;

  const admin = getSupabaseServer();
  if (!admin) {
    return withCors(
      NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 }),
    );
  }

  const { data: row, error } = await admin
    .from('agent_root_identity')
    .select('agent_id, did_uri, agent_class, display_name, description, agent_card_url, agent_card_slug, sponsor_passport_id, bound_passport_id, created_at, updated_at')
    .eq('agent_card_slug', slug)
    .maybeSingle();

  if (error && error.message.includes('agent_card_slug')) {
    return withCors(
      NextResponse.json(
        {
          error:
            'Pending migration: 20260613200000_agent_genesis_polity_bound.sql must be applied in Supabase before genesised agent cards can render.',
        },
        { status: 503 },
      ),
    );
  }
  if (error) {
    return withCors(NextResponse.json({ error: error.message }, { status: 500 }));
  }
  if (!row) {
    return withCors(NextResponse.json({ error: 'Agent not found', slug }, { status: 404 }));
  }

  // T0 discipline: only public fields land in the card. sponsor_persona_id
  // never serialises. sponsor_passport_id is T1-safe (the passport itself
  // is a public registry record).
  return withCors(
    NextResponse.json({
      // A2A Agent Card shape
      name: row.display_name,
      description: row.description,
      url: row.agent_card_url,
      version: '0.1.0',

      provider: {
        organization: 'Polity Bound Agent',
        url: row.agent_card_url,
      },

      capabilities: {
        streaming: false,
        pushNotifications: false,
        stateTransitionHistory: true,
      },
      defaultInputModes: ['text/plain'],
      defaultOutputModes: ['text/plain'],

      // Skills default to empty — the wizard captures these in a follow-up;
      // for genesis we ship the bare minimum so the card resolves.
      skills: [],

      metadata: {
        agent_class: row.agent_class,
        agent_id: row.agent_id,
        did_uri: row.did_uri,
        agent_card_slug: row.agent_card_slug,
        sponsor_passport_id: row.sponsor_passport_id,
        bound_passport_id: row.bound_passport_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        constitutional_alignment:
          'Polity Bound — agent acts only via bounded delegation under its sponsoring citizen passport. Decoupling to polity_autonomous requires admin governance.',
        supports_delegation: true,
        requires_human_approval: true,
      },

      registry_entry: {
        class: 'Agent Participant',
        holder: row.display_name,
        agent_class: row.agent_class,
        sponsor: row.sponsor_passport_id ?? 'Polity',
        canonical_function: 'Bounded Delegate',
        status: row.bound_passport_id ? 'Passport Issued' : 'Pending Passport Issuance',
      },
    }),
  );
}
