/**
 * Reputation Sync API
 * 
 * POST /api/crm/reputation/sync - Sync persona reputation to RQH canister
 * GET /api/crm/reputation/sync/status - Get canister sync status
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  syncReputationToRQH,
  fetchAndSyncReputationFromRQH,
  getCanisterSyncStatus,
} from '@/services/crm/taskCanisterService';
import { getPersonaReputation, getLatestReputationEvent } from '@/services/crm/taskService';
import { getCrmClient } from '@/services/crm/crmDataAccess';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { personaId, partitionId, direction = 'push' } = body;

    if (!personaId) {
      return NextResponse.json(
        { error: 'personaId is required' },
        { status: 400 }
      );
    }

    // Get persona's kybeDid if partitionId not provided
    let effectivePartitionId = partitionId;
    if (!effectivePartitionId) {
      const client = getCrmClient();
      const { data: persona } = await client
        .from('crm_personas')
        .select('kybe_did')
        .eq('id', personaId)
        .single();
      
      if (persona?.kybe_did) {
        effectivePartitionId = persona.kybe_did;
      } else {
        return NextResponse.json(
          { error: 'Persona has no kybeDid for RQH sync. Link a KYBE identity first.' },
          { status: 400 }
        );
      }
    }

    if (direction === 'pull') {
      // Fetch from RQH and update CRM
      const reputation = await fetchAndSyncReputationFromRQH(personaId, effectivePartitionId);
      
      if (!reputation) {
        return NextResponse.json(
          { error: 'No reputation found in RQH for this partition' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        direction: 'pull',
        reputation,
        message: 'Reputation synced from RQH canister',
      });
    }

    // Push to RQH (default)
    // Get latest reputation event to sync
    const latestEvent = await getLatestReputationEvent(personaId);
    
    if (!latestEvent) {
      // No events to sync, just verify bucket exists
      const result = await syncReputationToRQH({
        personaId,
        partitionId: effectivePartitionId,
        reputationEvent: {
          id: '',
          tenantId: '',
          personaId,
          sourceType: 'manual_sync',
          sourceId: 'api',
          deltaTechnical: 0,
          deltaCreative: 0,
          deltaEntrepreneurial: 0,
          deltaDataArch: 0,
          deltaCommunity: 0,
          deltaOverall: 0,
          cvs: 0,
          reason: 'Manual sync verification',
          createdAt: new Date().toISOString(),
        },
        skillCategory: 'general',
      });

      return NextResponse.json({
        success: result.success,
        direction: 'push',
        bucketId: result.bucketId,
        message: result.success 
          ? 'RQH bucket verified/created' 
          : result.error,
      });
    }

    // Sync latest event
    const result = await syncReputationToRQH({
      personaId,
      partitionId: effectivePartitionId,
      reputationEvent: latestEvent,
      skillCategory: latestEvent.taskTemplateId ? undefined : 'general',
    });

    return NextResponse.json({
      success: result.success,
      direction: 'push',
      bucketId: result.bucketId,
      eventId: latestEvent.id,
      message: result.success 
        ? 'Reputation synced to RQH canister' 
        : result.error,
    });
  } catch (error: unknown) {
    console.error('[API] POST /api/crm/reputation/sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync reputation' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const status = await getCanisterSyncStatus();

    return NextResponse.json({
      success: true,
      status,
      message: status.rewardHubConnected && status.rqhConnected
        ? 'All canisters connected'
        : 'Some canisters not connected',
    });
  } catch (error: unknown) {
    console.error('[API] GET /api/crm/reputation/sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
