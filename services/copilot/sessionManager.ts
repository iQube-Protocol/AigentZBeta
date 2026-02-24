/**
 * SessionManager
 * 
 * Manages Copilot sessions and drawer overlays.
 * Tracks conversation history and applies dynamic changes to drawers.
 */

import type {
  DrawerSet,
  DrawerSession,
  Drawer,
  DrawerTab,
  DrawerSlot,
  SessionOverlay,
} from '@/types/smartDrawer';
import { drawerService } from '@/services/drawer/drawerService';
import { compileDrawerPrompt, type CompileResult } from './drawerCompiler';

// =============================================================================
// TYPES
// =============================================================================

/** Session state */
export interface CopilotSession {
  /** Session ID */
  id: string;
  
  /** Drawer set ID */
  drawerSetId: string;
  
  /** App context */
  appId: string;
  tenantId: string;
  personaId: string;
  
  /** Conversation history */
  messages: CopilotMessage[];
  
  /** Accumulated overlay */
  overlay: SessionOverlay;
  
  /** Compilation history */
  compilations: CompileResult[];
  
  /** Created at */
  createdAt: string;
  
  /** Last activity */
  lastActivityAt: string;
  
  /** Is active */
  isActive: boolean;
}

/** Copilot message */
export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    compilationId?: number;
    changes?: string[];
  };
}

/** Session creation options */
export interface CreateSessionOptions {
  drawerSetId: string;
  appId: string;
  tenantId: string;
  personaId: string;
  welcomeMessage?: string;
}

/** Process prompt options */
export interface ProcessPromptOptions {
  sessionId: string;
  prompt: string;
  device: 'mobile' | 'desktop' | 'tv';
}

/** Process prompt result */
export interface ProcessPromptResult {
  /** Response message */
  response: string;
  
  /** Compilation result (if drawer was modified) */
  compilation?: CompileResult;
  
  /** Updated session */
  session: CopilotSession;
  
  /** Whether drawer was modified */
  drawerModified: boolean;
}

// =============================================================================
// SESSION MANAGER CLASS
// =============================================================================

class SessionManager {
  private sessions: Map<string, CopilotSession> = new Map();
  private sessionTimeoutMs = 30 * 60 * 1000; // 30 minutes

  // ---------------------------------------------------------------------------
  // SESSION LIFECYCLE
  // ---------------------------------------------------------------------------

  /**
   * Create a new Copilot session
   */
  createSession(options: CreateSessionOptions): CopilotSession {
    const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const session: CopilotSession = {
      id,
      drawerSetId: options.drawerSetId,
      appId: options.appId,
      tenantId: options.tenantId,
      personaId: options.personaId,
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: options.welcomeMessage ?? "Hi! I can help you customize your drawer layout. Try saying things like 'show my tasks' or 'add a wallet section'.",
          timestamp: now,
        },
      ],
      overlay: {
        addedDrawers: [],
        removedDrawerIds: [],
        modifiedDrawers: [],
        addedTabs: [],
        addedSlots: [],
        updatedSlots: [],
      },
      compilations: [],
      createdAt: now,
      lastActivityAt: now,
      isActive: true,
    };

    this.sessions.set(id, session);
    this.cleanupOldSessions();

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): CopilotSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check if expired
    const lastActivity = new Date(session.lastActivityAt).getTime();
    if (Date.now() - lastActivity > this.sessionTimeoutMs) {
      session.isActive = false;
    }

    return session;
  }

  /**
   * End a session
   */
  endSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.isActive = false;
    return true;
  }

  /**
   * List active sessions for a persona
   */
  listSessions(personaId: string): CopilotSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.personaId === personaId && s.isActive
    );
  }

  // ---------------------------------------------------------------------------
  // PROMPT PROCESSING
  // ---------------------------------------------------------------------------

  /**
   * Process a user prompt
   */
  async processPrompt(options: ProcessPromptOptions): Promise<ProcessPromptResult> {
    const session = this.getSession(options.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${options.sessionId}`);
    }

    if (!session.isActive) {
      throw new Error(`Session expired: ${options.sessionId}`);
    }

    // Update activity
    session.lastActivityAt = new Date().toISOString();

    // Add user message
    const userMessage: CopilotMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: options.prompt,
      timestamp: session.lastActivityAt,
    };
    session.messages.push(userMessage);

    // Determine if this is a drawer modification request
    const isDrawerRequest = this.isDrawerModificationRequest(options.prompt);

    let compilation: CompileResult | undefined;
    let response: string;
    let drawerModified = false;

    if (isDrawerRequest) {
      // Get existing drawer set
      const existingDrawerSet = await drawerService.getDrawerSetById(session.drawerSetId);

      // Compile the prompt
      compilation = await compileDrawerPrompt({
        prompt: options.prompt,
        appId: session.appId,
        tenantId: session.tenantId,
        personaId: session.personaId,
        device: options.device,
        existingDrawerSet: existingDrawerSet ?? undefined,
      });

      session.compilations.push(compilation);

      // Apply changes to overlay
      this.applyCompilationToOverlay(session, compilation);
      drawerModified = compilation.changes.length > 0;

      // Generate response
      response = this.generateCompilationResponse(compilation);
    } else {
      // Handle as general conversation
      response = await this.generateConversationalResponse(session, options.prompt);
    }

    // Add assistant message
    const assistantMessage: CopilotMessage = {
      id: `msg-${Date.now()}-response`,
      role: 'assistant',
      content: response,
      timestamp: new Date().toISOString(),
      metadata: compilation ? {
        compilationId: session.compilations.length - 1,
        changes: compilation.changes.map((c) => c.description),
      } : undefined,
    };
    session.messages.push(assistantMessage);

    return {
      response,
      compilation,
      session,
      drawerModified,
    };
  }

  // ---------------------------------------------------------------------------
  // OVERLAY MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Apply compilation result to session overlay
   */
  private applyCompilationToOverlay(session: CopilotSession, compilation: CompileResult): void {
    for (const change of compilation.changes) {
      switch (change.type) {
        case 'add_drawer':
          const newDrawer = compilation.drawerSet.drawers.find((d) => d.id === change.target);
          if (newDrawer && !session.overlay.addedDrawers?.some((d) => d.id === newDrawer.id)) {
            session.overlay.addedDrawers = session.overlay.addedDrawers ?? [];
            session.overlay.addedDrawers.push(newDrawer);
          }
          break;

        case 'add_tab':
          for (const drawer of compilation.drawerSet.drawers) {
            const newTab = drawer.tabs.find((t) => t.id === change.target);
            if (newTab && !session.overlay.addedTabs?.some((t) => t.tabId === newTab.id)) {
              session.overlay.addedTabs = session.overlay.addedTabs ?? [];
              session.overlay.addedTabs.push({
                drawerId: drawer.id,
                tabId: newTab.id,
                tab: newTab,
              });
            }
          }
          break;

        case 'add_slot':
          for (const drawer of compilation.drawerSet.drawers) {
            for (const tab of drawer.tabs) {
              const newSlot = tab.slots.find((s) => s.id === change.target);
              if (newSlot && !session.overlay.addedSlots?.some((s) => s.slotId === newSlot.id)) {
                session.overlay.addedSlots = session.overlay.addedSlots ?? [];
                session.overlay.addedSlots.push({
                  drawerId: drawer.id,
                  tabId: tab.id,
                  slotId: newSlot.id,
                  slot: newSlot,
                });
              }
            }
          }
          break;

        case 'update_slot':
          for (const drawer of compilation.drawerSet.drawers) {
            for (const tab of drawer.tabs) {
              const updatedSlot = tab.slots.find((s) => s.id === change.target);
              if (updatedSlot) {
                session.overlay.updatedSlots = session.overlay.updatedSlots ?? [];
                const existingIndex = session.overlay.updatedSlots.findIndex(
                  (s) => s.slotId === updatedSlot.id
                );
                const update = {
                  drawerId: drawer.id,
                  tabId: tab.id,
                  slotId: updatedSlot.id,
                  updates: updatedSlot,
                };
                if (existingIndex >= 0) {
                  session.overlay.updatedSlots[existingIndex] = update;
                } else {
                  session.overlay.updatedSlots.push(update);
                }
              }
            }
          }
          break;
      }
    }
  }

  /**
   * Get merged drawer set with session overlay
   */
  async getMergedDrawerSet(sessionId: string): Promise<DrawerSet | null> {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const baseDrawerSet = await drawerService.getDrawerSetById(session.drawerSetId);
    if (!baseDrawerSet) return null;

    // Create a DrawerSession from our CopilotSession
    const drawerSession: DrawerSession = {
      id: session.id,
      drawerSetId: session.drawerSetId,
      sessionId: session.id,
      personaId: session.personaId,
      overlay: session.overlay,
      createdAt: session.createdAt,
    };

    // Apply overlay
    const result = drawerService.applySessionOverlays(baseDrawerSet, [drawerSession]);
    return result.mergedDrawerSet;
  }

  // ---------------------------------------------------------------------------
  // RESPONSE GENERATION
  // ---------------------------------------------------------------------------

  private isDrawerModificationRequest(prompt: string): boolean {
    const modificationKeywords = [
      'show', 'hide', 'add', 'remove', 'create', 'delete',
      'display', 'focus', 'prioritize', 'change', 'update',
      'drawer', 'tab', 'slot', 'section', 'panel', 'area',
      'wallet', 'balance', 'task', 'quest', 'library', 'content',
    ];

    const lowerPrompt = prompt.toLowerCase();
    return modificationKeywords.some((kw) => lowerPrompt.includes(kw));
  }

  private generateCompilationResponse(compilation: CompileResult): string {
    if (compilation.changes.length === 0) {
      return "I understood your request, but I couldn't determine what changes to make. Could you be more specific?";
    }

    const changeDescriptions = compilation.changes.map((c) => `• ${c.description}`).join('\n');
    
    let response = `Done! I've made the following changes:\n\n${changeDescriptions}`;

    if (compilation.warnings.length > 0) {
      response += `\n\n⚠️ Notes:\n${compilation.warnings.map((w) => `• ${w}`).join('\n')}`;
    }

    if (compilation.confidence < 0.5) {
      response += "\n\nI'm not entirely sure this is what you wanted. Let me know if you'd like me to adjust anything.";
    }

    return response;
  }

  private async generateConversationalResponse(
    session: CopilotSession,
    prompt: string
  ): Promise<string> {
    const lowerPrompt = prompt.toLowerCase();

    // Help request
    if (lowerPrompt.includes('help') || lowerPrompt.includes('what can you do')) {
      return `I can help you customize your drawer layout! Try saying things like:
• "Show my wallet balance"
• "Add a tasks section"
• "Hide the rewards tab"
• "Focus on my library"
• "Create a new video section"

I can also answer questions about your content and wallet.`;
    }

    // Status request
    if (lowerPrompt.includes('status') || lowerPrompt.includes('what have you done')) {
      const changeCount = session.compilations.reduce(
        (sum, c) => sum + c.changes.length,
        0
      );
      if (changeCount === 0) {
        return "I haven't made any changes to your drawer yet. What would you like me to do?";
      }
      return `In this session, I've made ${changeCount} change(s) to your drawer layout. Would you like me to undo anything or make more changes?`;
    }

    // Undo request
    if (lowerPrompt.includes('undo') || lowerPrompt.includes('revert')) {
      // Clear overlay
      session.overlay = {
        addedDrawers: [],
        removedDrawerIds: [],
        modifiedDrawers: [],
        addedTabs: [],
        addedSlots: [],
        updatedSlots: [],
      };
      session.compilations = [];
      return "I've reverted all changes made in this session. Your drawer is back to its original state.";
    }

    // Default response
    return "I'm not sure how to help with that. Try asking me to show, hide, or add sections to your drawer, or say 'help' to see what I can do.";
  }

  // ---------------------------------------------------------------------------
  // CLEANUP
  // ---------------------------------------------------------------------------

  private cleanupOldSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      const lastActivity = new Date(session.lastActivityAt).getTime();
      if (now - lastActivity > this.sessionTimeoutMs * 2) {
        this.sessions.delete(id);
      }
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const sessionManager = new SessionManager();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export function createCopilotSession(options: CreateSessionOptions): CopilotSession {
  return sessionManager.createSession(options);
}

export function getCopilotSession(sessionId: string): CopilotSession | null {
  return sessionManager.getSession(sessionId);
}

export async function processCopilotPrompt(options: ProcessPromptOptions): Promise<ProcessPromptResult> {
  return sessionManager.processPrompt(options);
}

export async function getMergedDrawerSet(sessionId: string): Promise<DrawerSet | null> {
  return sessionManager.getMergedDrawerSet(sessionId);
}
