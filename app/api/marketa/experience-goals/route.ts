/**
 * GET /api/marketa/experience-goals?cartridge=knyt
 *
 * Returns experience goals scoped to a cartridge via its linked strategy.
 * Other cartridges are stubbed — returns [] until their strategies are seeded.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

// Maps cartridge slug → strategy name fragment (case-insensitive match)
const CARTRIDGE_STRATEGY: Record<string, string> = {
  knyt:        'KNYT',
  qriptopian:  'Qriptopian',   // stub — no strategy seeded yet
  agentiq:     'AgentiQ',      // stub
  metame:      'metaMe',       // stub
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cartridge = (searchParams.get('cartridge') ?? 'knyt').toLowerCase();

  const strategyFragment = CARTRIDGE_STRATEGY[cartridge];
  if (!strategyFragment) {
    return NextResponse.json({ ok: true, goals: [], cartridge, note: 'Unknown cartridge' });
  }

  const supabase = getSupabaseServer();
  if (!supabase) return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });

  // Find strategies matching this cartridge
  const { data: strategies } = await supabase
    .from('experience_strategies')
    .select('id, name')
    .ilike('name', `%${strategyFragment}%`)
    .eq('active', true);

  if (!strategies?.length) {
    return NextResponse.json({ ok: true, goals: [], cartridge, note: 'No strategy found — cartridge may not be seeded yet' });
  }

  const strategyIds = strategies.map((s) => s.id);

  const { data: goals, error } = await supabase
    .from('experience_goals')
    .select('id, title, goal_type, success_status, strategy_id')
    .in('strategy_id', strategyIds)
    .order('goal_type', { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, goals: goals ?? [], cartridge });
}
