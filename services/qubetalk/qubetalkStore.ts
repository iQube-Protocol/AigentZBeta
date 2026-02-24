/**
 * QubeTalk Store - Database Persistence Layer
 * 
 * Now uses Supabase database instead of in-memory storage
 */

import {
  qubetalkPersistence,
  type DelegationData,
  type ChannelData,
  type MessageData,
  type ListOptions,
  type ListResult
} from './qubetalkPersistence';

// Re-export types from persistence layer
export type {
  DelegationData,
  ChannelData,
  MessageData,
  ListOptions,
  ListResult
};

// Delegation operations
export async function createDelegation(delegation: Omit<DelegationData, 'created_at' | 'updated_at'>): Promise<DelegationData> {
  return await qubetalkPersistence.createDelegation(delegation);
}

export async function getDelegation(delegationId: string, tenant_id: string): Promise<DelegationData | undefined> {
  const result = await qubetalkPersistence.getDelegation(delegationId, tenant_id);
  return result || undefined;
}

export async function getDelegationByRequestId(requestId: string, tenant_id: string): Promise<DelegationData | undefined> {
  const result = await qubetalkPersistence.getDelegationByRequestId(requestId, tenant_id);
  return result || undefined;
}

export async function getAllDelegations(tenant_id: string, options: ListOptions = {}): Promise<DelegationData[]> {
  const result = await qubetalkPersistence.listDelegations({ ...options, tenant_id });
  return result.items;
}

export async function updateDelegation(delegationId: string, updates: Partial<DelegationData>, tenant_id: string): Promise<boolean> {
  const result = await qubetalkPersistence.updateDelegation(delegationId, updates, tenant_id);
  return result !== null;
}

export async function deleteDelegation(delegationId: string, tenant_id: string): Promise<boolean> {
  return await qubetalkPersistence.deleteDelegation(delegationId, tenant_id);
}

// Channel operations
export async function createChannel(channel: Omit<ChannelData, 'created_at' | 'updated_at'>): Promise<ChannelData> {
  return await qubetalkPersistence.createChannel(channel);
}

export async function getChannel(channelId: string, tenant_id: string): Promise<ChannelData | undefined> {
  const result = await qubetalkPersistence.getChannel(channelId, tenant_id);
  return result || undefined;
}

export async function getAllChannels(tenant_id: string, options: ListOptions = {}): Promise<ChannelData[]> {
  const result = await qubetalkPersistence.listChannels({ ...options, tenant_id });
  return result.items;
}

export async function updateChannel(channelId: string, updates: Partial<ChannelData>, tenant_id: string): Promise<boolean> {
  const result = await qubetalkPersistence.updateChannel(channelId, updates, tenant_id);
  return result !== null;
}

export async function deleteChannel(channelId: string, tenant_id: string): Promise<boolean> {
  return await qubetalkPersistence.deleteChannel(channelId, tenant_id);
}

// Message operations
export async function createMessage(message: Omit<MessageData, 'created_at'>): Promise<MessageData> {
  return await qubetalkPersistence.createMessage(message);
}

export async function getMessage(messageId: string, tenant_id: string): Promise<MessageData | undefined> {
  const result = await qubetalkPersistence.getMessage(messageId, tenant_id);
  return result || undefined;
}

export async function getChannelMessages(channelId: string, tenant_id: string, options: { limit?: number; offset?: number } = {}): Promise<MessageData[]> {
  const result = await qubetalkPersistence.listMessages(channelId, tenant_id, options);
  return result.items;
}

export async function deleteMessage(messageId: string, tenant_id: string): Promise<boolean> {
  return await qubetalkPersistence.deleteMessage(messageId, tenant_id);
}

// Utility functions
export async function getChannelStats(channelId: string, tenant_id: string) {
  return await qubetalkPersistence.getChannelStats(channelId, tenant_id);
}

// Backward compatibility - maintain the same interface as before
export const getStoreStats = async (tenant_id: string) => {
  const [channels, delegations, messages] = await Promise.all([
    qubetalkPersistence.listChannels({ tenant_id }),
    qubetalkPersistence.listDelegations({ tenant_id }),
    qubetalkPersistence.listMessages('dummy', tenant_id, { limit: 1 }) // Just to get count
  ]);

  return {
    channels: channels.total,
    delegations: delegations.total,
    messages: messages.total,
  };
};
