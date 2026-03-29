/**
 * KNYT Living Canon Branch API
 *
 * Entry point for the Living Canon tab in the KNYT Cartridge.
 * Returns branch summaries for Canon, Community, and Correspondent.
 *
 * Branch query: ?branch=canon|community|correspondent
 * Without ?branch: returns overview with all three branches summarised.
 *
 * World: 21 Sats (worldId = '21sats') — one active canonical community world at launch.
 *
 * Storage boundary:
 *   Canon items     — Supabase cache; authoritative record on Autodrive (CID stored in knyt_publication_states)
 *   Community items — Supabase only
 *   Correspondent   — Supabase only; editorialy surfaced
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WORLD_ID = '21sats';

async function getBranchItems(branch: string, limit = 20) {
  const { data, error } = await supabase
    .from('knyt_publication_states')
    .select('id, subject_type, subject_id, state, reviewed_at, elevated_at, autodrive_cid, created_at')
    .eq('branch', branch)
    .in('state', branch === 'canon' ? ['canon'] : ['approved', 'canon_eligible', 'canon'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

async function getOpenElections() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('knyt_elections')
    .select('id, title, votable_type, opens_at, closes_at, total_ballots_cast, per_voter_reward_knyt')
    .eq('world_id', WORLD_ID)
    .eq('status', 'open')
    .lte('opens_at', now)
    .gte('closes_at', now)
    .order('closes_at', { ascending: true })
    .limit(5);

  if (error) throw error;
  return data ?? [];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branch = searchParams.get('branch');

    if (branch) {
      if (!['canon', 'community', 'correspondent'].includes(branch)) {
        return NextResponse.json({ error: 'Invalid branch. Must be canon | community | correspondent' }, { status: 400 });
      }

      const items = await getBranchItems(branch);
      return NextResponse.json({
        world_id: WORLD_ID,
        branch,
        items,
        count: items.length,
      });
    }

    // Overview: all three branches + open elections
    const [canonItems, communityItems, correspondentItems, openElections] = await Promise.all([
      getBranchItems('canon', 5),
      getBranchItems('community', 10),
      getBranchItems('correspondent', 5),
      getOpenElections(),
    ]);

    return NextResponse.json({
      world_id: WORLD_ID,
      world_name: '21 Sats',
      active: true,
      branches: {
        canon: {
          label: 'Canon',
          items: canonItems,
          count: canonItems.length,
        },
        community: {
          label: 'Community',
          items: communityItems,
          count: communityItems.length,
        },
        correspondent: {
          label: 'Correspondent',
          items: correspondentItems,
          count: correspondentItems.length,
        },
      },
      open_elections: openElections,
    });
  } catch (err) {
    console.error('[living-canon] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
