/**
 * Admin API to cleanup erroneous entitlements
 * DELETE /api/admin/entitlements/cleanup
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: NextRequest) {
  try {
    const { personaId, pattern } = await req.json();
    
    if (!personaId) {
      return NextResponse.json({ error: 'personaId required' }, { status: 400 });
    }

    // Get all entitlements for the persona
    const { data: entitlements, error: fetchError } = await supabase
      .from('user_entitlements')
      .select('id, asset_id')
      .eq('persona_id', personaId);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Filter entitlements matching the pattern
    const toDelete = entitlements?.filter(e => 
      pattern ? e.asset_id?.includes(pattern) : false
    ) || [];

    if (toDelete.length === 0) {
      return NextResponse.json({ message: 'No matching entitlements found', deleted: 0 });
    }

    // Delete matching entitlements
    const idsToDelete = toDelete.map(e => e.id);
    const { error: deleteError } = await supabase
      .from('user_entitlements')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      message: `Deleted ${toDelete.length} entitlements matching pattern "${pattern}"`,
      deleted: toDelete.length,
      deletedIds: idsToDelete
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
