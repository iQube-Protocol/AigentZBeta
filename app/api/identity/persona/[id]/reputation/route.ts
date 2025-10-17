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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const personaId = params.id;

    // Get persona from Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: persona, error: personaError } = await supabase
      .from('persona')
      .select('*')
      .eq('id', personaId)
      .single();

    if (personaError || !persona) {
      return NextResponse.json({
        ok: false,
        error: 'Persona not found'
      }, { status: 404 });
    }

    // Check if RQH canister is configured
    if (!rqhCanisterId) {
      return NextResponse.json({
        ok: false,
        error: 'RQH canister not configured'
      }, { status: 503 });
    }

    // Get reputation from RQH canister using persona ID as partition ID
    const agent = new HttpAgent({ host: 'https://icp-api.io' });
    if (process.env.NODE_ENV !== 'production') {
      await agent.fetchRootKey();
    }

    const actor = Actor.createActor(idlFactory, {
      agent,
      canisterId: rqhCanisterId,
    });

    const response: any = await actor.get_reputation_bucket(personaId);

    if (!response.ok || !response.data || response.data.length === 0) {
      // No reputation found - return persona without reputation
      return NextResponse.json({
        ok: true,
        data: {
          persona,
          reputation: null,
          message: 'No reputation bucket found for this persona'
        }
      });
    }

    // Convert BigInt values to Numbers
    const reputationData = convertBigIntToNumber(response.data[0]);

    // Sync reputation to Supabase
    const { data: syncResult, error: syncError } = await supabase
      .rpc('sync_reputation_from_rqh', {
        p_partition_id: personaId,
        p_bucket_level: reputationData.bucket,
        p_score: reputationData.score,
        p_evidence_count: reputationData.evidence_count,
        p_rqh_bucket_id: reputationData.id
      });

    if (syncError) {
      console.error('Failed to sync reputation to Supabase:', syncError);
    }

    // Get updated reputation from Supabase
    const { data: reputationBucket } = await supabase
      .from('reputation_bucket')
      .select('*')
      .eq('partition_id', personaId)
      .single();

    return NextResponse.json({
      ok: true,
      data: {
        persona,
        reputation: {
          ...reputationData,
          supabase_synced: !!reputationBucket,
          supabase_id: reputationBucket?.id
        }
      }
    });

  } catch (error: any) {
    console.error('Error fetching persona reputation:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to fetch reputation'
    }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const personaId = params.id;
    const body = await request.json();
    const { skillCategory, initialScore } = body;

    if (!skillCategory) {
      return NextResponse.json({
        ok: false,
        error: 'skillCategory is required'
      }, { status: 400 });
    }

    // Check if RQH canister is configured
    if (!rqhCanisterId) {
      return NextResponse.json({
        ok: false,
        error: 'RQH canister not configured'
      }, { status: 503 });
    }

    // Verify persona exists
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: persona, error: personaError } = await supabase
      .from('persona')
      .select('id')
      .eq('id', personaId)
      .single();

    if (personaError || !persona) {
      return NextResponse.json({
        ok: false,
        error: 'Persona not found'
      }, { status: 404 });
    }

    // Create reputation bucket in RQH canister
    const agent = new HttpAgent({ host: 'https://icp-api.io' });
    if (process.env.NODE_ENV !== 'production') {
      await agent.fetchRootKey();
    }

    const actor = Actor.createActor(idlFactory, {
      agent,
      canisterId: rqhCanisterId,
    });

    const createRequest = {
      partition_id: personaId,
      skill_category: skillCategory,
      initial_score: initialScore ? [initialScore] : []
    };

    const response: any = await actor.create_reputation_bucket(createRequest);

    if (!response.ok || !response.data || response.data.length === 0) {
      return NextResponse.json({
        ok: false,
        error: response.error?.[0] || 'Failed to create reputation bucket'
      }, { status: 500 });
    }

    // Convert BigInt values to Numbers
    const reputationData = convertBigIntToNumber(response.data[0]);

    // Sync to Supabase
    const { data: bucketId } = await supabase
      .rpc('sync_reputation_from_rqh', {
        p_partition_id: personaId,
        p_bucket_level: reputationData.bucket,
        p_score: reputationData.score,
        p_evidence_count: reputationData.evidence_count,
        p_rqh_bucket_id: reputationData.id
      });

    // Link to persona
    if (bucketId) {
      await supabase
        .from('reputation_bucket')
        .update({ persona_id: personaId })
        .eq('id', bucketId);
    }

    return NextResponse.json({
      ok: true,
      data: reputationData
    });

  } catch (error: any) {
    console.error('Error creating reputation bucket:', error);
    return NextResponse.json({
      ok: false,
      error: error.message || 'Failed to create reputation bucket'
    }, { status: 500 });
  }
}
