/**
 * KNYT Liquid UI API for Lovable Integration
 * 
 * Provides template selection and rendering data for Lovable thin client
 */

import { NextRequest, NextResponse } from 'next/server';

// Basic template data to avoid complex service dependencies
const basicTemplates = [
  {
    template_id: 'knyt:drawer_grid_v1',
    name: 'Drawer Grid',
    description: 'Grid layout for drawer mode',
    supported_intents: ['browse', 'discover'],
    supported_devices: ['mobile', 'tablet', 'desktop']
  },
  {
    template_id: 'knyt:motion_stage_v1',
    name: 'Motion Stage',
    description: 'Immersive stage for motion content',
    supported_intents: ['watch', 'immerse'],
    supported_devices: ['tablet', 'desktop']
  }
];

export async function POST(request: NextRequest) {
  try {
    const { intent, deviceType, personaId, data } = await request.json();

    // Simple template selection based on intent
    let selectedTemplate = basicTemplates[0]; // default
    
    if (intent === 'watch' || intent === 'immerse') {
      selectedTemplate = basicTemplates.find(t => t.template_id === 'knyt:motion_stage_v1') || basicTemplates[0];
    }

    // Return template and data for Lovable
    return NextResponse.json({
      success: true,
      template: selectedTemplate,
      data: {
        ...data,
        intent,
        deviceType,
        personaId,
      },
      context: {
        userIntent: intent || 'browse',
        device: deviceType || 'desktop',
      }
    });

  } catch (error) {
    console.error('KNYT Liquid UI API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return available templates and integration info
    return NextResponse.json({
      success: true,
      templates: basicTemplates,
      integration: {
        name: "KNYT Liquid UI",
        version: "1.0.0",
        supportedIntents: ["browse", "watch", "purchase", "manage_wallet"],
        supportedDevices: ["mobile", "tablet", "desktop"],
      },
      capabilities: {
        liquid_ui: true,
        thin_client: true,
        commerce: true,
        real_time_balance: true,
        purchase_webhooks: true,
      },
    });

  } catch (error) {
    console.error('KNYT Liquid UI GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
