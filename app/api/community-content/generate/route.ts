/**
 * POST /api/community-content/generate
 *
 * Body: {
 *   personaId:           string (required)
 *   skill:               'article' | 'story'
 *   prompt:              string (required)
 *   title?:              string
 *   sourceExperienceId?: string  // capsule the user remixed from
 *   parentId?:           string  // parent community-content row (lineage)
 * }
 *
 * Flow:
 *   1. Resolve Q¢ cost using community_content_settings + community_content_quotas.
 *      Free if quota remaining, else base × (1 + surcharge_pct/100).
 *   2. Debit Q¢ from qc_balances. Bail with 402 if insufficient.
 *   3. Generate text (article or story) with KNYT persona context injected.
 *   4. Generate image with the same prompt.
 *   5. Insert community_generated_content row (status='draft').
 *   6. Bump community_content_quotas.
 *   7. Return { id, title, body, image_url, qc_cost, refundable_until }.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCommunityContentSupabase,
  loadKnytPersonaContext,
} from '../_lib/personaContext';
import {
  type Skill,
  generateText,
  generateImage,
  debitQc,
} from '../_lib/generate';
import { getActivePersona } from '@/services/identity/getActivePersona';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  personaId?: string;
  skill?: Skill;
  prompt?: string;
  title?: string;
  sourceExperienceId?: string;
  parentId?: string;
  /** 'auto' (default) | 'dvn' — client picks 'dvn' when the user
      explicitly chose "Pay from DVN balance" instead of going through
      the on-chain wallet flow. */
  paymentMode?: 'auto' | 'dvn';
}

interface Settings {
  cost_qc_article: number;
  cost_qc_story: number;
  surcharge_pct: number;
  daily_free_quota: number;
  discard_window_seconds: number;
}

const FALLBACK_SETTINGS: Settings = {
  cost_qc_article: 10,
  cost_qc_story: 6,
  surcharge_pct: 50,
  daily_free_quota: 3,
  discard_window_seconds: 30,
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  // Resolve persona via the canonical spine when the body doesn't carry one.
  // Client surfaces (e.g. RemixDialog) may post without personaId once the
  // client-side sign-in gate is disabled; identity then flows from the
  // Authorization: Bearer token per CLAUDE.md § Identity & Access Spine.
  let personaId = body.personaId?.trim();
  if (!personaId) {
    try {
      const activePersona = await getActivePersona(req);
      personaId = activePersona?.personaId;
    } catch {
      // spine resolution failed — fall through to 401 below
    }
  }
  const prompt = body.prompt?.trim();
  const skill: Skill = body.skill === 'story' ? 'story' : 'article';

  if (!personaId) return NextResponse.json({ ok: false, error: 'sign-in required' }, { status: 401 });
  if (!prompt)    return NextResponse.json({ ok: false, error: 'prompt required' },    { status: 400 });
  if (prompt.length > 2000) return NextResponse.json({ ok: false, error: 'prompt too long (max 2000 chars)' }, { status: 400 });

  const supabase = getCommunityContentSupabase();

  // 1. Settings + quota
  const [settingsResult, quotaResult] = await Promise.all([
    supabase.from('community_content_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('community_content_quotas').select('*').eq('persona_id', personaId).maybeSingle(),
  ]);
  const settings: Settings = (settingsResult.data as Settings | null) ?? FALLBACK_SETTINGS;
  const quota = quotaResult.data as {
    persona_id: string;
    daily_free_used: number;
    daily_free_used_date: string;
    total_generations: number;
    total_qc_spent: number;
  } | null;

  const today = todayISO();
  const usedFreeToday = quota && quota.daily_free_used_date === today ? quota.daily_free_used : 0;
  const freeRemaining = Math.max(0, settings.daily_free_quota - usedFreeToday);

  const baseCost = skill === 'story' ? settings.cost_qc_story : settings.cost_qc_article;
  const surchargedCost = Math.round(baseCost * (1 + settings.surcharge_pct / 100));
  const qcCost = freeRemaining > 0 ? 0 : surchargedCost;

  // 2. Debit Q¢ first — fail fast if user can't afford
  const referenceId = `cgc-pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const paymentMode: 'auto' | 'dvn' = body.paymentMode === 'dvn' ? 'dvn' : 'auto';
  if (qcCost > 0) {
    const debit = await debitQc(
      supabase,
      personaId,
      qcCost,
      `community_content_${skill}`,
      referenceId,
      paymentMode,
    );
    if (!debit.ok) {
      // Forward the x402 payment envelope + buy-Q¢ signal to the client.
      // RemixDialog uses these to drive the user-facing fallback chain:
      // external wallet → DVN → buy Q¢.
      return NextResponse.json(
        {
          ok: false,
          error: debit.error,
          ...(debit.payment ? { payment: debit.payment } : {}),
          ...(debit.needsBuyQc ? { needsBuyQc: true } : {}),
        },
        { status: debit.status },
      );
    }
  }

  // 3. Persona context
  const personaContext = await loadKnytPersonaContext(supabase, personaId);

  // 4. Generate text + image in parallel — image gen often slower but doesn't block text
  const [textResult, imageUrl] = await Promise.all([
    generateText({ prompt, skill, title: body.title ?? null, personaContext }).catch((err) => {
      console.error('[community-content/generate] text gen failed', err);
      return null;
    }),
    generateImage(prompt).catch((err) => {
      console.error('[community-content/generate] image gen failed', err);
      return null;
    }),
  ]);

  if (!textResult) {
    // Refund the Q¢ if we charged for it
    if (qcCost > 0) {
      const { creditQc } = await import('../_lib/generate');
      await creditQc(supabase, personaId, qcCost, 'community_content_generation_failed', referenceId);
    }
    return NextResponse.json({ ok: false, error: 'Text generation failed' }, { status: 500 });
  }

  // 5. Insert content row
  const generationIndex = quota ? (quota.total_generations + 1) : 1;
  const insertPayload = {
    creator_persona_id:   personaId,
    source_experience_id: body.sourceExperienceId ?? null,
    parent_id:            body.parentId ?? null,
    skill,
    title:                textResult.title,
    prompt,
    article_body:         textResult.body,
    image_url:            imageUrl,
    status:               'draft',
    qc_cost:              qcCost,
    generation_index:     generationIndex,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('community_generated_content')
    .insert(insertPayload)
    .select('id, title, article_body, image_url, qc_cost, status, created_at')
    .single();

  if (insertError) {
    if (qcCost > 0) {
      const { creditQc } = await import('../_lib/generate');
      await creditQc(supabase, personaId, qcCost, 'community_content_insert_failed', referenceId);
    }
    return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
  }

  // 6. Bump quota counters
  const newQuotaPayload = {
    persona_id:           personaId,
    daily_free_used:      freeRemaining > 0 ? usedFreeToday + 1 : usedFreeToday,
    daily_free_used_date: today,
    total_generations:    generationIndex,
    total_qc_spent:       (quota?.total_qc_spent ?? 0) + qcCost,
    updated_at:           new Date().toISOString(),
  };
  await supabase
    .from('community_content_quotas')
    .upsert(newQuotaPayload, { onConflict: 'persona_id' });

  // 7. Response
  const refundableUntil = new Date(Date.now() + settings.discard_window_seconds * 1000).toISOString();
  return NextResponse.json({
    ok: true,
    id:                inserted.id,
    title:             inserted.title,
    articleBody:       inserted.article_body,
    imageUrl:          inserted.image_url,
    qcCost:            inserted.qc_cost,
    status:            inserted.status,
    createdAt:         inserted.created_at,
    refundableUntil,
    textProvider:      textResult.provider,
  });
}
