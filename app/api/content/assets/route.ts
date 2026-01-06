/**
 * API: Fetch Codex Media Assets by kind
 * GET /api/content/assets?kinds=background_lore_doc,twenty_one_sats_concept
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// CORS headers for cross-origin requests from thin client
export async function OPTIONS() {
  return new NextResponse(null);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const kindsParam = searchParams.get('kinds');
    const episodeNumber = searchParams.get('episode');
    
    if (!kindsParam) {
      return NextResponse.json({ error: 'Missing kinds parameter' }, { status: 400,  });
    }

    const kinds = kindsParam.split(',').map(k => k.trim());

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('codex_media_assets')
      .select('id, title, asset_kind, auto_drive_cid, episode_number, display_mode, extracted_text, created_at')
      .in('asset_kind', kinds)
      .order('created_at', { ascending: false });

    if (episodeNumber) {
      query = query.eq('episode_number', parseInt(episodeNumber, 10));
    }

    const { data, error } = await query;

    if (error) {
      console.error('[assets] Query error:', error);
      return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500,  });
    }

    const assets = (data || []) as Array<{
      id: string;
      title: string;
      asset_kind: string;
      auto_drive_cid: string;
      episode_number: number | null;
      display_mode: string | null;
      extracted_text: string | null;
      created_at: string;
    }>;

    const missingText = assets.filter((asset) => !asset.extracted_text && asset.auto_drive_cid);
    if (missingText.length > 0) {
      const cids = missingText.map((asset) => asset.auto_drive_cid);
      const { data: docs } = await supabase
        .from('codex_kb_documents')
        .select('id, source_cid, extraction_status')
        .in('source_cid', cids)
        .eq('extraction_status', 'completed');

      if (docs && docs.length > 0) {
        const docIds = docs.map((doc) => doc.id);
        const { data: chunks } = await supabase
          .from('codex_kb_chunks')
          .select('document_id, content, chunk_index')
          .in('document_id', docIds)
          .order('chunk_index', { ascending: true });

        const textByDoc = new Map<string, string[]>();
        for (const chunk of chunks || []) {
          const list = textByDoc.get(chunk.document_id) || [];
          list.push(chunk.content);
          textByDoc.set(chunk.document_id, list);
        }

        const docByCid = new Map<string, string>();
        for (const doc of docs) {
          docByCid.set(doc.source_cid, doc.id);
        }

        for (const asset of assets) {
          if (asset.extracted_text || !asset.auto_drive_cid) continue;
          const docId = docByCid.get(asset.auto_drive_cid);
          if (!docId) continue;
          const chunksForDoc = textByDoc.get(docId);
          if (!chunksForDoc || chunksForDoc.length === 0) continue;
          asset.extracted_text = chunksForDoc.join('\n\n');
        }
      }
    }

    return NextResponse.json({ assets });
  } catch (err) {
    console.error('[assets] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500,  });
  }
}
