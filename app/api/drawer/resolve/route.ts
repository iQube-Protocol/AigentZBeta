/**
 * Drawer Resolve API
 * 
 * POST /api/drawer/resolve - Resolve a drawer set with visibility filtering and slot data
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  drawerService,
  filterDrawerSet,
  resolveSlots,
  type VisibilityContext,
  type ResolutionContext,
} from '@/services/drawer';
import { walletFixtures } from '@/services/wallet/fixtures/walletQubeFixtures';
import type { Device } from '@/types/smartDrawer';

export const runtime = 'nodejs';

interface ResolveRequest {
  /** DrawerSet ID or query */
  drawerSetId?: string;
  query?: {
    appId: string;
    tenantId: string;
    personaId: string;
  };
  
  /** Visibility context */
  personaId: string;
  device: Device;
  appId: string;
  tenantId: string;
  
  /** Optional: current content for slot resolution */
  currentContentId?: string;
  currentContent?: any;
  
  /** Optional: resolve slot data */
  resolveSlotData?: boolean;
  
  /** Optional: specific drawer/tab to resolve */
  drawerId?: string;
  tabId?: string;
}

/**
 * POST /api/drawer/resolve
 * 
 * Resolves a drawer set with:
 * 1. Visibility filtering based on persona, device, entitlements
 * 2. Optional slot data resolution
 */
export async function POST(request: NextRequest) {
  try {
    const body: ResolveRequest = await request.json();

    const personaId = body.personaId ?? body.query?.personaId;
    const appId = body.appId ?? body.query?.appId;
    const tenantId = body.tenantId ?? body.query?.tenantId;
    const device: Device = (body.device as Device) ?? 'mobile';

    // Get drawer set
    let drawerSet;
    if (body.drawerSetId) {
      drawerSet = await drawerService.getDrawerSetById(body.drawerSetId);
    } else if (body.query) {
      drawerSet = await drawerService.getDrawerSet(body.query);
    }

    if (!drawerSet) {
      return NextResponse.json(
        { error: 'DrawerSet not found' },
        { status: 404 }
      );
    }

    // Get wallet data (use fixtures for now)
    const wallet = appId === 'metaKnyts' 
      ? walletFixtures.metaKnyts 
      : appId === 'Qriptopian'
        ? walletFixtures.qriptopian
        : undefined;

    // Build visibility context
    const visibilityCtx: VisibilityContext = {
      personaId,
      device,
      wallet,
      appId,
      tenantId,
      reputationScore: wallet?.rewards?.reduce((sum, r) => sum + r.progress * 100, 0) ?? 0,
      identityState: wallet?.identityState,
    };

    // Filter drawer set
    const filtered = filterDrawerSet(drawerSet, visibilityCtx);

    // Optionally resolve slot data
    let slotData: Record<string, any> = {};
    
    if (body.resolveSlotData) {
      const resolutionCtx: ResolutionContext = {
        currentContentId: body.currentContentId,
        currentContent: body.currentContent,
        wallet,
        device,
        appId,
        personaId,
        tenantId,
      };

      // Resolve slots for specific drawer/tab or all
      for (const fd of filtered.drawers) {
        if (body.drawerId && fd.drawer.id !== body.drawerId) continue;
        
        for (const ft of fd.tabs) {
          if (body.tabId && ft.tab.id !== body.tabId) continue;
          
          const resolved = await resolveSlots(ft.slots, resolutionCtx);
          
          for (const [slotId, data] of resolved) {
            slotData[`${fd.drawer.id}/${ft.tab.id}/${slotId}`] = data;
          }
        }
      }
    }

    return NextResponse.json({
      drawerSet: {
        id: drawerSet.id,
        appId: drawerSet.appId,
        dynamicMode: drawerSet.dynamicMode,
      },
      filtered: {
        drawers: filtered.drawers.map((fd) => ({
          id: fd.drawer.id,
          label: fd.drawer.label,
          icon: fd.drawer.icon,
          side: fd.drawer.side,
          isVisible: fd.isVisible,
          hiddenReason: fd.hiddenReason,
          tabs: fd.tabs.map((ft) => ({
            id: ft.tab.id,
            label: ft.tab.label,
            modalityFocus: ft.tab.modalityFocus,
            isVisible: ft.isVisible,
            hiddenReason: ft.hiddenReason,
            slotCount: ft.slots.length,
            hiddenSlotCount: ft.hiddenSlotCount,
            hasAgentPanel: !!ft.tab.agentPanel,
            agentPanel: ft.tab.agentPanel,
          })),
          hiddenTabCount: fd.hiddenTabCount,
        })),
        hiddenDrawerCount: filtered.hiddenDrawerCount,
      },
      slotData: body.resolveSlotData ? slotData : undefined,
      context: {
        personaId,
        device,
        identityState: wallet?.identityState ?? 'anon',
        reputationScore: visibilityCtx.reputationScore,
      },
    });
  } catch (error) {
    console.error('[Drawer Resolve API] error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
