/**
 * Update KNYT Card Titles API
 * POST /api/admin/codex/update-card-titles
 * 
 * Updates the titles of KNYT cards in codex_media_assets to fix metadata mappings
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Card title updates based on user's card number mappings:
    // Card #1: Deji Ifada -> The Courier
    // Card #3: Analise Tokini -> The Director
    // Card #7: The Courier (META SCOOT) -> Kn0w1/The Courier
    // Card #8: Fang General -> Fang Commander
    // Card #9: Count Roth (Viscount) -> Count Roth
    // Card #13: Kn0w1 (META SCOOT 2) -> Kn0w1
    
    const updates = [
      { id: '1a288332-84ec-4920-bbde-41d8dafaaf4d', title: 'The Courier (Deji Ifada) front' },
      { id: '794a0614-6e34-42c6-b5a5-c6117ddd121d', title: 'The Director (Analise Tokini) front' },
      { id: 'cd3f4eab-c0b1-48ee-9ef3-e6e7eb1399bc', title: 'Kn0w1 (The Courier) front' },
      { id: '6759d5fc-b88e-4661-afde-39eb47a06ec8', title: 'Fang Commander front' },
      { id: '450cfe5d-d87d-4e0e-8779-1e224079cace', title: 'Count Roth (Lord Rothburg) front' },
      { id: '83bfbf97-a666-4058-9eae-1a94f61f7158', title: 'Kn0w1 front' },
    ];

    const results = [];

    for (const update of updates) {
      const { data, error } = await supabase
        .from('codex_media_assets')
        .update({ title: update.title })
        .eq('id', update.id)
        .select();

      if (error) {
        results.push({ id: update.id, title: update.title, status: 'error', error: error.message });
      } else {
        results.push({ id: update.id, title: update.title, status: 'updated' });
      }
    }

    // Also update corresponding powers_sheet (back) titles
    const sheetUpdates = [
      { oldTitle: 'Deji back', newTitle: 'The Courier (Deji Ifada) back' },
      { oldTitle: 'Annalise back', newTitle: 'The Director (Analise Tokini) back' },
      { oldTitle: 'Fang General back', newTitle: 'Fang Commander back' },
      { oldTitle: 'Viscount back', newTitle: 'Count Roth (Lord Rothburg) back' },
    ];

    for (const update of sheetUpdates) {
      const { data, error } = await supabase
        .from('codex_media_assets')
        .update({ title: update.newTitle })
        .eq('title', update.oldTitle)
        .select();

      if (error) {
        results.push({ oldTitle: update.oldTitle, newTitle: update.newTitle, status: 'error', error: error.message });
      } else if (data && data.length > 0) {
        results.push({ oldTitle: update.oldTitle, newTitle: update.newTitle, status: 'updated' });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Card titles updated',
      results,
    });

  } catch (error) {
    console.error('[UpdateCardTitles] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update card titles' },
      { status: 500 }
    );
  }
}
