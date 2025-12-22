/**
 * Template Event Bus
 * 
 * Simple event system to communicate template selections from
 * CodexCopilotLayer to CodexLiquidUITab, bypassing the broken AG-UI SSE flow.
 */

export interface TemplateSelectionEvent {
  templateId: string;
  intent: string;
  focus?: string;
  contentCount: number;
  content?: any[];
}

type TemplateEventListener = (event: TemplateSelectionEvent) => void;

class TemplateEventBus {
  private listeners: Set<TemplateEventListener> = new Set();

  /**
   * Subscribe to template selection events
   */
  subscribe(listener: TemplateEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Emit a template selection event
   */
  emit(event: TemplateSelectionEvent): void {
    console.log('[TemplateEventBus] Emitting template selection:', event);
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[TemplateEventBus] Listener error:', error);
      }
    });
  }
}

// Singleton instance
export const templateEventBus = new TemplateEventBus();
