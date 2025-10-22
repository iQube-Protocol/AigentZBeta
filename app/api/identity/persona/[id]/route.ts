import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/identity/persona/[id]
 * Fetch a single persona by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Persona ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to fetch from persona_with_reputation view first (includes reputation data)
    const { data: personaWithRep, error: repError } = await supabase
      .from('persona_with_reputation')
      .select('*')
      .eq('id', id)
      .single();

    if (!repError && personaWithRep) {
      return NextResponse.json({ ok: true, data: personaWithRep });
    }

    // Fallback to basic persona table
    const { data: persona, error } = await supabase
      .from('persona')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { ok: false, error: 'Persona not found' },
          { status: 404 }
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, data: persona });
  } catch (e: any) {
    console.error('[GET /api/identity/persona/[id]] Error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to fetch persona' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/identity/persona/[id]
 * Update a persona
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Persona ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('persona')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { ok: false, error: 'Persona not found' },
          { status: 404 }
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    console.error('[PATCH /api/identity/persona/[id]] Error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to update persona' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/identity/persona/[id]
 * Delete a persona
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'Persona ID is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from('persona')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, message: 'Persona deleted successfully' });
  } catch (e: any) {
    console.error('[DELETE /api/identity/persona/[id]] Error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to delete persona' },
      { status: 500 }
    );
  }
}
