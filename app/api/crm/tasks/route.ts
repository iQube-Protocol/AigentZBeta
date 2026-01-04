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
import { getCrmClient } from '@/services/crm/crmDataAccess';

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

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

async function resolveCampaignPersonaId(rawPersonaId: string): Promise<string | null> {
  const client = getCrmClient();
  const trimmed = rawPersonaId.trim();

  if (!trimmed) return null;

  if (isUuid(trimmed)) {
    const { data: crmPersona } = await client
      .from('crm_personas')
      .select('identity_persona_id')
      .eq('id', trimmed)
      .maybeSingle();

    if (crmPersona?.identity_persona_id) return crmPersona.identity_persona_id;

    const { data: identityPersona } = await client
      .from('persona')
      .select('id')
      .eq('id', trimmed)
      .maybeSingle();

    if (identityPersona?.id) return identityPersona.id;

    const { data: personaQube } = await client
      .from('personas')
      .select('id')
      .eq('id', trimmed)
      .maybeSingle();

    if (personaQube?.id) return personaQube.id;
  }

  const normalized = trimmed.toLowerCase();

  const { data: identityByHandle } = await client
    .from('persona')
    .select('id')
    .eq('fio_handle', normalized)
    .maybeSingle();

  if (identityByHandle?.id) return identityByHandle.id;

  const { data: personaQubeByHandle } = await client
    .from('personas')
    .select('id')
    .eq('fio_handle', normalized)
    .maybeSingle();

  return personaQubeByHandle?.id ?? null;
}

async function resolveCampaignTenantMatchers(rawTenantId: string): Promise<string[]> {
  const client = getCrmClient();
  const trimmed = rawTenantId.trim();
  if (!trimmed) return [];

  const matchers = new Set<string>([trimmed]);

  const { data: tenantRow } = await client
    .from('tenants')
    .select('id, slug')
    .eq('id', trimmed)
    .maybeSingle();

  if (tenantRow?.slug) {
    matchers.add(tenantRow.slug);
  }

  const { data: tenantBySlug } = await client
    .from('tenants')
    .select('id, slug')
    .eq('slug', trimmed)
    .maybeSingle();

  if (tenantBySlug?.id) {
    matchers.add(tenantBySlug.id);
  }
  if (tenantBySlug?.slug) {
    matchers.add(tenantBySlug.slug);
  }

  return Array.from(matchers);
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

      const resolvedPersonaId = await resolveCampaignPersonaId(personaId);
      if (!resolvedPersonaId) {
        return NextResponse.json(
          { error: 'personaId could not be resolved for campaigns' },
          { status: 404 }
        );
      }

      const tenantMatchers = await resolveCampaignTenantMatchers(tenantId);
      const campaignViews = await getCampaignStateViewsForPersona(resolvedPersonaId);
      const filteredViews = campaignViews
        .map((view) => ({ view, definition: getCampaignDefinition(view.campaignId) }))
        .filter(({ definition }) => definition && (tenantMatchers.length === 0 || tenantMatchers.includes(definition.tenantId)))
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
