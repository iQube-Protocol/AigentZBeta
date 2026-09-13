import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getActivePersona } from '@/services/identity/getActivePersona';
import { isCartridgeAdmin } from '@/services/access/requireCartridgeAdmin';
import { setArtifactOperatorProvidedText } from '@/services/research/reciprocalExchange';
import type { PartySlot } from '@/types/reciprocalExchange';

/**
 * POST /api/admin/exchanges/[exchangeId]/set-artifact-text
 *
 * Admin-authenticated route for attaching an operator-verified plaintext
 * fallback to an already-deposited artifact, for use when automated content
 * extraction (`extractArtifactText`, services/research/reciprocalExchange.ts)
 * cannot reach the underlying bytes in a given deployment (operator
 * instruction, 2026-09-12: the OCSGA v1.3 DOCX's Auto Drive download works
 * from some networks but not others, and "we have to be able to read the
 * architecture" regardless).
 *
 * Deliberately narrow — see setArtifactOperatorProvidedText's own doc
 * comment: this never touches the artifact's fingerprint/identity fields,
 * only a supplementary rendering field.
 */
export async function POST(req: NextRequest, context: { params: { exchangeId: string } }) {
  try {
    const exchangeId = context.params.exchangeId;
    const body = await req.json().catch(() => ({}));
    const { party, text } = body as { party?: string; text?: string };

    if (party !== 'A' && party !== 'B') {
      return NextResponse.json({ ok: false, error: "party must be 'A' or 'B'" }, { status: 400 });
    }
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ ok: false, error: 'text is required' }, { status: 400 });
    }

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const caller = await getActivePersona(req);
    if (!caller) {
      return NextResponse.json({ ok: false, error: 'authentication failed' }, { status: 401 });
    }
    if (!isCartridgeAdmin(caller, 'irl-cartridge')) {
      return NextResponse.json({ ok: false, error: 'admin access required' }, { status: 403 });
    }

    const result = await setArtifactOperatorProvidedText(admin, {
      exchangeId,
      party: party as PartySlot,
      text,
      settingPersonaId: caller.personaId,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, artifact: result.artifact });
  } catch (err) {
    console.error('[admin/exchanges] set-artifact-text error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown error' },
      { status: 500 },
    );
  }
}
