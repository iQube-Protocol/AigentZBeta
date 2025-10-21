import { NextRequest, NextResponse } from 'next/server';
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory } from '@/services/ops/idl/rqh';

const rqhCanisterId = process.env.RQH_CANISTER_ID || process.env.NEXT_PUBLIC_RQH_CANISTER_ID;

// Helper to convert BigInt to Number for JSON serialization
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber);
  }
  
  if (typeof obj === 'object') {
    const converted: any = {};
    for (const key in obj) {
      converted[key] = convertBigIntToNumber(obj[key]);
    }
    return converted;
  }
  
  return obj;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const personaId = params.id;

    // Check if RQH canister is configured
    if (!rqhCanisterId) {
      return NextResponse.json({
        ok: false,
        error: 'RQH canister not configured'
      }, { status: 503 });
    }

    // Get all reputation buckets for this partition from RQH canister
    const agent = new HttpAgent({ host: 'https://icp-api.io' });
    if (process.env.NODE_ENV !== 'production') {
      await agent.fetchRootKey();
    }

    const actor = Actor.createActor(idlFactory, {
      agent,
      canisterId: rqhCanisterId,
    });

    const response: any = await actor.get_partition_reputation(personaId);

    if (!response || response.length === 0) {
      return NextResponse.json({
        ok: false,
        error: 'No reputation buckets found for this persona'
      }, { status: 404 });
    }

    // Convert BigInt values to Numbers
    const reputationData = convertBigIntToNumber(response);

    return NextResponse.json({
      ok: true,
      data: reputationData
    });

  } catch (error: any) {
    console.error('Error fetching all reputation buckets:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to fetch reputation buckets'
    }, { status: 500 });
  }
}
