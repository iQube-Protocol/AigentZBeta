import { NextRequest, NextResponse } from 'next/server';
import { getStateManager } from '@/services/agui';
import { getContentCurationService } from '@/services/codex/ContentCurationService';
import { getEmbeddingService } from '@/services/content/embeddingService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// CORS headers for cross-origin requests from thin client
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, sessionId, personaId, context } = body;

    if (!query || !sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('[Codex Query] ========================================');
    console.log('[Codex Query] Received:', { query, sessionId, personaId });
    
    const intent = analyzeIntent(query);
    const template = selectTemplate(intent);
    
    console.log('[Codex Query] Intent:', intent);
    console.log('[Codex Query] Template:', template);
    
    // Fetch curated content
    const curationService = getContentCurationService();
    const content = await curationService.fetchContent({
      intent: intent.primary,
      focus: intent.focus,
      realm: context?.realm || 'digiterra',
      personaId,
      device: context?.device || 'desktop',
    });

    console.log('[Codex Query] Content fetched:', content.length, 'items');

    // Update SmartTriad state
    const stateManager = getStateManager();
    
    // Check if session exists
    const existingState = stateManager.getState(sessionId);
    if (!existingState) {
      console.warn('[Codex Query] ⚠️ Session not found, initializing:', sessionId);
      stateManager.initializeSession(sessionId, personaId, personaId, context?.device || 'desktop');
    }
    
    const delta = stateManager.updateState(sessionId, {
      liquidUI: {
        selectedTemplateId: template.templateId,
        templateBindings: { 
          contentObjects: content, 
          layoutDecisions: [] 
        },
        copilotState: {
          mode: 'docked',
          visible: true,
          position: { x: 0, y: 0, w: 400, h: 600 }
        },
        userIntent: intent.primary,
        realmContext: context?.realm || 'digiterra',
      },
    });

    if (delta) {
      console.log('[Codex Query] ✅ State updated, STATE_DELTA emitted for session:', sessionId);
    } else {
      console.error('[Codex Query] ❌ State update failed for session:', sessionId);
    }

    return NextResponse.json({
      success: true,
      intent: { primary: intent.primary, focus: intent.focus, confidence: intent.confidence },
      template: { templateId: template.templateId, reason: template.reason },
      contentCount: content.length,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('[Codex Query] Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500, headers: corsHeaders });
  }
}

function analyzeIntent(query: string) {
  const q = query.toLowerCase();
  if (/character|who|cast/.test(q)) return { primary: 'browse', focus: 'characters', confidence: 0.9 };
  if (/episode|comic|read/.test(q)) return { primary: 'browse', focus: 'episodes', confidence: 0.9 };
  if (/watch|video|motion/.test(q)) return { primary: 'watch', focus: 'episodes', confidence: 0.95 };
  return { primary: 'browse', confidence: 0.8 };
}

function selectTemplate(intent: any) {
  if (intent.primary === 'watch') return { templateId: 'knyt:motion_stage_v1', reason: 'Watch intent' };
  if (intent.focus) return { templateId: 'knyt:drawer_grid_v1', reason: `Browse ${intent.focus}` };
  return { templateId: 'knyt:drawer_grid_v1', reason: 'Default browse' };
}
