/**
 * KNYT Living Canon — Reactions
 *
 * Lightweight engagement signals on publication states.
 * Toggles: posting the same reaction twice removes it.
 *
 * Reaction types:
 *   spark       — "this sparked an idea" (high-quality engagement signal)
 *   like        — simple positive signal
 *   question    — "I have a question about this"
 *   canon_worthy — community endorsement for elevation consideration
 *
 * POST /api/codex/knyt/living-canon/react
 *   body: { publication_id, persona_id, reaction_type }
 *   Returns: { action: 'added' | 'removed', counts }
 *
 * GET /api/codex/knyt/living-canon/react?publication_id=<id>[&persona_id=<id>]
 *   Returns: { counts, persona_reactions[] }
 *
 * Aggregate counts are computed on read (no denormalised counter needed
 * at this scale — add a materialized view if throughput demands it).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_REACTIONS = ['spark', 'like', 'question', 'canon_worthy'] as const;
type ReactionType = typeof VALID_REACTIONS[number];

async function getReactionCounts(publicationId: string) {
  const { data } = await supabase
    .from('knyt_reactions')
    .select('reaction_type')
    .eq('publication_id', publicationId);

  const counts: Record<ReactionType, number> = {
    spark: 0, like: 0, question: 0, canon_worthy: 0,
  };
  for (const row of data ?? []) {
    if (row.reaction_type in counts) {
      counts[row.reaction_type as ReactionType]++;
    }
  }
  return counts;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { publication_id, persona_id, reaction_type } = body;

    if (typeof publication_id !== 'string' || !publication_id)
      return NextResponse.json({ error: 'publication_id is required' }, { status: 400 });
    if (typeof persona_id !== 'string' || !persona_id)
      return NextResponse.json({ error: 'persona_id is required' }, { status: 400 });
    if (!VALID_REACTIONS.includes(reaction_type as ReactionType))
      return NextResponse.json(
        { error: `reaction_type must be one of: ${VALID_REACTIONS.join(', ')}` },
        { status: 400 }
      );

    // Verify publication exists
    const { data: pub } = await supabase
      .from('knyt_publication_states')
      .select('id, state')
      .eq('id', publication_id)
      .maybeSingle();

    if (!pub) return NextResponse.json({ error: 'Publication not found' }, { status: 404 });

    // Toggle: check if reaction already exists
    const { data: existing } = await supabase
      .from('knyt_reactions')
      .select('id')
      .eq('publication_id', publication_id)
      .eq('persona_id', persona_id)
      .eq('reaction_type', reaction_type)
      .maybeSingle();

    let action: 'added' | 'removed';

    if (existing) {
      // Remove (toggle off)
      await supabase.from('knyt_reactions').delete().eq('id', existing.id);
      action = 'removed';
    } else {
      // Add reaction
      const { error: insertErr } = await supabase.from('knyt_reactions').insert({
        publication_id,
        persona_id,
        reaction_type,
      });
      if (insertErr) throw insertErr;
      action = 'added';
    }

    const counts = await getReactionCounts(publication_id);

    return NextResponse.json({ success: true, action, counts });
  } catch (err) {
    console.error('[living-canon/react] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const publicationId = searchParams.get('publication_id');
    const personaId = searchParams.get('persona_id');

    if (!publicationId)
      return NextResponse.json({ error: 'publication_id query param required' }, { status: 400 });

    const counts = await getReactionCounts(publicationId);

    // If persona provided, return their specific reactions for this publication
    let personaReactions: ReactionType[] = [];
    if (personaId) {
      const { data } = await supabase
        .from('knyt_reactions')
        .select('reaction_type')
        .eq('publication_id', publicationId)
        .eq('persona_id', personaId);
      personaReactions = (data ?? []).map((r) => r.reaction_type as ReactionType);
    }

    return NextResponse.json({
      publication_id: publicationId,
      counts,
      persona_reactions: personaReactions,
    });
  } catch (err) {
    console.error('[living-canon/react GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
