/**
 * Fix Character Metadata API
 * POST /api/admin/codex/fix-character-metadata
 * 
 * Updates codex_characters with correct terra_name and digiterra_name values
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Character metadata from metaknyts_codex_export.json
    const characterUpdates = [
      { id: 'manuel_baptiste', terra_name: 'Manuel Baptiste', digiterra_name: '2Sun', affiliation: 'Cyphapunk' },
      { id: 'carlos_roberto', terra_name: 'Carlos Roberto', digiterra_name: 'Spartacus', affiliation: 'Cyphapunk' },
      { id: 'jabrin_mohammed', terra_name: 'Jabrin Mohammed', digiterra_name: 'Nimrod', affiliation: 'Cyphapunk' },
      { id: 'satoshi_nakamoto', terra_name: 'Satoshi Nakamoto', digiterra_name: 'Sage', affiliation: 'Cyphapunk / Digitterran Priesthood' },
      { id: 'deji_ifada', terra_name: 'Deji Ifada', digiterra_name: 'The Courier', affiliation: 'Order of Metiaye / Digiterrian Priesthood' },
      { id: 'analise_tokini', terra_name: 'Analise Tokini', digiterra_name: 'The Director', affiliation: 'Fang' },
      { id: 'lord_rupert_rothburg', terra_name: 'Lord Rupert Rothburg', digiterra_name: 'Count Roth', affiliation: 'Fang' },
      { id: 'matt_horrorwitz', terra_name: 'Matt Horrorwitz', digiterra_name: 'Tyrantus', affiliation: 'Fang' },
      { id: 'multiple', terra_name: 'Multiple', digiterra_name: 'Fang Commander', affiliation: 'Fang' },
      { id: 'multiple_2', terra_name: 'Multiple', digiterra_name: 'Fang Sentinel', affiliation: 'Fang' },
      { id: 'deji_ifada_2', terra_name: 'Deji Ifada', digiterra_name: 'Kn0w1', affiliation: 'metaKnyt' },
      { id: 'owethu_shaka', terra_name: 'Owethu Shaka', digiterra_name: 'midKnyt', affiliation: 'metaKnyt' },
      { id: 'kaiye', terra_name: 'Kaiye', digiterra_name: 'Quintel', affiliation: 'Digiterrian Priesthood' },
      { id: 'non_applicable', terra_name: 'Non applicable', digiterra_name: 'Metaiye', affiliation: 'Digiterrian Priesthood' },
      { id: 'unknown', terra_name: 'Unknown', digiterra_name: 'The Emissary', affiliation: 'Unknown' },
      { id: 'manuel_baptiste_2', terra_name: 'Manuel Baptiste', digiterra_name: '2Sun', affiliation: 'metaKnyt' },
      { id: 'satoshi_nakamoto_2', terra_name: 'Satoshi Nakamoto', digiterra_name: 'Sage', affiliation: 'metaKnyt' },
      { id: 'carlos_roberto_2', terra_name: 'Carlos Roberto', digiterra_name: 'Spartacus', affiliation: 'metaKnyt' },
      { id: 'jabrin_mohammed_2', terra_name: 'Jabrin Mohammed', digiterra_name: 'Nimrod', affiliation: 'metaKnyt' },
      { id: 'analise_tokini_2', terra_name: 'Analise Tokini', digiterra_name: 'The Director', affiliation: 'Fang' },
      { id: 'lord_rupert_rothburg_2', terra_name: 'Lord Rupert Rothburg', digiterra_name: 'Count Roth', affiliation: 'Fang' },
      { id: 'matt_horrorwitz_2', terra_name: 'Matt Horrorwitz', digiterra_name: 'Tyrantus', affiliation: 'Fang' },
      { id: 'multiple_3', terra_name: 'Multiple', digiterra_name: 'Fang Commander', affiliation: 'Fang' },
      { id: 'multiple_4', terra_name: 'Multiple', digiterra_name: 'Fang Sentinel', affiliation: 'Fang' },
      { id: 'kurt_johnson', terra_name: 'Kurt Johnson', digiterra_name: 'KnytRush', affiliation: 'metaKnyt' },
      { id: 'nos_fiair_atu', terra_name: 'None', digiterra_name: 'Nos Fiair Atu', affiliation: 'Digiterrian Priesthood' },
      { id: 'trojan', terra_name: 'None', digiterra_name: 'Trojan', affiliation: 'Unknown' },
      { id: 'the_alawo', terra_name: 'None', digiterra_name: 'The Alawo', affiliation: 'Digiterrian Priesthood' },
      { id: 'digiterian_priest', terra_name: 'None', digiterra_name: 'Digiterian Priest', affiliation: 'Digiterrian Priesthood' },
      { id: 'gem', terra_name: 'None', digiterra_name: 'Gem', affiliation: 'Unknown' },
    ];

    const results = [];

    for (const char of characterUpdates) {
      const { data, error } = await supabase
        .from('codex_characters')
        .update({
          terra_name: char.terra_name,
          digiterra_name: char.digiterra_name,
          affiliation: char.affiliation,
        })
        .eq('id', char.id)
        .select();

      if (error) {
        results.push({ id: char.id, status: 'error', error: error.message });
      } else if (data && data.length > 0) {
        results.push({ id: char.id, digiterra_name: char.digiterra_name, status: 'updated' });
      } else {
        results.push({ id: char.id, status: 'not_found' });
      }
    }

    const updated = results.filter(r => r.status === 'updated').length;
    const notFound = results.filter(r => r.status === 'not_found').length;
    const errors = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} characters, ${notFound} not found, ${errors} errors`,
      results,
    });

  } catch (error) {
    console.error('[FixCharacterMetadata] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fix character metadata' },
      { status: 500 }
    );
  }
}
