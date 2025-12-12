/**
 * @agentiq/agentiq-sdk - A2A Protocol Client
 * Agent-to-Agent communication protocol implementation
 */

import type { A2AMessage, A2AResponse } from './types';

export class A2AClient {
  private apiUrl: string;
  private agentId: string;
  private messageHandlers: Map<string, (message: A2AMessage) => void>;
  private responseHandlers: Map<string, (response: A2AResponse) => void>;

  constructor(apiUrl: string, agentId: string) {
    this.apiUrl = apiUrl;
    this.agentId = agentId;
    this.messageHandlers = new Map();
    this.responseHandlers = new Map();
  }

  /**
   * Send a message to another agent
   */
  async sendMessage(
    toAgentId: string,
    payload: any,
    correlationId?: string
  ): Promise<A2AResponse> {
    const messageId = this.generateMessageId();
    
    const message: A2AMessage = {
      type: 'request',
      from: this.agentId,
      to: toAgentId,
      payload,
      messageId,
      correlationId: correlationId || messageId,
      timestamp: Date.now(),
    };

    try {
      const response = await fetch(`${this.apiUrl}/api/a2a/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`A2A error: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        data: data.payload || data,
        messageId,
        correlationId: message.correlationId,
      };
    } catch (error: any) {
      console.error('[A2A] Send error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send message',
        messageId,
        correlationId: message.correlationId,
      };
    }
  }

  /**
   * Register a handler for incoming messages
   */
  onMessage(type: string, handler: (message: A2AMessage) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Handle incoming message
   */
  handleMessage(message: A2AMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    } else {
      console.warn('[A2A] No handler for message type:', message.type);
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `${this.agentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
