import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Purge Policies for Old Logs (Tier 3 Batching)
 * 
 * Implements cleanup policies for old transaction logs and batches
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PurgeConfig {
  transactionLogRetentionDays: number;
  batchRetentionDays: number;
  batchSize: number;
}

const DEFAULT_CONFIG: PurgeConfig = {
  transactionLogRetentionDays: 30, // Keep transactions for 30 days
  batchRetentionDays: 90, // Keep batches for 90 days
  batchSize: 1000, // Process 1000 records at a time
};

// POST /api/ops/batch/purge - Execute purge policies
export async function POST(request: NextRequest) {
  try {
    const body: Partial<PurgeConfig> = await request.json();
    const config = { ...DEFAULT_CONFIG, ...body };

    const now = new Date();
    const results = {
      transactionsPurged: 0,
      batchesPurged: 0,
      errors: [] as string[],
    };

    // Purge old transaction logs
    try {
      const transactionCutoff = new Date(
        now.getTime() - config.transactionLogRetentionDays * 24 * 60 * 60 * 1000
      ).toISOString();

      // Only purge processed transactions that are older than retention period
      const { data: oldTransactions, error: fetchError } = await supabase
        .from('transaction_log')
        .select('id')
        .eq('processed', true)
        .lt('created_at', transactionCutoff)
        .limit(config.batchSize);

      if (fetchError) {
        throw new Error(`Failed to fetch old transactions: ${fetchError.message}`);
      }

      if (oldTransactions && oldTransactions.length > 0) {
        const transactionIds = oldTransactions.map(tx => tx.id);
        
        const { error: deleteError } = await supabase
          .from('transaction_log')
          .delete()
          .in('id', transactionIds);

        if (deleteError) {
          throw new Error(`Failed to delete transactions: ${deleteError.message}`);
        }

        results.transactionsPurged = transactionIds.length;
        console.log(`Purged ${transactionIds.length} old transactions`);
      }
    } catch (error: any) {
      const errorMsg = `Transaction purge failed: ${error.message}`;
      console.error(errorMsg);
      results.errors.push(errorMsg);
    }

    // Purge old batches (only if they have been committed and have receipts)
    try {
      const batchCutoff = new Date(
        now.getTime() - config.batchRetentionDays * 24 * 60 * 60 * 1000
      ).toISOString();

      const { data: oldBatches, error: fetchError } = await supabase
        .from('merkle_batches')
        .select('id')
        .eq('committed', true)
        .not('pos_receipt_id', 'is', null)
        .lt('created_at', batchCutoff)
        .limit(config.batchSize);

      if (fetchError) {
        throw new Error(`Failed to fetch old batches: ${fetchError.message}`);
      }

      if (oldBatches && oldBatches.length > 0) {
        const batchIds = oldBatches.map(batch => batch.id);
        
        const { error: deleteError } = await supabase
          .from('merkle_batches')
          .delete()
          .in('id', batchIds);

        if (deleteError) {
          throw new Error(`Failed to delete batches: ${deleteError.message}`);
        }

        results.batchesPurged = batchIds.length;
        console.log(`Purged ${batchIds.length} old batches`);
      }
    } catch (error: any) {
      const errorMsg = `Batch purge failed: ${error.message}`;
      console.error(errorMsg);
      results.errors.push(errorMsg);
    }

    return NextResponse.json({
      ok: results.errors.length === 0,
      results,
      config,
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Purge operation error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET /api/ops/batch/purge - Get purge status and statistics
export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const stats = {
      transactionLog: {
        total: 0,
        processed: 0,
        pending: 0,
        olderThan30Days: 0,
        olderThan90Days: 0,
      },
      batches: {
        total: 0,
        committed: 0,
        pending: 0,
        olderThan30Days: 0,
        olderThan90Days: 0,
      },
    };

    // Transaction log statistics
    const transactionCutoff30 = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    
    const transactionCutoff90 = new Date(
      now.getTime() - 90 * 24 * 60 * 60 * 1000
    ).toISOString();

    const [
      { count: totalTransactions },
      { count: processedTransactions },
      { count: pendingTransactions },
      { count: oldTransactions30 },
      { count: oldTransactions90 },
    ] = await Promise.all([
      supabase.from('transaction_log').select('id', { count: 'exact', head: true }),
      supabase.from('transaction_log').select('id', { count: 'exact', head: true }).eq('processed', true),
      supabase.from('transaction_log').select('id', { count: 'exact', head: true }).eq('processed', false),
      supabase.from('transaction_log').select('id', { count: 'exact', head: true }).lt('created_at', transactionCutoff30),
      supabase.from('transaction_log').select('id', { count: 'exact', head: true }).lt('created_at', transactionCutoff90),
    ]);

    stats.transactionLog = {
      total: totalTransactions || 0,
      processed: processedTransactions || 0,
      pending: pendingTransactions || 0,
      olderThan30Days: oldTransactions30 || 0,
      olderThan90Days: oldTransactions90 || 0,
    };

    // Batch statistics
    const batchCutoff30 = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    
    const batchCutoff90 = new Date(
      now.getTime() - 90 * 24 * 60 * 60 * 1000
    ).toISOString();

    const [
      { count: totalBatches },
      { count: committedBatches },
      { count: pendingBatches },
      { count: oldBatches30 },
      { count: oldBatches90 },
    ] = await Promise.all([
      supabase.from('merkle_batches').select('id', { count: 'exact', head: true }),
      supabase.from('merkle_batches').select('id', { count: 'exact', head: true }).eq('committed', true),
      supabase.from('merkle_batches').select('id', { count: 'exact', head: true }).eq('committed', false),
      supabase.from('merkle_batches').select('id', { count: 'exact', head: true }).lt('created_at', batchCutoff30),
      supabase.from('merkle_batches').select('id', { count: 'exact', head: true }).lt('created_at', batchCutoff90),
    ]);

    stats.batches = {
      total: totalBatches || 0,
      committed: committedBatches || 0,
      pending: pendingBatches || 0,
      olderThan30Days: oldBatches30 || 0,
      olderThan90Days: oldBatches90 || 0,
    };

    return NextResponse.json({
      ok: true,
      stats,
      defaultConfig: DEFAULT_CONFIG,
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Purge status error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
