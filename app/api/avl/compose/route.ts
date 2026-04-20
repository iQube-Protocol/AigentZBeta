/**
 * POST /api/avl/compose
 *
 * Calls Marketa inference to draft outreach copy for a given audience + pack.
 * Returns editable draft — operator reviews before sending.
 *
 * Body:
 *   audience_type    'partner' | 'customer' | 'both'
 *   comms_type       string  (first_contact | reengagement | offer | ...)
 *   pack_slug        string  (identifies the comms pack template)
 *   recipient_summary string  (brief description of who we're writing to)
 *
 * Response: { ok, data: { draft_subject, draft_body, suggested_cta } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';

export const dynamic = 'force-dynamic';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL   = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServer();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'DB unavailable' }, { status: 503 });
  }

  let body: {
    audience_type?: string;
    comms_type?: string;
    pack_slug?: string;
    recipient_summary?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { audience_type, comms_type, pack_slug, recipient_summary } = body;
  if (!audience_type || !comms_type || !pack_slug) {
    return NextResponse.json(
      { ok: false, error: 'audience_type, comms_type, pack_slug are required' },
      { status: 400 },
    );
  }

  try {
    // Load pack template
    const { data: pack, error: packErr } = await supabase
      .from('avl_comms_packs')
      .select('title, template_markdown, subject_lines, cta_options')
      .eq('slug', pack_slug)
      .single();

    if (packErr || !pack) {
      return NextResponse.json({ ok: false, error: `Pack not found: ${pack_slug}` }, { status: 404 });
    }

    const template = (pack as { template_markdown: string | null }).template_markdown ?? '';
    const subjectLines = (pack as { subject_lines: string[] | null }).subject_lines ?? [];
    const ctaOptions   = (pack as { cta_options: string[] | null }).cta_options ?? [];

    const systemPrompt = `You are Marketa, the AgentiQ relationship intelligence agent. Your job is to draft high-quality outreach copy.

Context:
- Audience type: ${audience_type}
- Comms type: ${comms_type}
- Pack: ${(pack as { title: string }).title}
${recipient_summary ? `- Recipients: ${recipient_summary}` : ''}

Pack template:
${template || '(no template — write from first principles)'}

Available subject lines: ${JSON.stringify(subjectLines)}
Available CTAs: ${JSON.stringify(ctaOptions)}`;

    const userPrompt = `Draft the outreach. Return JSON only in this exact format:
{
  "draft_subject": "<best subject line or your own>",
  "draft_body": "<full email/message body, markdown OK>",
  "suggested_cta": "<recommended call to action>"
}`;

    if (!ANTHROPIC_API_KEY) {
      // Fallback: return pack template directly without AI inference
      return NextResponse.json({
        ok: true,
        data: {
          draft_subject: subjectLines[0] ?? `${comms_type} — ${(pack as { title: string }).title}`,
          draft_body:    template || `Hi [Name],\n\n[Personalize your message here.]\n\nBest,\nMarketa`,
          suggested_cta: ctaOptions[0] ?? 'Schedule a call',
          source:        'template_fallback',
        },
      });
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      ANTHROPIC_MODEL,
        max_tokens: 1024,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[avl/compose] Anthropic error:', errText);
      return NextResponse.json({ ok: false, error: 'AI inference failed' }, { status: 502 });
    }

    const aiData = await res.json() as { content: Array<{ type: string; text: string }> };
    const text   = aiData.content?.find((c) => c.type === 'text')?.text ?? '';

    let draft: { draft_subject: string; draft_body: string; suggested_cta: string };
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      draft = JSON.parse(jsonMatch?.[0] ?? '{}');
    } catch {
      draft = {
        draft_subject: subjectLines[0] ?? '',
        draft_body:    text,
        suggested_cta: ctaOptions[0] ?? '',
      };
    }

    return NextResponse.json({ ok: true, data: { ...draft, source: 'marketa_inference' } });
  } catch (err) {
    console.error('[avl/compose] error:', err);
    return NextResponse.json({ ok: false, error: 'Compose failed' }, { status: 500 });
  }
}
