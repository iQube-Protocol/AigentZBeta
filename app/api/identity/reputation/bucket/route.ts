import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/services/ops/icAgent';
import { rqhIDL } from '@/services/ops/idl/rqh';

export async function GET(req: NextRequest) {
  try {
    const partitionId = req.nextUrl.searchParams.get('partitionId');
    if (!partitionId) return NextResponse.json({ ok: false, error: 'partitionId required' }, { status: 400 });

    const canisterId = process.env.RQH_CANISTER_ID || process.env.NEXT_PUBLIC_RQH_CANISTER_ID;
    if (!canisterId) {
      return NextResponse.json({ ok: false, error: 'RQH canister not configured' }, { status: 501 });
    }

    const actor: any = await getActor(canisterId, rqhIDL);
    const response = await actor.get_reputation_bucket(partitionId);

    if (response.ok && response.data.length > 0) {
      const bucket = response.data[0];
      return NextResponse.json({ 
        ok: true, 
        data: { 
          bucket: Number(bucket.bucket),
          score: Number(bucket.score),
          skill_category: bucket.skill_category,
          evidence_count: Number(bucket.evidence_count),
          last_updated: Number(bucket.last_updated),
          created_at: Number(bucket.created_at)
        } 
      });
    } else {
      return NextResponse.json({ 
        ok: false, 
        error: response.error || 'No reputation bucket found for this partition ID' 
      }, { status: 404 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to fetch bucket' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { partitionId, skillCategory, initialScore } = body;
    
    if (!partitionId || !skillCategory) {
      return NextResponse.json({ ok: false, error: 'partitionId and skillCategory required' }, { status: 400 });
    }

    const canisterId = process.env.RQH_CANISTER_ID || process.env.NEXT_PUBLIC_RQH_CANISTER_ID;
    if (!canisterId) {
      return NextResponse.json({ ok: false, error: 'RQH canister not configured' }, { status: 501 });
    }

    const actor: any = await getActor(canisterId, rqhIDL);
    const request = {
      partition_id: partitionId,
      skill_category: skillCategory,
      initial_score: initialScore ? [Number(initialScore)] : []
    };
    
    const response = await actor.create_reputation_bucket(request);

    if (response.ok && response.data.length > 0) {
      const bucket = response.data[0];
      return NextResponse.json({ 
        ok: true, 
        data: { 
          id: bucket.id,
          partition_id: bucket.partition_id,
          bucket: Number(bucket.bucket),
          score: Number(bucket.score),
          skill_category: bucket.skill_category,
          evidence_count: Number(bucket.evidence_count),
          last_updated: Number(bucket.last_updated),
          created_at: Number(bucket.created_at)
        } 
      });
    } else {
      return NextResponse.json({ 
        ok: false, 
        error: response.error || 'Failed to create reputation bucket' 
      }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to create bucket' }, { status: 500 });
  }
}
