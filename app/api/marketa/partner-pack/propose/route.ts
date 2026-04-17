/**
 * POST /api/marketa/partner-pack/propose
 *
 * Accepts a partner's campaign brief, enriches it via Claude AI into a
 * full metaProof-structured pack, saves a draft to marketa.packs, and returns
 * the enriched pack for preview.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

// ── Marketa schema client ──────────────────────────────────────────────────────
function getMarketaClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { db: { schema: 'marketa' } });
}

// ── KNYT campaign system prompt (cached per cold start) ───────────────────────
const KNYT_SYSTEM_PROMPT = `You are Marketa, the AI campaign strategist for KNYT — 21 Awakenings.
KNYT is a graphic novel and NFT universe launching on Kickstarter. The campaign phases are:
- Launch: Initial momentum, founder story, early bird pledges
- Momentum: Social proof, community highlights, stretch goals
- Mid-Campaign Pulse: Midpoint energy boost, milestones unlocked
- Final 72 Hours: Urgency, last chance, community call-to-action
- Post-Campaign: Thank you, delivery updates, next chapter

Your role: Turn a partner's rough campaign brief into a full, structured campaign pack with:
1. A campaign name + tagline
2. 3 clear objectives (specific, partner-focused)
3. 2-3 metaProof milestones (measurable, time-bound: e.g. "Post 3× on LinkedIn by [date]", "Engage min 30 comments")
4. 1-2 copy variants per channel the partner selected (subject + body for newsletter; thread text for X; caption for Instagram/LinkedIn)
5. A KNYT reward estimate (KNYT tokens) and Qc (Qriptopian credits) based on effort/reach
6. A campaign_fit_score (0-100) based on how well the brief aligns with the KNYT campaign

Respond ONLY with valid JSON matching exactly this structure:
{
  "name": "string",
  "tagline": "string",
  "objectives": ["string", "string", "string"],
  "milestones": [
    { "title": "string", "description": "string", "metric": "string" }
  ],
  "copy_variants": [
    { "channel": "string", "subject": "string or null", "body": "string" }
  ],
  "reward_estimate": { "knyt": number, "qc": number },
  "campaign_fit_score": number
}`;

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: 'AI service not configured' }, { status: 503 });
  }

  let body: {
    partner_id: string;
    intent: string;
    channels: string[];
    timing?: string;
    angle?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { partner_id, intent, channels, timing, angle } = body;

  if (!partner_id) return NextResponse.json({ ok: false, error: 'partner_id required' }, { status: 400 });
  if (!intent?.trim()) return NextResponse.json({ ok: false, error: 'intent required' }, { status: 400 });
  if (!channels?.length) return NextResponse.json({ ok: false, error: 'channels required' }, { status: 400 });

  // Verify partner exists
  const { data: partner, error: partnerErr } = await supabase
    .from('avl_partner_contacts')
    .select('id, name, org, wave')
    .eq('id', partner_id)
    .single();

  if (partnerErr || !partner) {
    return NextResponse.json({ ok: false, error: 'Partner not found' }, { status: 404 });
  }

  // Build user message for Claude
  const userMessage = `Partner: ${partner.name} (${partner.org}), Wave ${partner.wave}
Channels: ${channels.join(', ')}
Intent: ${intent}${timing ? `\nTiming: ${timing}` : ''}${angle ? `\nAudience/Angle: ${angle}` : ''}

Build a complete campaign pack for this partner.`;

  // Call Anthropic API
  let enriched: {
    name: string;
    tagline: string;
    objectives: string[];
    milestones: Array<{ title: string; description: string; metric: string }>;
    copy_variants: Array<{ channel: string; subject: string | null; body: string }>;
    reward_estimate: { knyt: number; qc: number };
    campaign_fit_score: number;
  };

  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: KNYT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('[partner-pack/propose] Anthropic error:', errText);
      return NextResponse.json({ ok: false, error: 'AI enrichment failed' }, { status: 502 });
    }

    const aiData = await aiRes.json();
    const rawText = aiData.content?.[0]?.text ?? '';

    // Extract JSON from response (strip any markdown fences)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[partner-pack/propose] No JSON in AI response:', rawText);
      return NextResponse.json({ ok: false, error: 'AI returned invalid format' }, { status: 502 });
    }

    enriched = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[partner-pack/propose] AI call failed:', err);
    return NextResponse.json({ ok: false, error: 'AI enrichment failed' }, { status: 502 });
  }

  // Save draft pack to marketa schema
  const marketaClient = getMarketaClient();
  let packId = `draft_${Date.now()}`;

  if (marketaClient) {
    try {
      const { data: packRow, error: packErr } = await marketaClient
        .from('packs')
        .insert({
          name:               enriched.name,
          tagline:            enriched.tagline,
          status:             'draft',
          proposed_by:        partner_id,
          intent,
          channels:           JSON.stringify(channels),
          timing,
          angle,
          objectives:         JSON.stringify(enriched.objectives),
          milestones:         JSON.stringify(enriched.milestones),
          copy_variants:      JSON.stringify(enriched.copy_variants),
          reward_estimate:    JSON.stringify(enriched.reward_estimate),
          campaign_fit_score: enriched.campaign_fit_score,
        })
        .select('id')
        .single();

      if (!packErr && packRow) {
        packId = (packRow as { id: string }).id;
      } else {
        console.warn('[partner-pack/propose] Pack insert warning:', packErr?.message);
      }
    } catch (err) {
      console.warn('[partner-pack/propose] Could not persist pack:', err);
    }
  }

  return NextResponse.json({
    ok: true,
    pack: {
      id:                 packId,
      name:               enriched.name,
      tagline:            enriched.tagline,
      objectives:         enriched.objectives,
      milestones:         enriched.milestones,
      copy_variants:      enriched.copy_variants,
      reward_estimate:    enriched.reward_estimate,
      campaign_fit_score: enriched.campaign_fit_score,
    },
  });
}
