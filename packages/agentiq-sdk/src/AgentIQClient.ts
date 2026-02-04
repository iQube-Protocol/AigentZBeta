/**
 * @agentiq/agentiq-sdk - Main Client
 * AA-API client for interacting with AgentiQ Platform
 */

import type {
  AgentIQConfig,
  AgentConfig,
  ChatMessage,
  ChatResponse,
  ActionResponse,
  StreamCallbacks,
  AAAPIRequest,
} from './types';

export class AgentIQClient {
  private config: AgentIQConfig;

  constructor(config: AgentIQConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Send a chat message to an agent
   */
  async chat(
    messages: ChatMessage[],
    agentConfig: Partial<AgentConfig>
  ): Promise<ChatResponse> {
    try {
      const payload = this.buildRequest({
        messages,
        ...agentConfig,
      });

      const response = await this.fetchWithTimeout(
        `${this.config.apiUrl}/api/aa/copilot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.config.headers,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        message: data.message || data.content || '',
        content: data.content || data.message || '',
        metadata: data.metadata,
      };
    } catch (error: any) {
      console.error('[AgentIQ] Chat error:', error);
      return {
        success: false,
        error: error.message || 'Failed to connect to AgentiQ',
      };
    }
  }

  /**
   * Stream chat messages from an agent
   */
  async stream(
    messages: ChatMessage[],
    agentConfig: Partial<AgentConfig>,
    callbacks: StreamCallbacks
  ): Promise<void> {
    try {
      const payload = this.buildRequest({
        messages,
        ...agentConfig,
        stream: true,
      });

      const response = await fetch(`${this.config.apiUrl}/api/aa/copilot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      await this.processStream(reader, callbacks);
    } catch (error: any) {
      console.error('[AgentIQ] Stream error:', error);
      callbacks.onError(error.message || 'Stream failed');
    }
  }

  /**
   * Execute an action via AA-API
   */
  async executeAction(
    actionName: string,
    parameters: Record<string, any>,
    agentConfig: Partial<AgentConfig>
  ): Promise<ActionResponse> {
    try {
      const payload = this.buildRequest({
        action: actionName,
        parameters,
        ...agentConfig,
      });

      const response = await this.fetchWithTimeout(
        `${this.config.apiUrl}/api/aa/copilot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...this.config.headers,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        result: data,
        metadata: data.metadata,
      };
    } catch (error: any) {
      console.error('[AgentIQ] Action error:', error);
      return {
        success: false,
        error: error.message || 'Action failed',
      };
    }
  }

  /**
   * Build request payload with defaults
   */
  private buildRequest(config: Partial<AAAPIRequest>): AAAPIRequest {
    return {
      agentId: config.agentId || 'copilot',
      tenantId: config.tenantId || this.config.defaultTenantId || 'default',
      franchiseId: config.franchiseId || this.config.defaultFranchiseId || 'default',
      personaId: config.personaId || this.config.defaultPersonaId,
      ...config,
    } as AAAPIRequest;
  }

  /**
   * Fetch with timeout
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response;
    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * Process streaming response
   */
  private async processStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              callbacks.onComplete();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.content) {
                callbacks.onChunk(parsed.content);
              }
              
              if (parsed.metadata && callbacks.onMetadata) {
                callbacks.onMetadata(parsed.metadata);
              }
            } catch {
              // Not JSON, treat as raw text
              callbacks.onChunk(data);
            }
          }
        }
      }

      callbacks.onComplete();
    } catch (error: any) {
      callbacks.onError(error.message || 'Stream processing failed');
    }
  }

  /**
   * Update client configuration
   */
  updateConfig(config: Partial<AgentIQConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): AgentIQConfig {
    return { ...this.config };
  }
}
