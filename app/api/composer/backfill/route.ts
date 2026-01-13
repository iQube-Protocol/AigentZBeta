/**
 * Composer Backfill API
 * POST /api/composer/backfill?confirm=1 - Upsert in-memory ExperienceQubes into Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllExperienceQubes, type ExperienceQubeData } from '@/services/composer/composerStore';
import { createExperienceRecord } from '@/services/composer/composerPersistence';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const confirmed = searchParams.get('confirm') === '1';

    if (!confirmed) {
      return NextResponse.json({
        ok: false,
        error: 'Confirmation required. Re-run with ?confirm=1',
      }, { status: 400 });
    }

    const experiences = getAllExperienceQubes();
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];

    for (const experience of experiences) {
      try {
        const stored = await createExperienceRecord(experience as ExperienceQubeData);
        results.push({ id: stored.id, ok: true });
      } catch (error: any) {
        results.push({ id: experience.id, ok: false, error: error?.message || 'Unknown error' });
      }
    }

    const successCount = results.filter(r => r.ok).length;
    const errorCount = results.length - successCount;

    return NextResponse.json({
      ok: true,
      total: results.length,
      upserted: successCount,
      failed: errorCount,
      results,
    });
  } catch (error: any) {
    console.error('Composer backfill error:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to backfill ExperienceQubes',
    }, { status: 500 });
  }
}
