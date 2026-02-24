/**
 * QubeTalk External Agent Client SDK
 * Enables external agents to communicate with AgentiQ via QubeTalk
 */

export interface QubeTalkMessage {
  message_id: string;
  from_agent: {
    id: string;
    type: string;
    name?: string;
  };
  to_agent?: any;
  content: {
    type: string;
    text: string;
    metadata?: any;
  };
  message_type: string;
  created_at: string;
  is_external?: boolean;
}

export interface QubeTalkChannel {
  channel_id: string;
  tenant_id: string;
  participants: string[];
  config?: any;
  created_at: string;
  allows_external?: boolean;
  is_in_platform?: boolean;
  is_optional?: boolean;
}

export class QubeTalkClient {
  private baseUrl: string;
  private apiKey: string;
  private agentId: string;
  private personaId?: string;

  constructor(options: {
    baseUrl?: string;
    apiKey: string;
    agentId: string;
    personaId?: string;
  }) {
    this.baseUrl = options.baseUrl ?? '';
    this.apiKey = options.apiKey;
    this.agentId = options.agentId;
    this.personaId = options.personaId;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}/api/marketa/qubetalk${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-API-Key': this.apiKey,
        'X-Agent-ID': this.agentId,
        ...(this.personaId ? { 'x-persona-id': this.personaId } : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`QubeTalk API Error: ${error.error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Send a message to a QubeTalk channel
   */
  async sendMessage(options: {
    channelId: string;
    tenantId: string;
    message: string;
    recipientAgent?: string;
    agentName?: string;
    priority?: 'low' | 'normal' | 'high';
  }): Promise<{ success: boolean; message_id: string; sent_at: string }> {
    const response = await this.makeRequest('', {
      method: 'POST',
      body: JSON.stringify({
        channel_id: options.channelId,
        tenant_id: options.tenantId,
        message: options.message,
        recipient_agent: options.recipientAgent,
        agent_name: options.agentName,
        priority: options.priority || 'normal',
      }),
    });

    return response;
  }

  /**
   * List available channels for external communication
   */
  async listChannels(options: {
    tenantId: string;
    limit?: number;
  }): Promise<{ success: boolean; channels: QubeTalkChannel[]; total: number }> {
    const params = new URLSearchParams({
      tenant_id: options.tenantId,
      limit: (options.limit || 50).toString(),
    });

    const response = await this.makeRequest(`/channels?${params}`);
    return response;
  }

  /**
   * Create a new channel for external communication
   */
  async createChannel(options: {
    tenantId: string;
    participants?: string[];
    channelName?: string;
    description?: string;
  }): Promise<{ success: boolean; channel: QubeTalkChannel }> {
    const response = await this.makeRequest('/channels', {
      method: 'POST',
      body: JSON.stringify({
        tenant_id: options.tenantId,
        participants: options.participants,
        channel_name: options.channelName,
        description: options.description,
      }),
    });

    return response;
  }

  /**
   * Get messages from a channel
   */
  async getMessages(options: {
    channelId: string;
    tenantId: string;
    limit?: number;
  }): Promise<{ success: boolean; messages: QubeTalkMessage[]; total: number }> {
    const params = new URLSearchParams({
      channel_id: options.channelId,
      tenant_id: options.tenantId,
      limit: (options.limit || 50).toString(),
    });

    const response = await this.makeRequest(`?${params}`);
    return response;
  }

  /**
   * Get content transfers for a tenant
   */
  async getTransfers(options: {
    tenantId: string;
    limit?: number;
  }): Promise<{ success: boolean; transfers: any[]; total: number }> {
    const params = new URLSearchParams({
      tenant_id: options.tenantId,
      limit: (options.limit || 50).toString(),
    });

    const response = await this.makeRequest(`/transfers?${params}`);
    return response;
  }

  /**
   * Convenience method to send a quick message
   */
  async quickSend(
    tenantId: string, 
    message: string, 
    options?: { channelName?: string; recipientAgent?: string }
  ): Promise<{ success: boolean; message_id: string; channel_id: string }> {
    // Try to find existing channel, or create new one
    const channels = await this.listChannels({ tenantId, limit: 1 });
    
    let channelId: string;
    if (channels.channels.length > 0) {
      channelId = channels.channels[0].channel_id;
    } else {
      // Create new channel
      const newChannel = await this.createChannel({
        tenantId,
        channelName: options?.channelName || `External Channel ${this.agentId}`,
        description: `Auto-created channel for external agent ${this.agentId}`,
      });
      channelId = newChannel.channel.channel_id;
    }

    // Send message
    const result = await this.sendMessage({
      channelId,
      tenantId,
      message,
      recipientAgent: options?.recipientAgent,
    });

    return {
      ...result,
      channel_id: channelId,
    };
  }

  /**
   * Listen for messages in a channel (polling implementation)
   */
  async *pollMessages(
    channelId: string, 
    tenantId: string, 
    options: { interval?: number; lastMessageId?: string } = {}
  ): AsyncGenerator<QubeTalkMessage[]> {
    const interval = options.interval || 5000; // 5 seconds default
    let lastMessageId = options.lastMessageId;

    while (true) {
      try {
        const response = await this.getMessages({
          channelId,
          tenantId,
          limit: 10,
        });

        const messages = response.messages;
        
        // Filter for new messages
        const lastId = lastMessageId;
        const newMessages = lastId
          ? messages.filter(msg => msg.message_id > lastId)
          : messages;

        if (newMessages.length > 0) {
          lastMessageId = newMessages[newMessages.length - 1].message_id;
          yield newMessages;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        console.error('Error polling messages:', error);
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }
}

// Factory function for easy client creation
export function createQubeTalkClient(options: {
  baseUrl?: string;
  apiKey: string;
  agentId: string;
}): QubeTalkClient {
  return new QubeTalkClient(options);
}

// Example usage:
/*
const client = createQubeTalkClient({
  apiKey: 'your-api-key',
  agentId: 'external-agent-123',
});

// Send a message
await client.sendMessage({
  channelId: 'ch_12345',
  tenantId: 'agentiq_main',
  message: 'Hello from external agent!',
});

// Quick send (auto-creates channel if needed)
await client.quickSend(
  'agentiq_main',
  'Hello AgentiQ!',
  { channelName: 'External Comms' }
);
*/
