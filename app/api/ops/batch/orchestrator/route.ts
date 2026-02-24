import { NextRequest, NextResponse } from 'next/server';

/**
 * Tier 3 Batching System Orchestrator
 * 
 * Orchestrates the complete server-side batching flow:
 * 1. Append-only transaction logs
 * 2. Merkle tree batcher
 * 3. DVN BatchCommit integration
 * 4. PoS batch receipt system
 * 5. Purge policies for old logs
 */

interface OrchestratorRequest {
  action: 'log' | 'batch' | 'commit' | 'receipt' | 'purge' | 'full_flow';
  data?: any;
}

// POST /api/ops/batch/orchestrator - Main orchestrator endpoint
export async function POST(request: NextRequest) {
  try {
    const body: OrchestratorRequest = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'log':
        return await handleTransactionLog(data);
      
      case 'batch':
        return await handleMerkleBatch(data);
      
      case 'commit':
        return await handleDvnCommit(data);
      
      case 'receipt':
        return await handlePosReceipt(data);
      
      case 'purge':
        return await handlePurge(data);
      
      case 'full_flow':
        return await handleFullFlow(data);
      
      default:
        return NextResponse.json(
          { ok: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('Batch orchestrator error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle transaction logging
async function handleTransactionLog(data: any) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ops/batch/transaction-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  const result = await response.json();
  return NextResponse.json(result, { status: response.status });
}

// Handle Merkle batching
async function handleMerkleBatch(data: any) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ops/batch/merkle-batcher`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  const result = await response.json();
  return NextResponse.json(result, { status: response.status });
}

// Handle DVN commit
async function handleDvnCommit(data: any) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ops/batch/dvn-commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  const result = await response.json();
  return NextResponse.json(result, { status: response.status });
}

// Handle PoS receipt
async function handlePosReceipt(data: any) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ops/batch/pos-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  const result = await response.json();
  return NextResponse.json(result, { status: response.status });
}

// Handle purge
async function handlePurge(data: any) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ops/batch/purge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  const result = await response.json();
  return NextResponse.json(result, { status: response.status });
}

// Handle complete Tier 3 flow
async function handleFullFlow(data: any) {
  const results = {
    steps: [] as any[],
    success: true,
    batchId: null,
    receiptId: null,
    errors: [] as string[],
  };

  try {
    console.log('Starting Tier 3 full flow...');
    
    // Step 1: Create Merkle batch from pending transactions
    console.log('Step 1: Creating Merkle batch...');
    const batchResponse = await handleMerkleBatch({
      batchSize: data?.batchSize || 50,
      maxAge: data?.maxAge || 3600000,
    });
    
    const batchResult = await batchResponse.json();
    results.steps.push({ step: 'batch', result: batchResult });
    
    if (!batchResult.ok || !batchResult.batchId) {
      throw new Error('Batch creation failed: ' + (batchResult.error || 'No batch ID'));
    }
    
    results.batchId = batchResult.batchId;
    console.log('Batch created:', results.batchId);

    // Step 2: Commit to DVN
    console.log('Step 2: Committing to DVN...');
    const commitResponse = await handleDvnCommit({
      batchId: batchResult.batchId,
      merkleRoot: batchResult.root,
      transactionIds: batchResult.transactions,
    });
    
    const commitResult = await commitResponse.json();
    results.steps.push({ step: 'commit', result: commitResult });
    
    if (!commitResult.ok) {
      throw new Error('DVN commit failed: ' + commitResult.error);
    }
    
    console.log('DVN commit successful');

    // Step 3: Issue PoS receipt
    console.log('Step 3: Issuing PoS receipt...');
    const receiptResponse = await handlePosReceipt({
      batchId: batchResult.batchId,
      merkleRoot: batchResult.root,
      dvnMessageId: commitResult.dvnResult,
    });
    
    const receiptResult = await receiptResponse.json();
    results.steps.push({ step: 'receipt', result: receiptResult });
    
    if (!receiptResult.ok) {
      throw new Error('PoS receipt failed: ' + receiptResult.error);
    }
    
    results.receiptId = receiptResult.receiptId;
    console.log('PoS receipt issued:', results.receiptId);

    // Step 4: Optionally trigger anchor (if requested)
    if (data?.anchor) {
      console.log('Step 4: Triggering anchor...');
      try {
        const anchorResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/ops/btc/anchor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        
        const anchorResult = await anchorResponse.json();
        results.steps.push({ step: 'anchor', result: anchorResult });
        
        if (!anchorResult.ok) {
          console.warn('Anchor failed (non-critical):', anchorResult.error);
        }
      } catch (anchorError: any) {
        console.warn('Anchor failed (non-critical):', anchorError.message);
      }
    }

    console.log('Tier 3 full flow completed successfully');
    
  } catch (error: any) {
    console.error('Tier 3 full flow failed:', error);
    results.success = false;
    results.errors.push(error.message);
  }

  return NextResponse.json({
    ok: results.success,
    results,
    at: new Date().toISOString(),
  });
}

// GET /api/ops/batch/orchestrator - Get system status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const component = searchParams.get('component');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    if (component) {
      // Get specific component status
      const endpoint = `${baseUrl}/api/ops/batch/${component}`;
      const response = await fetch(endpoint);
      const result = await response.json();
      return NextResponse.json(result, { status: response.status });
    }

    // Get overall system status
    const [
      transactionStatus,
      batchStatus,
      purgeStatus,
    ] = await Promise.all([
      fetch(`${baseUrl}/api/ops/batch/transaction-log?limit=10&processed=false`).then(r => r.json()),
      fetch(`${baseUrl}/api/ops/batch/merkle-batcher?committed=false`).then(r => r.json()),
      fetch(`${baseUrl}/api/ops/batch/purge`).then(r => r.json()),
    ]);

    return NextResponse.json({
      ok: true,
      system: {
        tier: '3',
        name: 'Server-Side Batching',
        description: 'Next.js append-only logs → Merkle root → DVN BatchCommit → PoS anchor → purge',
      },
      status: {
        pendingTransactions: transactionStatus.count || 0,
        pendingBatches: batchStatus.count || 0,
        purgeStats: purgeStatus.stats,
      },
      components: {
        transactionLog: transactionStatus,
        merkleBatcher: batchStatus,
        purge: purgeStatus,
      },
      at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Orchestrator status error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
