/**
 * Copilot Compile API
 * 
 * POST /api/copilot/compile - Compile a prompt into drawer configuration (stateless)
 */

import { NextRequest, NextResponse } from 'next/server';
import { compileDrawerPrompt } from '@/services/copilot';
import { drawerService } from '@/services/drawer';
import type { Device, Modality } from '@/types/smartDrawer';

export const runtime = 'nodejs';

/**
 * POST /api/copilot/compile
 * 
 * Stateless compilation of a prompt into drawer configuration.
 * Does not require a session - useful for previewing changes.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      appId,
      tenantId,
      personaId,
      device = 'desktop',
      existingDrawerSetId,
      modalityFocus,
      maxSlotsPerTab,
    } = body;

    if (!prompt || !appId || !tenantId || !personaId) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt, appId, tenantId, personaId' },
        { status: 400 }
      );
    }

    // Get existing drawer set if specified
    let existingDrawerSet = undefined;
    if (existingDrawerSetId) {
      existingDrawerSet = await drawerService.getDrawerSetById(existingDrawerSetId) ?? undefined;
    }

    // Compile
    const result = await compileDrawerPrompt({
      prompt,
      appId,
      tenantId,
      personaId,
      device: device as Device,
      existingDrawerSet,
      modalityFocus: modalityFocus as Modality | undefined,
      maxSlotsPerTab,
    });

    return NextResponse.json({
      drawerSet: {
        id: result.drawerSet.id,
        appId: result.drawerSet.appId,
        dynamicMode: result.drawerSet.dynamicMode,
        drawers: result.drawerSet.drawers.map((d) => ({
          id: d.id,
          label: d.label,
          side: d.side,
          tabs: d.tabs.map((t) => ({
            id: t.id,
            label: t.label,
            modalityFocus: t.modalityFocus,
            slots: t.slots.map((s) => ({
              id: s.id,
              cardVariant: s.cardVariant,
              dataSource: s.dataSource,
            })),
            hasAgentPanel: !!t.agentPanel,
            agentPanel: t.agentPanel,
          })),
        })),
      },
      changes: result.changes,
      reasoning: result.reasoning,
      confidence: result.confidence,
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('[Copilot Compile API] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
