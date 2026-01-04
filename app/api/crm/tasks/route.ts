/**
 * Task Templates API
 * 
 * GET /api/crm/tasks - List task templates
 * POST /api/crm/tasks - Create a new task template
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listTaskTemplates,
  createTaskTemplate,
  getTaskStats,
} from '@/services/crm/taskService';
import { TaskCategory } from '@/types/crm';
import { getCampaignDefinition } from '@/services/campaign/campaignRegistry';
import { getCampaignStateViewsForPersona } from '@/services/campaign/campaignService';

function campaignViewToTask(tenantId: string, view: any) {
  const now = new Date().toISOString();
  return {
    id: `campaign:${view.campaignId}`,
    tenantId,
    slug: view.campaignId,
    title: view.title,
    description: `Progress ${view.currentStep}/${view.totalSteps} • ${Math.round(view.progress)}%`,
    category: 'community' as TaskCategory,
    isKnowledgePillar: false,
    isComputePillar: false,
    difficultyLevel: 1,
    expectedImpactLevel: 2,
    verificationMode: 'manual',
    verificationConfig: null,
    rewardQct: 0,
    rewardQoyn: 0,
    rewardKnyt: 0,
    repWeightTechnical: 0,
    repWeightCreative: 0,
    repWeightEntrepreneurial: 0,
    repWeightDataArch: 0,
    repWeightCommunity: 0,
    impactEnabled: false,
    impactMultiplierMax: 1,
    impactLookbackDays: 0,
    isActive: false,
    maxClaims: null,
    currentClaims: 0,
    expiresAt: null,
    createdByPersonaId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const category = searchParams.get('category') as TaskCategory | null;
    const isActive = searchParams.get('isActive');
    const stats = searchParams.get('stats');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const source = searchParams.get('source') || 'crm';
    const personaId = searchParams.get('personaId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    if (source === 'campaign') {
      if (!personaId) {
        return NextResponse.json(
          { error: 'personaId is required for campaign tasks' },
          { status: 400 }
        );
      }

      const campaignViews = await getCampaignStateViewsForPersona(personaId);
      const filteredViews = campaignViews
        .map((view) => ({ view, definition: getCampaignDefinition(view.campaignId) }))
        .filter(({ definition }) => definition?.tenantId === tenantId)
        .map(({ view }) => view);

      if (stats === 'true') {
        const totalTasks = filteredViews.length;
        const totalCompletions = filteredViews.filter((view) => view.progress >= 100).length;
        const totalClaims = filteredViews.filter((view) => view.progress > 0).length;
        const activeTasks = totalTasks - totalCompletions;

        return NextResponse.json({
          stats: {
            totalTasks,
            activeTasks,
            totalClaims,
            totalCompletions,
          },
        });
      }

      const tasks = filteredViews.map((view) => campaignViewToTask(tenantId, view));

      return NextResponse.json({ tasks });
    }

    // Return stats if requested
    if (stats === 'true') {
      const taskStats = await getTaskStats(tenantId);
      return NextResponse.json({ stats: taskStats });
    }

    const tasks = await listTaskTemplates({
      tenantId,
      category: category || undefined,
      isActive: isActive ? isActive === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    return NextResponse.json({ tasks });
  } catch (error: unknown) {
    console.error('[API] GET /api/crm/tasks error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantId,
      slug,
      title,
      description,
      category,
      difficultyLevel,
      expectedImpactLevel,
      verificationMode,
      rewardQct,
      rewardQoyn,
      rewardKnyt,
      repWeightTechnical,
      repWeightCreative,
      repWeightEntrepreneurial,
      repWeightDataArch,
      repWeightCommunity,
      impactEnabled,
      maxClaims,
      expiresAt,
      createdByPersonaId,
    } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    if (!slug) {
      return NextResponse.json(
        { error: 'slug is required' },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { error: 'category is required' },
        { status: 400 }
      );
    }

    const task = await createTaskTemplate({
      tenantId,
      slug,
      title,
      description,
      category,
      difficultyLevel,
      expectedImpactLevel,
      verificationMode,
      rewardQct,
      rewardQoyn,
      rewardKnyt,
      repWeightTechnical,
      repWeightCreative,
      repWeightEntrepreneurial,
      repWeightDataArch,
      repWeightCommunity,
      impactEnabled,
      maxClaims,
      expiresAt,
      createdByPersonaId,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error: unknown) {
    console.error('[API] POST /api/crm/tasks error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create task' },
      { status: 500 }
    );
  }
}
