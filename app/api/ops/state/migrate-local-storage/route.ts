import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Migration Utility: localStorage to Server-Driven State
 * 
 * Helps migrate existing localStorage data to server preferences
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MigrationRequest {
  userId: string;
  localStorageData: Record<string, any>;
}

// POST /api/ops/state/migrate-local-storage - Migrate localStorage data
export async function POST(request: NextRequest) {
  try {
    const body: MigrationRequest = await request.json();
    const { userId, localStorageData } = body;

    if (!userId || !localStorageData) {
      return NextResponse.json(
        { ok: false, error: 'userId and localStorageData required' },
        { status: 400 }
      );
    }

    const results = {
      migrated: [] as string[],
      failed: [] as { key: string; error: string }[],
      total: Object.keys(localStorageData).length,
    };

    const now = new Date().toISOString();

    for (const [key, value] of Object.entries(localStorageData)) {
      try {
        // Infer category from key
        let category: 'feature_flag' | 'ui_preference' | 'consent' | 'workflow';
        if (key.includes('consent') || key.includes('alias_consent')) {
          category = 'consent';
        } else if (key.includes('feature_') || key.includes('flag_')) {
          category = 'feature_flag';
        } else if (key.includes('theme') || key.includes('layout') || key.includes('drawer')) {
          category = 'ui_preference';
        } else {
          category = 'workflow';
        }

        // Convert string values to appropriate types
        let processedValue = value;
        if (typeof value === 'string') {
          if (value === 'true') processedValue = true;
          else if (value === 'false') processedValue = false;
          else if (!isNaN(Number(value)) && value !== '') {
            processedValue = Number(value);
          }
        }

        const prefData = {
          user_id: userId,
          key,
          value: processedValue,
          category,
          created_at: now,
          updated_at: now,
        };

        const { error } = await supabase
          .from('user_preferences')
          .upsert(prefData, {
            onConflict: 'user_id,key',
            ignoreDuplicates: false,
          });

        if (error) {
          results.failed.push({ key, error: error.message });
        } else {
          results.migrated.push(key);
        }
      } catch (error: any) {
        results.failed.push({ key, error: error.message });
      }
    }

    return NextResponse.json({
      ok: results.failed.length === 0,
      results,
      successCount: results.migrated.length,
      failureCount: results.failed.length,
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/ops/state/migrate-local-storage - Get migration status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'userId parameter required' },
        { status: 400 }
      );
    }

    // Get current server preferences
    const { data: serverPrefs, error: prefError } = await supabase
      .from('user_preferences')
      .select('key, category, updated_at')
      .eq('user_id', userId);

    if (prefError) {
      console.error('Failed to fetch server preferences:', prefError);
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch preferences' },
        { status: 500 }
      );
    }

    // Identify common localStorage keys that might need migration
    const commonKeys = [
      'x402_alias_consent',
      'theme',
      'density',
      'copilot_open',
      'feature_solana_ops',
      'feature_tier3_batching',
      'last_tx_80002', // DVN transaction hashes
      'last_tx_11155111', // Sepolia transaction hashes
      'amoy_last_tx',
    ];

    const serverKeys = new Set(serverPrefs?.map(p => p.key) || []);
    const needsMigration = commonKeys.filter(key => !serverKeys.has(key));

    return NextResponse.json({
      ok: true,
      migrationStatus: {
        serverPreferenceCount: serverKeys.size,
        needsMigrationCount: needsMigration.length,
        commonKeysNeedingMigration: needsMigration,
        serverPreferences: serverPrefs || [],
      },
      migrationGuide: {
        step1: 'Call POST /api/ops/state/migrate-local-storage with userId and localStorageData',
        step2: 'Update components to use useServerPreferences hook instead of localStorage',
        step3: 'Test functionality and remove localStorage fallbacks',
      },
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Migration status error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
