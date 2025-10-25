import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Clean up duplicate FIO handles in persona table
 * POST /api/admin/cleanup-duplicates
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // First, get all duplicates
    const { data: duplicates, error: duplicatesError } = await supabase
      .rpc('get_duplicate_fio_handles');

    if (duplicatesError) {
      console.error('Failed to get duplicates:', duplicatesError);
      return NextResponse.json(
        { ok: false, error: 'Failed to get duplicates' },
        { status: 500 }
      );
    }

    // Get personas with duplicate FIO handles, keeping only the most recent
    const { data: personas, error: personasError } = await supabase
      .from('persona')
      .select('id, fio_handle, created_at')
      .not('fio_handle', 'is', null)
      .order('fio_handle', { ascending: true })
      .order('created_at', { ascending: false });

    if (personasError) {
      console.error('Failed to get personas:', personasError);
      return NextResponse.json(
        { ok: false, error: 'Failed to get personas' },
        { status: 500 }
      );
    }

    // Group by FIO handle and identify duplicates to delete
    const handleGroups: { [key: string]: any[] } = {};
    personas?.forEach(persona => {
      if (!handleGroups[persona.fio_handle]) {
        handleGroups[persona.fio_handle] = [];
      }
      handleGroups[persona.fio_handle].push(persona);
    });

    const toDelete: string[] = [];
    let duplicateCount = 0;

    Object.values(handleGroups).forEach(group => {
      if (group.length > 1) {
        // Keep the first (most recent) and delete the rest
        const [keep, ...deleteList] = group;
        toDelete.push(...deleteList.map(p => p.id));
        duplicateCount += deleteList.length;
      }
    });

    if (toDelete.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No duplicates found',
        deleted: 0
      });
    }

    // Delete duplicates
    const { error: deleteError } = await supabase
      .from('persona')
      .delete()
      .in('id', toDelete);

    if (deleteError) {
      console.error('Failed to delete duplicates:', deleteError);
      return NextResponse.json(
        { ok: false, error: 'Failed to delete duplicates' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Successfully deleted ${duplicateCount} duplicate personas`,
      deleted: duplicateCount,
      duplicateHandles: Object.keys(handleGroups).filter(handle => handleGroups[handle].length > 1)
    });

  } catch (e: any) {
    console.error('Cleanup duplicates error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to cleanup duplicates' },
      { status: 500 }
    );
  }
}
