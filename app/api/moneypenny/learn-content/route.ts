/**
 * GET /api/moneypenny/learn-content — MoneyPenny Cartridge C-15/C-17
 * (2026-09-02). Reads MoneyPenny's ONE educational-video section through
 * the shared bridge editorial reader (services/journey/moneyPennyEducationalMedia.ts)
 * — the SAME publication path native Qriptopian Bridges admin uses for
 * every other bridge section, via the SAME public projection
 * (`knyts_bridge_editorial_config`) every CI/KNYTS bridge reader uses.
 *
 * Deliberately NOT gated on END-USER auth — mirrors
 * /api/journey/knyts-bridge/editorial-config's own GET posture (public
 * bridge/educational copy is browsable signed-out); this is free/preview
 * content, not gated per CLAUDE.md's "Gated Content" rules.
 *
 * Turn F (2026-09-02) — uses getServiceRoleSupabaseOrThrow, never
 * getCommunityContentSupabase()'s anon-key fallback, for this specific
 * read. Rationale (operator directive: "must report configuration,
 * authorization or database failures accurately. Do not silently fall
 * back to an anonymous client and translate unreadable rows into 'not
 * published.'"): a missing SUPABASE_SERVICE_ROLE_KEY must surface as a
 * distinct, honest 503 — never as `{ok: true, content: {videoUrl: null}}`,
 * which is indistinguishable from "genuinely nothing published yet."
 */

import { NextResponse } from 'next/server';
import {
  getServiceRoleSupabaseOrThrow,
  SupabaseConfigurationError,
  SupabaseServiceRoleMissingError,
} from '@/services/supabase/requireServiceRoleClient';
import { getMoneyPennyLearnContent } from '@/services/journey/moneyPennyEducationalMedia';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getServiceRoleSupabaseOrThrow('MoneyPenny learn-content read');
    const content = await getMoneyPennyLearnContent(supabase);
    return NextResponse.json({ ok: true, content });
  } catch (err) {
    if (err instanceof SupabaseServiceRoleMissingError) {
      return NextResponse.json(
        { ok: false, error: 'service-role-not-configured', detail: err.message },
        { status: 503 },
      );
    }
    if (err instanceof SupabaseConfigurationError) {
      return NextResponse.json(
        { ok: false, error: 'supabase-not-configured', detail: err.message },
        { status: 503 },
      );
    }
    // A genuine database/query failure (not RLS row-filtering, which never
    // surfaces as a thrown error — it returns an empty, honest result via
    // getMoneyPennyLearnContent's own defaults instead).
    return NextResponse.json(
      { ok: false, error: 'database-error', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
