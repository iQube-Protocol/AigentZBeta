import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory } from '@/services/ops/idl/rqh';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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

// Submit evidence for a reputation bucket
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bucketId, evidenceType, evidenceData, weight } = body;

    if (!bucketId || !evidenceType || !evidenceData) {
      return NextResponse.json({
        ok: false,
        error: 'bucketId, evidenceType, and evidenceData are required'
      }, { status: 400 });
    }

    if (!rqhCanisterId) {
      return NextResponse.json({
        ok: false,
        error: 'RQH canister not configured'
      }, { status: 503 });
    }

    // Submit evidence to RQH canister
    const agent = new HttpAgent({ host: 'https://icp-api.io' });
    if (process.env.NODE_ENV !== 'production') {
      await agent.fetchRootKey();
    }

    const actor = Actor.createActor(idlFactory, {
      agent,
      canisterId: rqhCanisterId,
    });

    const evidenceRequest = {
      bucket_id: bucketId,
      evidence_type: evidenceType,
      evidence_data: JSON.stringify(evidenceData),
      weight: weight || 0.5
    };

    const response: any = await actor.add_reputation_evidence(evidenceRequest);

    if (!response.ok || !response.data || response.data.length === 0) {
      return NextResponse.json({
        ok: false,
        error: response.error?.[0] || 'Failed to submit evidence'
      }, { status: 500 });
    }

    // Convert BigInt values to Numbers
    const updatedBucket = convertBigIntToNumber(response.data[0]);

    // Store evidence reference in Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get reputation bucket from Supabase
    const { data: reputationBucket } = await supabase
      .from('reputation_bucket')
      .select('id')
      .eq('rqh_bucket_id', bucketId)
      .single();

    if (reputationBucket) {
      // Insert evidence record
      await supabase
        .from('reputation_evidence')
        .insert({
          reputation_bucket_id: reputationBucket.id,
          evidence_type: evidenceType,
          evidence_data: evidenceData,
          weight: weight || 0.5,
          verified: false
        });

      // Update bucket stats
      await supabase
        .from('reputation_bucket')
        .update({
          bucket_level: updatedBucket.bucket,
          score: updatedBucket.score,
          evidence_count: updatedBucket.evidence_count,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', reputationBucket.id);
    }

    return NextResponse.json({
      ok: true,
      data: {
        bucket: updatedBucket,
        message: 'Evidence submitted successfully'
      }
    });

  } catch (error: any) {
    console.error('Error submitting evidence:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to submit evidence'
    }, { status: 500 });
  }
}

// Get evidence for a bucket
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bucketId = searchParams.get('bucketId');

    if (!bucketId) {
      return NextResponse.json({
        ok: false,
        error: 'bucketId parameter is required'
      }, { status: 400 });
    }

    if (!rqhCanisterId) {
      return NextResponse.json({
        ok: false,
        error: 'RQH canister not configured'
      }, { status: 503 });
    }

    // Get evidence from RQH canister
    const agent = new HttpAgent({ host: 'https://icp-api.io' });
    if (process.env.NODE_ENV !== 'production') {
      await agent.fetchRootKey();
    }

    const actor = Actor.createActor(idlFactory, {
      agent,
      canisterId: rqhCanisterId,
    });

    const response: any = await actor.get_reputation_evidence(bucketId);

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        error: response.error?.[0] || 'Failed to fetch evidence'
      }, { status: 500 });
    }

    // Also get evidence from Supabase for additional metadata
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: reputationBucket } = await supabase
      .from('reputation_bucket')
      .select('id')
      .eq('rqh_bucket_id', bucketId)
      .single();

    let supabaseEvidence = [];
    if (reputationBucket) {
      const { data } = await supabase
        .from('reputation_evidence')
        .select('*')
        .eq('reputation_bucket_id', reputationBucket.id)
        .order('created_at', { ascending: false });
      
      supabaseEvidence = data || [];
    }

    return NextResponse.json({
      ok: true,
      data: {
        canister_evidence: convertBigIntToNumber(response.data || []),
        supabase_evidence: supabaseEvidence
      }
    });

  } catch (error: any) {
    console.error('Error fetching evidence:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to fetch evidence'
    }, { status: 500 });
  }
}
