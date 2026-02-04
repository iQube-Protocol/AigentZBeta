/**
 * AG-UI Send Action Endpoint
 * 
 * Receives user actions from thin clients and updates SmartTriad state.
 * Emits STATE_DELTA via SSE stream.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStateManager } from '@/services/agui/SmartTriadStateManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ActionType =
  | 'SELECT_CONTENT'
  | 'OPEN_WALLET'
  | 'CLOSE_WALLET'
  | 'PURCHASE_CONTENT'
  | 'SELECT_TEMPLATE'
  | 'CHANGE_REALM'
  | 'COPILOT_PROMPT';

interface Action {
  type: ActionType;
  payload?: any;
}

interface ActionRequest {
  sessionId: string;
  action: Action;
}

export async function POST(req: NextRequest) {
  try {
    const body: ActionRequest = await req.json();
    const { sessionId, action } = body;

    if (!sessionId || !action || !action.type) {
      return NextResponse.json(
        { success: false, error: 'Invalid request: missing sessionId or action' },
        { status: 400 }
      );
    }

    const stateManager = getStateManager();
    const currentState = stateManager.getState(sessionId);

    if (!currentState) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Process action and update state
    let delta = null;

    switch (action.type) {
      case 'SELECT_CONTENT':
        delta = stateManager.updateField(
          sessionId,
          'smartTriad/content/currentContentId',
          action.payload?.contentId || null
        );
        break;

      case 'OPEN_WALLET':
        delta = stateManager.updateState(sessionId, {
          smartTriad: {
            ...currentState.smartTriad,
            wallet: {
              ...currentState.smartTriad.wallet,
              walletOpen: true,
              walletMode: action.payload?.mode || 'narrow',
            },
          },
        });
        break;

      case 'CLOSE_WALLET':
        delta = stateManager.updateField(sessionId, 'smartTriad/wallet/walletOpen', false);
        break;

      case 'PURCHASE_CONTENT':
        // Mark purchase in progress
        delta = stateManager.updateField(
          sessionId,
          'smartTriad/wallet/purchaseInProgress',
          true
        );
        // In real implementation, would trigger payment flow here
        break;

      case 'SELECT_TEMPLATE':
        delta = stateManager.updateState(sessionId, {
          liquidUI: {
            ...currentState.liquidUI,
            selectedTemplateId: action.payload?.templateId || null,
            templateBindings: action.payload?.bindings || currentState.liquidUI.templateBindings,
          },
        });
        break;

      case 'CHANGE_REALM':
        delta = stateManager.updateField(
          sessionId,
          'liquidUI/realmContext',
          action.payload?.realm || null
        );
        break;

      case 'COPILOT_PROMPT':
        // Update user intent from prompt
        delta = stateManager.updateField(
          sessionId,
          'liquidUI/userIntent',
          action.payload?.prompt || null
        );
        // In real implementation, would trigger Copilot processing here
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action type: ${action.type}` },
          { status: 400 }
        );
    }

    if (!delta) {
      return NextResponse.json(
        { success: false, error: 'No state change occurred' },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      sequenceNumber: delta.sequenceNumber,
      message: `Action ${action.type} processed, STATE_DELTA emitted`,
    });
  } catch (error: any) {
    console.error('Error processing action:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
