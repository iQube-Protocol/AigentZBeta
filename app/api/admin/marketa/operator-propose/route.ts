/**
 * POST /api/admin/marketa/operator-propose
 *
 * Operator-authored campaign proposal. Mirrors the partner propose flow but
 * tags the resulting pack with origin='operator', records the chosen cohort,
 * and returns the cohort's resolved recipient count so the operator can
 * confirm reach before triggering the send.
 *
 * Body: {
 *   personaId: string,         // operator's persona id (for audit)
 *   intent: string,            // campaign brief
 *   channels: string[],        // selected channels
 *   timing?: string,
 *   angle?: string,
 *   cohort_id: string,         // 'crm-investors' | 'zero-knyt-holders' | …
 * }
 *
 * Reuses the same Anthropic-enrichment + marketa.packs insert as the partner
 * route, but stamps the pack with origin metadata so the approval queue can
 * distinguish operator submissions.
 *
 * GET also supported — returns the static COHORT_REGISTRY (for the form).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { COHORT_REGISTRY, resolveCohort } from '@/services/campaign/cohortResolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getMarketaClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { db: { schema: 'marketa' } });
}

const KNYT_SYSTEM_PROMPT = `You are Marketa, the operator-side AI campaign strategist for KNYT.
Operators are authoring activation emails / campaigns to specific cohorts (CRM investors, Zero KNYT holders, KS backers, all personas).
Build a complete pack with: name, tagline, 3 objectives, 2-3 milestones, 1-2 copy variants per channel, reward estimate (KNYT + Qc), campaign_fit_score (0-100).
Respond ONLY with valid JSON exactly matching:
{
  "name": "string",
  "tagline": "string",
  "objectives": ["string", "string", "string"],
  "milestones": [{ "title": "string", "description": "string", "metric": "string" }],
  "copy_variants": [{ "channel": "string", "subject": "string or null", "body": "string" }],
  "reward_estimate": { "knyt": number, "qc": number },
  "campaign_fit_score": number
}`;

export async function GET() {
  return NextResponse.json({ cohorts: COHORT_REGISTRY });
}

export async function POST(req: NextRequest) {
  let body: {
    personaId: string;
    intent: string;
    channels: string[];
    timing?: string;
    angle?: string;
    cohort_id: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { personaId, intent, channels, timing, angle, cohort_id } = body;
  if (!personaId)            return NextResponse.json({ ok: false, error: 'personaId required' }, { status: 400 });
  if (!intent?.trim())       return NextResponse.json({ ok: false, error: 'intent required' },    { status: 400 });
  if (!channels?.length)     return NextResponse.json({ ok: false, error: 'channels required' },  { status: 400 });
  if (!cohort_id)            return NextResponse.json({ ok: false, error: 'cohort_id required' }, { status: 400 });

  const cohortKnown = COHORT_REGISTRY.some((c) => c.id === cohort_id);
  if (!cohortKnown) return NextResponse.json({ ok: false, error: `Unknown cohort: ${cohort_id}` }, { status: 400 });

  // Resolve cohort to a recipient count + sample
  const cohortPreview = await resolveCohort(cohort_id);

  // AI enrichment — same flow as partner-pack/propose
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: 'AI service not configured' }, { status: 503 });
  }

  const userMessage = `Operator campaign brief.
Cohort: ${cohort_id}
Channels: ${channels.join(', ')}
Intent: ${intent}${timing ? `\nTiming: ${timing}` : ''}${angle ? `\nAudience/Angle: ${angle}` : ''}

Build a complete operator-grade campaign pack.`;

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
      console.error('[operator-propose] Anthropic error:', errText);
      return NextResponse.json({ ok: false, error: 'AI enrichment failed' }, { status: 502 });
    }
    const aiData = await aiRes.json();
    const rawText = aiData.content?.[0]?.text ?? '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ ok: false, error: 'AI returned invalid format' }, { status: 502 });
    enriched = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[operator-propose] AI call failed:', err);
    return NextResponse.json({ ok: false, error: 'AI enrichment failed' }, { status: 502 });
  }

  // Persist to marketa.packs with origin='operator' + cohort metadata
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
          proposed_by:        personaId,
          intent,
          channels:           JSON.stringify(channels),
          timing,
          angle,
          objectives:         JSON.stringify(enriched.objectives),
          milestones:         JSON.stringify(enriched.milestones),
          copy_variants:      JSON.stringify(enriched.copy_variants),
          reward_estimate:    JSON.stringify(enriched.reward_estimate),
          campaign_fit_score: enriched.campaign_fit_score,
          admin_notes:        JSON.stringify({
            origin: 'operator',
            cohort_id,
            cohort_resolved_count: cohortPreview.count,
            authored_at: new Date().toISOString(),
          }),
        })
        .select('id')
        .single();

      if (!packErr && packRow) packId = (packRow as { id: string }).id;
      else console.warn('[operator-propose] Pack insert warning:', packErr?.message);
    } catch (err) {
      console.warn('[operator-propose] Could not persist pack:', err);
    }
  }

  return NextResponse.json({
    ok: true,
    pack: {
      id: packId,
      name: enriched.name,
      tagline: enriched.tagline,
      objectives: enriched.objectives,
      milestones: enriched.milestones,
      copy_variants: enriched.copy_variants,
      reward_estimate: enriched.reward_estimate,
      campaign_fit_score: enriched.campaign_fit_score,
    },
    cohort: {
      id: cohort_id,
      count: cohortPreview.count,
      samplePersonaIds: cohortPreview.samplePersonaIds,
    },
  });
}
