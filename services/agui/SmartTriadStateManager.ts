/**
 * SmartTriad State Manager
 * 
 * Server-authoritative state management for SmartTriad (Content + Wallet + Menu)
 * with Liquid UI template rendering.
 * 
 * Implements:
 * - STATE_SNAPSHOT: Full state emission
 * - STATE_DELTA: RFC6902 JSON Patch for incremental updates
 * - Session management with sequence numbers
 */

import { applyPatch, compare } from 'fast-json-patch';

// State types matching smarttriad_liquidui_state_schema_v0_1.json
export interface SmartTriadState {
  session: {
    sessionId: string;
    personaId: string;
    tenantId: string;
    device?: 'mobile' | 'tablet' | 'desktop';
    viewport?: {
      width: number;
      height: number;
    };
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
      pendingTx: {
        chain: string;
        txHash: string;
        status: string;
      } | null;
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
      position: {
        x: number;
        y: number;
        w: number;
        h: number;
      };
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
  patches: Array<{
    op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
    path: string;
    value?: any;
    from?: string;
  }>;
}

export class SmartTriadStateManager {
  private states: Map<string, SmartTriadState> = new Map();
  private listeners: Map<string, Set<(event: StateEvent) => void>> = new Map();

  /**
   * Initialize state for a new session
   */
  initializeSession(
    sessionId: string,
    personaId: string,
    tenantId: string,
    device: 'mobile' | 'tablet' | 'desktop' = 'desktop'
  ): SmartTriadState {
    const initialState: SmartTriadState = {
      session: {
        sessionId,
        personaId,
        tenantId,
        device,
        viewport: {
          width: device === 'mobile' ? 390 : device === 'tablet' ? 768 : 1920,
          height: device === 'mobile' ? 844 : device === 'tablet' ? 1024 : 1080,
        },
      },
      smartTriad: {
        content: {
          currentContentId: null,
          ownedContentIds: [],
          libraryLoading: false,
          selectedIssueId: null,
          selectedSectionId: null,
          selectedTabId: null,
        },
        wallet: {
          walletOpen: false,
          walletMode: 'narrow',
          purchaseInProgress: false,
          balances: {},
          pendingTx: null,
        },
        menu: {
          activeMenuId: null,
          drawerOpen: false,
          selectedAction: null,
        },
      },
      liquidUI: {
        selectedTemplateId: null,
        templateBindings: {
          contentObjects: [],
          layoutDecisions: [],
        },
        copilotState: {
          mode: 'overlay',
          visible: false,
          position: { x: 0.64, y: 0.14, w: 0.32, h: 0.78 },
        },
        realmContext: null,
        userIntent: null,
      },
      metadata: {
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        sequenceNumber: 0,
      },
    };

    this.states.set(sessionId, initialState);
    return initialState;
  }

  /**
   * Get current state for a session
   */
  getState(sessionId: string): SmartTriadState | null {
    return this.states.get(sessionId) || null;
  }

  /**
   * Update state and emit STATE_DELTA
   */
  updateState(sessionId: string, updates: Partial<SmartTriadState>): StateDelta | null {
    const currentState = this.states.get(sessionId);
    if (!currentState) return null;

    // Deep clone current state
    const previousState = JSON.parse(JSON.stringify(currentState));

    // Apply updates
    const newState: SmartTriadState = {
      ...currentState,
      ...updates,
      metadata: {
        ...currentState.metadata,
        timestamp: new Date().toISOString(),
        sequenceNumber: currentState.metadata.sequenceNumber + 1,
      },
    };

    // Generate JSON Patch (RFC6902)
    const patches = compare(previousState, newState);

    if (patches.length === 0) return null;

    // Update stored state
    this.states.set(sessionId, newState);

    // Create delta
    const delta: StateDelta = {
      sequenceNumber: newState.metadata.sequenceNumber,
      patches: patches as any,
    };

    // Emit to listeners
    this.emitEvent(sessionId, {
      type: 'STATE_DELTA',
      data: delta,
    });

    return delta;
  }

  /**
   * Update specific field and emit STATE_DELTA
   */
  updateField(sessionId: string, path: string, value: any): StateDelta | null {
    const currentState = this.states.get(sessionId);
    if (!currentState) return null;

    const previousState = JSON.parse(JSON.stringify(currentState));

    // Apply patch to current state
    const newState = JSON.parse(JSON.stringify(currentState));
    const pathParts = path.split('/').filter(p => p);
    
    let target: any = newState;
    for (let i = 0; i < pathParts.length - 1; i++) {
      target = target[pathParts[i]];
    }
    target[pathParts[pathParts.length - 1]] = value;

    // Update metadata
    newState.metadata.timestamp = new Date().toISOString();
    newState.metadata.sequenceNumber = currentState.metadata.sequenceNumber + 1;

    // Generate patches
    const patches = compare(previousState, newState);

    if (patches.length === 0) return null;

    this.states.set(sessionId, newState);

    const delta: StateDelta = {
      sequenceNumber: newState.metadata.sequenceNumber,
      patches: patches as any,
    };

    this.emitEvent(sessionId, {
      type: 'STATE_DELTA',
      data: delta,
    });

    return delta;
  }

  /**
   * Register event listener for a session
   */
  addEventListener(sessionId: string, listener: (event: StateEvent) => void): () => void {
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, new Set());
    }
    this.listeners.get(sessionId)!.add(listener);

    console.log(`[StateManager] 📡 Listener ADDED for session: ${sessionId}, total listeners: ${this.listeners.get(sessionId)?.size}, all sessions: ${Array.from(this.listeners.keys()).join(', ')}`);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(sessionId);
      if (listeners) {
        listeners.delete(listener);
        console.log(`[StateManager] Listener REMOVED for session: ${sessionId}, remaining: ${listeners.size}`);
      }
    };
  }

  /**
   * Emit event to all listeners AND browser window (for client-side subscriptions)
   */
  private emitEvent(sessionId: string, event: StateEvent): void {
    const listeners = this.listeners.get(sessionId);
    if (listeners) {
      listeners.forEach(listener => listener(event));
    }
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(event.type, { detail: event.data }));
    }
  }

  /**
   * Emit STATE_SNAPSHOT
   */
  emitSnapshot(sessionId: string): void {
    const state = this.states.get(sessionId);
    if (state) {
      this.emitEvent(sessionId, {
        type: 'STATE_SNAPSHOT',
        data: state,
      });
    }
  }

  /**
   * Emit HEARTBEAT
   */
  emitHeartbeat(sessionId: string): void {
    this.emitEvent(sessionId, {
      type: 'HEARTBEAT',
      data: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * Clean up session
   */
  destroySession(sessionId: string): void {
    this.states.delete(sessionId);
    this.listeners.delete(sessionId);
  }
}

export type StateEvent =
  | { type: 'STATE_SNAPSHOT'; data: SmartTriadState }
  | { type: 'STATE_DELTA'; data: StateDelta }
  | { type: 'HEARTBEAT'; data: { timestamp: string } };

// Singleton instance
let stateManager: SmartTriadStateManager | null = null;

export function getStateManager(): SmartTriadStateManager {
  if (!stateManager) {
    stateManager = new SmartTriadStateManager();
  }
  return stateManager;
}
