import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Server-Driven User Preferences and Flags
 * 
 * Replaces localStorage-based flags with server-driven state management
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface UserPreference {
  user_id: string;
  key: string;
  value: any;
  category: 'feature_flag' | 'ui_preference' | 'consent' | 'workflow';
  created_at: string;
  updated_at: string;
}

// GET /api/ops/state/user-preferences - Get user preferences
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const category = searchParams.get('category') as any;
    const keys = searchParams.get('keys')?.split(',');

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'userId parameter required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId);

    if (category) {
      query = query.eq('category', category);
    }

    if (keys && keys.length > 0) {
      query = query.in('key', keys);
    }

    const { data, error } = await query;

    if (error) {
      const code = (error as any).code;
      const message = (error as any).message || '';
      if (code === 'PGRST205' || message.includes('user_preferences')) {
        // Fail-open when the preferences table is not present.
        return NextResponse.json({
          ok: true,
          preferences: {},
          raw: [],
          at: new Date().toISOString(),
          warning: 'user_preferences table missing',
        });
      }
      console.error('Failed to fetch user preferences:', error);
      return NextResponse.json({
        ok: true,
        preferences: {},
        raw: [],
        at: new Date().toISOString(),
        warning: 'user_preferences unavailable',
      });
    }

    // Convert to key-value map for easier consumption
    const preferences: Record<string, any> = {};
    (data || []).forEach((pref: UserPreference) => {
      preferences[pref.key] = pref.value;
    });

    return NextResponse.json({
      ok: true,
      preferences,
      raw: data,
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('User preferences GET error:', error);
    return NextResponse.json({
      ok: true,
      preferences: {},
      raw: [],
      at: new Date().toISOString(),
      warning: error?.message || 'user_preferences unavailable',
    });
  }
}

// POST /api/ops/state/user-preferences - Set user preferences
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, preferences } = body;

    if (!userId || !preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'userId and preferences object required' },
        { status: 400 }
      );
    }

    const results = [];
    const now = new Date().toISOString();

    for (const [key, value] of Object.entries(preferences)) {
      const prefData = {
        user_id: userId,
        key,
        value,
        category: inferCategory(key),
        updated_at: now,
      };

      // Upsert preference
      const { data, error } = await supabase
        .from('user_preferences')
        .upsert(prefData, {
          onConflict: 'user_id,key',
          ignoreDuplicates: false,
        })
        .select();

      if (error) {
        const code = (error as any).code;
        const message = (error as any).message || '';
        if (code === 'PGRST205' || message.includes('user_preferences')) {
          results.push({ key, success: true, skipped: true });
          continue;
        }
        console.error(`Failed to set preference ${key}:`, error);
        results.push({ key, success: false, error: error.message });
      } else {
        results.push({ key, success: true, data: data?.[0] });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    return NextResponse.json({
      ok: successCount === results.length,
      results,
      setCount: successCount,
      totalCount: results.length,
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('User preferences POST error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/ops/state/user-preferences - Clear user preferences
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const keys = searchParams.get('keys')?.split(',');

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'userId parameter required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('user_preferences')
      .delete()
      .eq('user_id', userId);

    if (keys && keys.length > 0) {
      query = query.in('key', keys);
    }

    const { error, count } = await query;

    if (error) {
      const code = (error as any).code;
      const message = (error as any).message || '';
      if (code === 'PGRST205' || message.includes('user_preferences')) {
        return NextResponse.json({
          ok: true,
          deletedCount: 0,
          at: new Date().toISOString(),
          warning: 'user_preferences table missing',
        });
      }
      console.error('Failed to delete user preferences:', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to delete preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      deletedCount: count || 0,
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('User preferences DELETE error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to infer category from key name
function inferCategory(key: string): UserPreference['category'] {
  if (key.includes('consent') || key.includes('alias_consent')) {
    return 'consent';
  }
  if (key.includes('feature_') || key.includes('flag_')) {
    return 'feature_flag';
  }
  if (key.includes('theme') || key.includes('layout') || key.includes('drawer')) {
    return 'ui_preference';
  }
  return 'workflow';
}
