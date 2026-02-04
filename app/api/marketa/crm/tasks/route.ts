import { NextRequest, NextResponse } from 'next/server';
import { taskService } from '@/services/crm/taskService';
import type { CrmContribution } from '@/types/crm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || 'kn0w1';
    const personaId = searchParams.get('personaId');
    
    // Get task templates
    const taskTemplates = await taskService.listTaskTemplates({
      tenantId,
      limit: 50
    });

    // Get tasks for this persona if provided
    let tasks: CrmContribution[] = [];
    if (personaId) {
      tasks = await taskService.getTasksByPersona({
        tenantId,
        personaId,
        limit: 50
      });
    }

    return NextResponse.json({
      success: true,
      taskTemplates,
      tasks
    });
  } catch (error: any) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, taskTemplateId, personaId, action } = body;

    if (!tenantId || !taskTemplateId || !personaId || !action) {
      return NextResponse.json(
        { error: 'tenantId, taskTemplateId, personaId, and action are required' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'claim':
        result = await taskService.claimTask({
          tenantId,
          taskTemplateId,
          personaId,
          source: 'marketa-cartridge'
        });
        break;

      case 'submit':
        {
          const { contributionId, artifactUrl, artifactMetadata, notes } = body as {
            contributionId?: string;
            artifactUrl?: string;
            artifactMetadata?: Record<string, unknown>;
            notes?: string;
          };

          let effectiveContributionId = contributionId;
          if (!effectiveContributionId) {
            const [latestClaim] = await taskService.getTasksByPersona({
              tenantId,
              personaId,
              statuses: ['claimed'],
              limit: 1,
            });
            if (!latestClaim?.id) throw new Error('No claimed task contribution found to submit');
            effectiveContributionId = latestClaim.id;
          }

          result = await taskService.submitTask({
            tenantId,
            contributionId: effectiveContributionId,
            artifactUrl,
            artifactMetadata,
            notes,
          });
        }
        break;

      case 'complete':
        {
          const { contributionId, finalScore, qualityScore, trustScore, scoringBreakdown, reviewerPersonaId, notes } = body as {
            contributionId?: string;
            finalScore?: number;
            qualityScore?: number;
            trustScore?: number;
            scoringBreakdown?: Record<string, unknown>;
            reviewerPersonaId?: string;
            notes?: string;
          };

          if (typeof finalScore !== 'number') {
            return NextResponse.json({ error: 'finalScore is required for complete' }, { status: 400 });
          }

          let effectiveContributionId = contributionId;
          if (!effectiveContributionId) {
            const [latestSubmitted] = await taskService.getTasksByPersona({
              tenantId,
              personaId,
              statuses: ['submitted', 'under_review'],
              limit: 1,
            });
            if (!latestSubmitted?.id) throw new Error('No submitted task contribution found to complete');
            effectiveContributionId = latestSubmitted.id;
          }

          result = await taskService.completeTask({
            tenantId,
            contributionId: effectiveContributionId,
            finalScore,
            qualityScore,
            trustScore,
            scoringBreakdown,
            reviewerPersonaId,
            notes,
          });
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be claim, submit, or complete' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      task: result
    });
  } catch (error: any) {
    console.error('Failed to process task action:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process task action' },
      { status: 500 }
    );
  }
}
