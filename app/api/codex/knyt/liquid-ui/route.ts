/**
 * KNYT Liquid UI API for Lovable Integration
 * 
 * Provides template selection and rendering data for Lovable thin client
 */

import { NextRequest, NextResponse } from 'next/server';
import { knytLiquidUIService } from '@/app/services/knyt/knytLiquidUIService';

export async function POST(request: NextRequest) {
  try {
    const { intent, deviceType, personaId, data } = await request.json();

    // Select appropriate template based on intent and context
    // Convert to new interface format
    const context = {
      userIntent: intent || 'browse',
      device: deviceType || 'desktop',
      contentMix: {
        hasEpisodes: false,
        hasCharacters: false,
        hasLore: false,
        hasMetaKnyts: false,
        totalItems: 0,
        ownedCount: 0,
      },
      realm: 'digiterra' as const,
      taskState: 'idle' as const,
      isFirstVisit: false,
      personaId,
    };

    const selectionResult = knytLiquidUIService.selectTemplate(context);

    // Get additional data based on intent
    let enrichedData = { ...data };

    if (intent === 'browse_codex' || intent === 'view_cards') {
      // Fetch KNYT cards data
      const cardsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/codex/knyt-cards`);
      if (cardsResponse.ok) {
        enrichedData.cards = await cardsResponse.json();
      }
    }

    if (personaId) {
      // Fetch user's KNYT balance
      const balanceResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/wallet/knyt/balance?personaId=${personaId}`);
      if (balanceResponse.ok) {
        enrichedData.balance = await balanceResponse.json();
      }
    }

    // Return template and data for Lovable
    return NextResponse.json({
      success: true,
      template: selectionResult.templateId,
      drawerMode: selectionResult.drawerMode,
      copilotMode: selectionResult.copilotMode,
      walletUI: selectionResult.walletUI,
      data: enrichedData,
      apiEndpoints: [
        '/api/codex/knyt-cards',
        '/api/wallet/knyt/balance',
        '/api/wallet/knyt/purchase',
      ],
      webhookUrls: [
        '/api/webhooks/lovable/knyt-purchase',
        '/api/webhooks/lovable/knyt-balance-update',
      ],
    });

  } catch (error) {
    console.error('KNYT Liquid UI API Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return available templates and integration info
    const integrationData = knytLiquidUIService.getLovableIntegrationData();

    return NextResponse.json({
      success: true,
      templates: knytLiquidUIService.getAllTemplates(),
      integration: integrationData,
      capabilities: {
        liquid_ui: true,
        thin_client: true,
        commerce: true,
        real_time_balance: true,
        purchase_webhooks: true,
      },
    });

  } catch (error) {
    console.error('KNYT Liquid UI GET Error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
