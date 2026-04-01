/**
 * KNYT Liquid UI API for Lovable Integration
 *
 * Provides template selection and rendering data for the Lovable thin client.
 * Returns the full template list and, for POST requests, resolves the right
 * template for the current intent and injects live data context.
 *
 * Templates:
 *   knyt:drawer_grid_v1         — grid browse layout (Codex home, Lore)
 *   knyt:motion_stage_v1        — immersive motion stage (Scrolls, DigiTerra)
 *   knyt:dual_poster_stage_v1   — character poster grid (Characters)
 *   knyt:realm_bridge_map_v1    — realm map (Terra)
 *   knyt:quest_hud_hub_v1       — Order of Metaiye HUD (Order tab)
 *   knyt:living_canon_v1        — Living Canon branch view (21 Sats tab)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEMPLATES = [
  {
    template_id: 'knyt:drawer_grid_v1',
    name: 'Drawer Grid',
    description: 'Grid layout for browse and discovery',
    supported_intents: ['browse', 'discover', 'read'],
    supported_devices: ['mobile', 'tablet', 'desktop'],
  },
  {
    template_id: 'knyt:motion_stage_v1',
    name: 'Motion Stage',
    description: 'Immersive stage for motion and episode content',
    supported_intents: ['watch', 'immerse'],
    supported_devices: ['tablet', 'desktop'],
  },
  {
    template_id: 'knyt:dual_poster_stage_v1',
    name: 'Dual Poster Stage',
    description: 'Character poster and card display',
    supported_intents: ['browse', 'characters'],
    supported_devices: ['mobile', 'tablet', 'desktop'],
  },
  {
    template_id: 'knyt:realm_bridge_map_v1',
    name: 'Realm Bridge Map',
    description: 'Realm navigation map for Terra/DigiTerra',
    supported_intents: ['navigate', 'explore'],
    supported_devices: ['tablet', 'desktop'],
  },
  {
    template_id: 'knyt:quest_hud_hub_v1',
    name: 'Quest HUD Hub',
    description: 'Order of Metaiye progression, quests, and status',
    supported_intents: ['progress', 'earn', 'order'],
    supported_devices: ['mobile', 'tablet', 'desktop'],
  },
  {
    template_id: 'knyt:living_canon_v1',
    name: 'Living Canon',
    description: 'Canon / Community / Correspondent branch view for 21 Sats',
    supported_intents: ['canon', 'participate', 'contribute', 'vote'],
    supported_devices: ['mobile', 'tablet', 'desktop'],
  },
];

function selectTemplate(intent: string): typeof TEMPLATES[number] {
  if (intent === 'watch' || intent === 'immerse')      return TEMPLATES[1]; // motion_stage
  if (intent === 'characters')                         return TEMPLATES[2]; // dual_poster
  if (intent === 'navigate' || intent === 'explore')   return TEMPLATES[3]; // realm_bridge
  if (intent === 'progress' || intent === 'earn' || intent === 'order') return TEMPLATES[4]; // quest_hud
  if (intent === 'canon' || intent === 'participate' || intent === 'contribute' || intent === 'vote') return TEMPLATES[5]; // living_canon
  return TEMPLATES[0]; // default: drawer_grid
}

async function getOrderContext(personaId: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '') ?? ''}/api/codex/knyt/order?persona_id=${personaId}`,
      { headers: { 'x-internal': '1' }, cache: 'no-store' }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getLivingCanonContext() {
  try {
    const now = new Date().toISOString();
    const { data: elections } = await supabase
      .from('knyt_elections')
      .select('id, title, votable_type, closes_at, total_ballots_cast, per_voter_reward_knyt')
      .eq('world_id', '21sats')
      .eq('status', 'open')
      .lte('opens_at', now)
      .gte('closes_at', now)
      .limit(3);

    const { data: recentCanon } = await supabase
      .from('knyt_publication_states')
      .select('id, subject_type, state, elevated_at')
      .eq('branch', 'canon')
      .eq('state', 'canon')
      .order('elevated_at', { ascending: false })
      .limit(5);

    return { open_elections: elections ?? [], recent_canon: recentCanon ?? [] };
  } catch {
    return { open_elections: [], recent_canon: [] };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { intent, deviceType, personaId, data } = await request.json();

    const selectedTemplate = selectTemplate(intent ?? 'browse');
    let liveContext: Record<string, unknown> = {};

    // Inject live context for Order and Living Canon templates
    if (selectedTemplate.template_id === 'knyt:quest_hud_hub_v1' && personaId) {
      const orderCtx = await getOrderContext(personaId);
      if (orderCtx) liveContext = { order: orderCtx };
    }

    if (selectedTemplate.template_id === 'knyt:living_canon_v1') {
      const canonCtx = await getLivingCanonContext();
      liveContext = { living_canon: canonCtx };
    }

    return NextResponse.json({
      success: true,
      template: selectedTemplate,
      data: { ...data, intent, deviceType, personaId, ...liveContext },
      context: { userIntent: intent ?? 'browse', device: deviceType ?? 'desktop' },
    });
  } catch (error) {
    console.error('[knyt/liquid-ui POST] error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    templates: TEMPLATES,
    integration: {
      name: 'KNYT Liquid UI',
      version: '2.0.0',
      supportedIntents: TEMPLATES.flatMap((t) => t.supported_intents),
      supportedDevices: ['mobile', 'tablet', 'desktop'],
    },
    capabilities: {
      liquid_ui: true,
      thin_client: true,
      commerce: true,
      real_time_balance: true,
      purchase_webhooks: true,
      living_canon: true,
      order_progression: true,
      voting: true,
    },
  });
}
