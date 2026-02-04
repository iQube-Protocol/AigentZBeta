/**
 * AG-UI Client for Qriptopian Web App
 * 
 * Thin client adapter that connects to Aigent Z platform's AG-UI endpoints
 * for server-authoritative UI state management.
 * 
 * This enables Qriptopian to:
 * - Receive STATE_SNAPSHOT and STATE_DELTA from Aigent Z
 * - Send user actions to the platform
 * - Render UI based on server-controlled state
 */

import { applyPatch, Operation } from 'fast-json-patch';

// State types from Aigent Z platform
export interface SmartTriadState {
  session: {
    sessionId: string;
    personaId: string;
    tenantId: string;
    device: 'mobile' | 'tablet' | 'desktop';
    viewport: { width: number; height: number };
  };
  smartTriad: {
    content: {
      currentContentId: string | null;
      ownedContentIds: string[];
      libraryLoading: boolean;
      selectedIssueId: string | null;
      selectedSectionId: string | null;
      selectedTabId: string | null;
    };
    wallet: {
      walletOpen: boolean;
      walletMode: 'narrow' | 'wide';
      purchaseInProgress: boolean;
      balances: Record<string, number>;
      pendingTx: { chain: string; txHash: string; status: string } | null;
    };
    menu: {
      activeMenuId: string | null;
      drawerOpen: boolean;
      selectedAction: string | null;
    };
  };
  liquidUI: {
    selectedTemplateId: string | null;
    templateBindings: {
      contentObjects: any[];
      layoutDecisions: any[];
    };
    copilotState: {
      mode: 'overlay' | 'docked' | 'collapsed';
      visible: boolean;
      position: { x: number; y: number; w: number; h: number };
    };
    realmContext: 'terra' | 'metaterra_or' | 'digiterra' | 'macro' | null;
    userIntent: string | null;
  };
  metadata: {
    version: string;
    timestamp: string;
    sequenceNumber: number;
  };
}

export interface StateDelta {
  sequenceNumber: number;
  patches: Operation[];
}

export type StateEvent =
  | { type: 'STATE_SNAPSHOT'; data: SmartTriadState }
  | { type: 'STATE_DELTA'; data: StateDelta }
  | { type: 'HEARTBEAT'; data: { timestamp: string } };

export type ActionType =
  | 'SELECT_CONTENT'
  | 'OPEN_WALLET'
  | 'CLOSE_WALLET'
  | 'PURCHASE_CONTENT'
  | 'SELECT_TEMPLATE'
  | 'CHANGE_REALM'
  | 'COPILOT_PROMPT';

export interface AGUIClientConfig {
  platformUrl: string; // Aigent Z platform URL
  sessionId?: string;
  personaId: string;
  tenantId?: string;
  device?: 'mobile' | 'tablet' | 'desktop';
  onStateUpdate?: (state: SmartTriadState) => void;
  onError?: (error: Error) => void;
}

export class AGUIClient {
  private config: AGUIClientConfig;
  private eventSource: EventSource | null = null;
  private currentState: SmartTriadState | null = null;
  private listeners: Set<(state: SmartTriadState) => void> = new Set();
  private sessionId: string;

  constructor(config: AGUIClientConfig) {
    this.config = config;
    this.sessionId = config.sessionId || this.generateSessionId();
  }

  /**
   * Connect to AG-UI stream
   */
  connect(): void {
    if (this.eventSource) {
      this.disconnect();
    }

    const params = new URLSearchParams({
      sessionId: this.sessionId,
      personaId: this.config.personaId,
      tenantId: this.config.tenantId || this.config.personaId,
      device: this.config.device || 'desktop',
    });

    const streamUrl = `${this.config.platformUrl}/api/a2a/agui/stream?${params}`;

    this.eventSource = new EventSource(streamUrl);

    this.eventSource.addEventListener('STATE_SNAPSHOT', (e) => {
      try {
        const state: SmartTriadState = JSON.parse(e.data);
        console.log('[AGUIClient] 📸 STATE_SNAPSHOT received:', {
          sessionId: state.session?.sessionId,
          template: state.liquidUI?.selectedTemplateId,
          contentCount: state.liquidUI?.templateBindings?.contentObjects?.length || 0
        });
        this.currentState = state;
        this.notifyListeners(state);
        this.config.onStateUpdate?.(state);
      } catch (error) {
        console.error('[AGUIClient] Error parsing STATE_SNAPSHOT:', error);
        this.config.onError?.(error as Error);
      }
    });

    this.eventSource.addEventListener('STATE_DELTA', (e) => {
      try {
        const delta: StateDelta = JSON.parse(e.data);
        console.log('[AGUIClient] 🔄 STATE_DELTA received:', {
          sequenceNumber: delta.sequenceNumber,
          patchCount: delta.patches.length,
          patches: delta.patches
        });
        
        if (this.currentState) {
          // Apply JSON Patch
          const newState = applyPatch(
            JSON.parse(JSON.stringify(this.currentState)),
            delta.patches,
            false,
            false
          ).newDocument as SmartTriadState;
          
          console.log('[AGUIClient] ✅ State updated:', {
            template: newState.liquidUI?.selectedTemplateId,
            contentCount: newState.liquidUI?.templateBindings?.contentObjects?.length || 0
          });
          
          this.currentState = newState;
          this.notifyListeners(newState);
          this.config.onStateUpdate?.(newState);
        }
      } catch (error) {
        console.error('[AGUIClient] Error applying STATE_DELTA:', error);
        this.config.onError?.(error as Error);
      }
    });

    this.eventSource.addEventListener('HEARTBEAT', (e) => {
      // Keep-alive, no action needed
    });

    this.eventSource.onerror = (error) => {
      this.config.onError?.(new Error('SSE connection error'));
    };
  }

  /**
   * Disconnect from AG-UI stream
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Send action to platform
   */
  async sendAction(type: ActionType, payload?: any): Promise<void> {
    const response = await fetch(`${this.config.platformUrl}/api/a2a/agui/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.sessionId,
        action: { type, payload },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send action');
    }
  }

  /**
   * Get current state
   */
  getState(): SmartTriadState | null {
    return this.currentState;
  }

  /**
   * Get the session ID (always available, even before STATE_SNAPSHOT)
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Subscribe to state updates
   */
  subscribe(listener: (state: SmartTriadState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(state: SmartTriadState): void {
    this.listeners.forEach(listener => listener(state));
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `qript_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance for Qriptopian app
let clientInstance: AGUIClient | null = null;

export function getAGUIClient(config?: AGUIClientConfig): AGUIClient {
  if (!clientInstance && config) {
    clientInstance = new AGUIClient(config);
  }
  if (!clientInstance) {
    throw new Error('AGUIClient not initialized. Call getAGUIClient with config first.');
  }
  return clientInstance;
}

export function initializeAGUIClient(config: AGUIClientConfig): AGUIClient {
  clientInstance = new AGUIClient(config);
  return clientInstance;
}
