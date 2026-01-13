/**
 * QubeTalk In-Memory Store
 * 
 * Temporary storage for QubeTalk development.
 * In production, this would be replaced with a proper database.
 */

// Global in-memory storage that persists across requests
const delegations = new Map();
const channels = new Map();
const messages = new Map();

export interface DelegationData {
  delegation_id: string;
  tenant_id: string;
  channel_id: string;
  request_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  from_agent: any;
  to_agent: any;
  task: any;
  context?: any;
  result?: any;
  receipt_ref?: string;
}

export interface ChannelData {
  channel_id: string;
  tenant_id: string;
  participants: string[];
  created_at: string;
}

export interface MessageData {
  message_id: string;
  channel_id: string;
  in_reply_to?: string;
  from_agent: any;
  type: string;
  content: string;
  created_at: string;
  iqube_refs?: string[];
  receipt_ref?: string;
  metadata?: any;
}

// Delegation operations
export function createDelegation(delegation: DelegationData): void {
  delegations.set(delegation.delegation_id, delegation);
}

export function getDelegation(id: string): DelegationData | undefined {
  return delegations.get(id);
}

export function getAllDelegations(): DelegationData[] {
  return Array.from(delegations.values());
}

export function updateDelegation(id: string, updates: Partial<DelegationData>): boolean {
  const delegation = delegations.get(id);
  if (!delegation) return false;
  
  Object.assign(delegation, updates, { updated_at: new Date().toISOString() });
  return true;
}

// Channel operations
export function createChannel(channel: ChannelData): void {
  channels.set(channel.channel_id, channel);
}

export function getChannel(id: string): ChannelData | undefined {
  return channels.get(id);
}

export function getAllChannels(): ChannelData[] {
  return Array.from(channels.values());
}

// Message operations
export function createMessage(message: MessageData): void {
  messages.set(message.message_id, message);
}

export function getMessage(id: string): MessageData | undefined {
  return messages.get(id);
}

export function getAllMessages(): MessageData[] {
  return Array.from(messages.values());
}

export function getChannelMessages(channelId: string): MessageData[] {
  return Array.from(messages.values()).filter(msg => msg.channel_id === channelId);
}

// Utility functions
export function clearAll(): void {
  delegations.clear();
  channels.clear();
  messages.clear();
}

export function getStoreStats() {
  return {
    delegations: delegations.size,
    channels: channels.size,
    messages: messages.size,
  };
}

// Auto-cleanup old messages (older than 1 hour)
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  let cleaned = 0;
  
  for (const [id, message] of messages) {
    if (new Date(message.created_at) < oneHourAgo) {
      messages.delete(id);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} old QubeTalk messages`);
  }
}, 5 * 60 * 1000); // Check every 5 minutes
