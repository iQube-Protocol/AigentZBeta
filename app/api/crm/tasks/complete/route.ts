/**
 * Task Completion API
 * 
 * POST /api/crm/tasks/complete - Complete a task (submit + review in one step)
 * 
 * This is the core endpoint that orchestrates:
 * 1. Contribution scoring and acceptance
 * 2. Reward creation (QCT, QOYN, KNYT)
 * 3. Reputation event creation
 * 4. Persona reputation vector update
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  completeTask,
  submitTask,
  rejectTask,
} from '@/services/crm/taskService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      contributionId,
      action,  // 'submit', 'complete', 'reject'
      // For submit
      artifactUrl,
      artifactMetadata,
      // For complete
      finalScore,
      qualityScore,
      trustScore,
      scoringBreakdown,
      reviewerPersonaId,
      // For reject
      rejectionReason,
      // Common
      notes,
    } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    if (!contributionId) {
      return NextResponse.json(
        { error: 'contributionId is required' },
        { status: 400 }
      );
    }

    // Handle different actions
    switch (action) {
      case 'submit': {
        const contribution = await submitTask({
          tenantId,
          contributionId,
          artifactUrl,
          artifactMetadata,
          notes,
        });

        return NextResponse.json({
          contribution,
          message: 'Task submitted for review',
        });
      }

      case 'reject': {
        if (!rejectionReason) {
          return NextResponse.json(
            { error: 'rejectionReason is required for rejection' },
            { status: 400 }
          );
        }

        const contribution = await rejectTask(
          tenantId,
          contributionId,
          rejectionReason,
          reviewerPersonaId
        );

        return NextResponse.json({
          contribution,
          message: 'Task rejected',
        });
      }

      case 'complete':
      default: {
        if (finalScore === undefined || finalScore === null) {
          return NextResponse.json(
            { error: 'finalScore is required for completion (0-100)' },
            { status: 400 }
          );
        }

        if (finalScore < 0 || finalScore > 100) {
          return NextResponse.json(
            { error: 'finalScore must be between 0 and 100' },
            { status: 400 }
          );
        }

        const result = await completeTask({
          tenantId,
          contributionId,
          finalScore,
          qualityScore,
          trustScore,
          scoringBreakdown,
          reviewerPersonaId,
          notes,
        });

        return NextResponse.json({
          contribution: result.contribution,
          task: result.task,
          rewards: result.rewards,
          reputationEvent: result.reputationEvent,
          reputationDeltas: result.reputationDeltas,
          cvs: result.cvs,
          message: `Task completed with score ${finalScore}. Created ${result.rewards.length} reward(s) and updated reputation.`,
        });
      }
    }
  } catch (error: unknown) {
    console.error('[API] POST /api/crm/tasks/complete error:', error);
    
    const message = error instanceof Error ? error.message : 'Failed to process task';
    const status = message.includes('not found') ? 404 :
                   message.includes('Cannot') || message.includes('must be') ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
