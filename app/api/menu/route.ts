/**
 * Menu API
 * 
 * GET /api/menu?appId=...&personaId=...
 * Returns the menu configuration for the specified app and persona
 */

import { NextRequest, NextResponse } from 'next/server';
import { menuConfigs } from '@/services/menu';
import { filterVisibleSections, createInitialMenuState } from '@/services/menu';
import type { MenuContext } from '@/types/smartMenu';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get('appId') || 'metaKnyts';
  const personaId = searchParams.get('personaId') || 'default';
  const deviceType = (searchParams.get('deviceType') || 'desktop') as 'mobile' | 'desktop' | 'tv';

  const config = menuConfigs[appId as keyof typeof menuConfigs];
  
  if (!config) {
    return NextResponse.json(
      { error: `No menu config found for app: ${appId}` },
      { status: 404 }
    );
  }

  const context: MenuContext = {
    appId: appId as any,
    personaId,
    identityState: 'pseudo',
    deviceType,
  };

  const filteredNav = filterVisibleSections(config.primaryNav, context);
  const initialState = createInitialMenuState(config);

  return NextResponse.json({
    config: {
      ...config,
      primaryNav: filteredNav,
    },
    initialState,
  });
}
