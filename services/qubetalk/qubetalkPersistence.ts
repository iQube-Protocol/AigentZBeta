/**
 * QubeTalk Database Persistence Layer
 * 
 * Replaces in-memory store with Supabase database operations
 */

import { getSupabaseServer } from '@/app/api/_lib/supabaseServer';
import type { SupabaseClient } from '@supabase/supabase-js';

// Types matching the database schema
export interface DelegationData {
  delegation_id: string;
  tenant_id: string;
  channel_id: string;
  request_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'failed';
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
  updated_at: string;
}

export interface MessageData {
  message_id: string;
  channel_id: string;
  in_reply_to?: string;
  from_agent: any;
  type: 'text' | 'delegation' | 'response' | 'system' | 'receipt';
  content: string;
  created_at: string;
  iqube_refs?: string[];
  receipt_ref?: string;
  metadata?: any;
}

export interface ListOptions {
  tenant_id?: string;
  channel_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

class QubeTalkPersistence {
  private supabase: SupabaseClient | null;
  private fallbackEnabled: boolean;
  private memory = {
    channels: new Map<string, ChannelData>(),
    delegations: new Map<string, DelegationData>(),
    messages: new Map<string, MessageData>(),
  };

  constructor() {
    this.supabase = getSupabaseServer();
    this.fallbackEnabled = process.env.NODE_ENV !== 'production';
    if (!this.supabase && this.fallbackEnabled) {
      console.warn('QubeTalk persistence running in memory mode (Supabase not configured).');
    }
  }

  // Set tenant context for RLS
  private async setTenantContext(tenant_id: string) {
    if (!this.supabase) return;
    await this.supabase.rpc('set_tenant_context', { tenant_id });
  }

  private now() {
    return new Date().toISOString();
  }

  private listResult<T>(items: T[], limit: number, offset: number): ListResult<T> {
    return {
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    };
  }

  // Channel operations
  async createChannel(channel: Omit<ChannelData, 'created_at' | 'updated_at'>): Promise<ChannelData> {
    if (!this.supabase) {
      if (!this.fallbackEnabled) {
        throw new Error('Supabase is not configured for QubeTalk channels.');
      }
      const now = this.now();
      const record: ChannelData = {
        ...channel,
        created_at: now,
        updated_at: now,
      };
      this.memory.channels.set(record.channel_id, record);
      return record;
    }

    try {
      const { data, error } = await this.supabase
        .from('qubetalk_channels')
        .insert({
          channel_id: channel.channel_id,
          tenant_id: channel.tenant_id,
          participants: channel.participants,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      console.warn('QubeTalk channel create fallback to memory:', error);
      const now = this.now();
      const record: ChannelData = {
        ...channel,
        created_at: now,
        updated_at: now,
      };
      this.memory.channels.set(record.channel_id, record);
      return record;
    }
  }

  async getChannel(channelId: string, tenant_id: string): Promise<ChannelData | null> {
    if (!this.supabase) {
      const record = this.memory.channels.get(channelId);
      if (record && record.tenant_id === tenant_id) return record;
      return null;
    }

    await this.setTenantContext(tenant_id);

    try {
      const { data, error } = await this.supabase
        .from('qubetalk_channels')
        .select('*')
        .eq('channel_id', channelId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      console.warn('QubeTalk channel get fallback to memory:', error);
      const record = this.memory.channels.get(channelId);
      if (record && record.tenant_id === tenant_id) return record;
      return null;
    }
  }

  async listChannels(options: ListOptions = {}): Promise<ListResult<ChannelData>> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    if (!this.supabase) {
      let items = Array.from(this.memory.channels.values());
      if (options.tenant_id) {
        items = items.filter((item) => item.tenant_id === options.tenant_id);
      }
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return this.listResult(items, limit, offset);
    }

    let query = this.supabase
      .from('qubetalk_channels')
      .select('*', { count: 'exact' });

    if (options.tenant_id) {
      await this.setTenantContext(options.tenant_id);
    }

    try {
      const { data, error, count } = await query
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        items: data || [],
        total: count || 0,
        limit,
        offset,
      };
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      console.warn('QubeTalk channel list fallback to memory:', error);
      let items = Array.from(this.memory.channels.values());
      if (options.tenant_id) {
        items = items.filter((item) => item.tenant_id === options.tenant_id);
      }
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return this.listResult(items, limit, offset);
    }
  }

  async updateChannel(channelId: string, updates: Partial<ChannelData>, tenant_id: string): Promise<ChannelData | null> {
    if (!this.supabase) {
      const existing = this.memory.channels.get(channelId);
      if (!existing || existing.tenant_id !== tenant_id) return null;
      const updated: ChannelData = {
        ...existing,
        ...updates,
        updated_at: this.now(),
      };
      this.memory.channels.set(channelId, updated);
      return updated;
    }

    await this.setTenantContext(tenant_id);

    try {
      const { data, error } = await this.supabase
        .from('qubetalk_channels')
        .update(updates)
        .eq('channel_id', channelId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      console.warn('QubeTalk channel update fallback to memory:', error);
      const existing = this.memory.channels.get(channelId);
      if (!existing || existing.tenant_id !== tenant_id) return null;
      const updated: ChannelData = {
        ...existing,
        ...updates,
        updated_at: this.now(),
      };
      this.memory.channels.set(channelId, updated);
      return updated;
    }
  }

  async deleteChannel(channelId: string, tenant_id: string): Promise<boolean> {
    if (!this.supabase) {
      const existing = this.memory.channels.get(channelId);
      if (!existing || existing.tenant_id !== tenant_id) return false;
      return this.memory.channels.delete(channelId);
    }

    await this.setTenantContext(tenant_id);

    try {
      const { error } = await this.supabase
        .from('qubetalk_channels')
        .delete()
        .eq('channel_id', channelId);

      return !error;
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      console.warn('QubeTalk channel delete fallback to memory:', error);
      const existing = this.memory.channels.get(channelId);
      if (!existing || existing.tenant_id !== tenant_id) return false;
      return this.memory.channels.delete(channelId);
    }
  }

  // Delegation operations
  async createDelegation(delegation: Omit<DelegationData, 'created_at' | 'updated_at'>): Promise<DelegationData> {
    if (!this.supabase) {
      if (!this.fallbackEnabled) {
        throw new Error('Supabase is not configured for QubeTalk delegations.');
      }
      const now = this.now();
      const record: DelegationData = {
        ...delegation,
        created_at: now,
        updated_at: now,
      };
      this.memory.delegations.set(record.delegation_id, record);
      return record;
    }

    try {
      const { data, error } = await this.supabase
        .from('qubetalk_delegations')
        .insert({
          delegation_id: delegation.delegation_id,
          tenant_id: delegation.tenant_id,
          channel_id: delegation.channel_id,
          request_id: delegation.request_id,
          status: delegation.status,
          from_agent: delegation.from_agent,
          to_agent: delegation.to_agent,
          task: delegation.task,
          context: delegation.context || {},
          result: delegation.result || {},
          receipt_ref: delegation.receipt_ref,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      console.warn('QubeTalk delegation create fallback to memory:', error);
      const now = this.now();
      const record: DelegationData = {
        ...delegation,
        created_at: now,
        updated_at: now,
      };
      this.memory.delegations.set(record.delegation_id, record);
      return record;
    }
  }

  async getDelegation(delegationId: string, tenant_id: string): Promise<DelegationData | null> {
    if (!this.supabase) {
      const record = this.memory.delegations.get(delegationId);
      if (record && record.tenant_id === tenant_id) return record;
      return null;
    }

    await this.setTenantContext(tenant_id);

    try {
      const { data, error } = await this.supabase
        .from('qubetalk_delegations')
        .select('*')
        .eq('delegation_id', delegationId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      console.warn('QubeTalk delegation get fallback to memory:', error);
      const record = this.memory.delegations.get(delegationId);
      if (record && record.tenant_id === tenant_id) return record;
      return null;
    }
  }

  async getDelegationByRequestId(requestId: string, tenant_id: string): Promise<DelegationData | null> {
    if (!this.supabase) {
      for (const record of this.memory.delegations.values()) {
        if (record.tenant_id === tenant_id && record.request_id === requestId) {
          return record;
        }
      }
      return null;
    }

    await this.setTenantContext(tenant_id);

    try {
      const { data, error } = await this.supabase
        .from('qubetalk_delegations')
        .select('*')
        .eq('request_id', requestId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      console.warn('QubeTalk delegation request lookup fallback to memory:', error);
      for (const record of this.memory.delegations.values()) {
        if (record.tenant_id === tenant_id && record.request_id === requestId) {
          return record;
        }
      }
      return null;
    }
  }

  async listDelegations(options: ListOptions = {}): Promise<ListResult<DelegationData>> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    if (!this.supabase) {
      let items = Array.from(this.memory.delegations.values());
      if (options.tenant_id) items = items.filter((item) => item.tenant_id === options.tenant_id);
      if (options.channel_id) items = items.filter((item) => item.channel_id === options.channel_id);
      if (options.status) items = items.filter((item) => item.status === options.status);
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return this.listResult(items, limit, offset);
    }

    let query = this.supabase
      .from('qubetalk_delegations')
      .select('*', { count: 'exact' });

    if (options.tenant_id) {
      await this.setTenantContext(options.tenant_id);
    }

    if (options.channel_id) {
      query = query.eq('channel_id', options.channel_id);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    try {
      const { data, error, count } = await query
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        items: data || [],
        total: count || 0,
        limit,
        offset,
      };
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      console.warn('QubeTalk delegation list fallback to memory:', error);
      let items = Array.from(this.memory.delegations.values());
      if (options.tenant_id) items = items.filter((item) => item.tenant_id === options.tenant_id);
      if (options.channel_id) items = items.filter((item) => item.channel_id === options.channel_id);
      if (options.status) items = items.filter((item) => item.status === options.status);
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return this.listResult(items, limit, offset);
    }
  }

  async updateDelegation(delegationId: string, updates: Partial<DelegationData>, tenant_id: string): Promise<DelegationData | null> {
    if (!this.supabase) {
      const existing = this.memory.delegations.get(delegationId);
      if (!existing || existing.tenant_id !== tenant_id) return null;
      const updated: DelegationData = {
        ...existing,
        ...updates,
        updated_at: this.now(),
      };
      this.memory.delegations.set(delegationId, updated);
      return updated;
    }

    await this.setTenantContext(tenant_id);

    try {
      const { data, error } = await this.supabase
        .from('qubetalk_delegations')
        .update(updates)
        .eq('delegation_id', delegationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      console.warn('QubeTalk delegation update fallback to memory:', error);
      const existing = this.memory.delegations.get(delegationId);
      if (!existing || existing.tenant_id !== tenant_id) return null;
      const updated: DelegationData = {
        ...existing,
        ...updates,
        updated_at: this.now(),
      };
      this.memory.delegations.set(delegationId, updated);
      return updated;
    }
  }

  async deleteDelegation(delegationId: string, tenant_id: string): Promise<boolean> {
    if (!this.supabase) {
      const existing = this.memory.delegations.get(delegationId);
      if (!existing || existing.tenant_id !== tenant_id) return false;
      return this.memory.delegations.delete(delegationId);
    }

    await this.setTenantContext(tenant_id);

    try {
      const { error } = await this.supabase
        .from('qubetalk_delegations')
        .delete()
        .eq('delegation_id', delegationId);

      return !error;
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      console.warn('QubeTalk delegation delete fallback to memory:', error);
      const existing = this.memory.delegations.get(delegationId);
      if (!existing || existing.tenant_id !== tenant_id) return false;
      return this.memory.delegations.delete(delegationId);
    }
  }

  // Message operations
  async createMessage(message: Omit<MessageData, 'created_at'>): Promise<MessageData> {
    if (!this.supabase) {
      if (!this.fallbackEnabled) {
        throw new Error('Supabase is not configured for QubeTalk messages.');
      }
      const now = this.now();
      const record: MessageData = {
        ...message,
        created_at: now,
      };
      this.memory.messages.set(record.message_id, record);
      return record;
    }

    try {
      const { data, error } = await this.supabase
        .from('qubetalk_messages')
        .insert({
          message_id: message.message_id,
          channel_id: message.channel_id,
          in_reply_to: message.in_reply_to,
          from_agent: message.from_agent,
          type: message.type,
          content: message.content,
          iqube_refs: message.iqube_refs || [],
          receipt_ref: message.receipt_ref,
          metadata: message.metadata || {},
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      console.warn('QubeTalk message create fallback to memory:', error);
      const now = this.now();
      const record: MessageData = {
        ...message,
        created_at: now,
      };
      this.memory.messages.set(record.message_id, record);
      return record;
    }
  }

  async getMessage(messageId: string, tenant_id: string): Promise<MessageData | null> {
    if (!this.supabase) {
      const record = this.memory.messages.get(messageId);
      if (!record) return null;
      const channel = this.memory.channels.get(record.channel_id);
      if (channel && channel.tenant_id === tenant_id) return record;
      return null;
    }

    await this.setTenantContext(tenant_id);

    try {
      const { data, error } = await this.supabase
        .from('qubetalk_messages')
        .select('*')
        .eq('message_id', messageId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      console.warn('QubeTalk message get fallback to memory:', error);
      const record = this.memory.messages.get(messageId);
      if (!record) return null;
      const channel = this.memory.channels.get(record.channel_id);
      if (channel && channel.tenant_id === tenant_id) return record;
      return null;
    }
  }

  async listMessages(channelId: string, tenant_id: string, options: { limit?: number; offset?: number } = {}): Promise<ListResult<MessageData>> {
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    if (!this.supabase) {
      const channel = this.memory.channels.get(channelId);
      if (!channel || channel.tenant_id !== tenant_id) {
        return this.listResult([], limit, offset);
      }
      let items = Array.from(this.memory.messages.values()).filter(
        (item) => item.channel_id === channelId
      );
      items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return this.listResult(items, limit, offset);
    }

    await this.setTenantContext(tenant_id);

    try {
      const { data, error, count } = await this.supabase
        .from('qubetalk_messages')
        .select('*', { count: 'exact' })
        .eq('channel_id', channelId)
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return {
        items: data || [],
        total: count || 0,
        limit,
        offset,
      };
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      console.warn('QubeTalk message list fallback to memory:', error);
      const channel = this.memory.channels.get(channelId);
      if (!channel || channel.tenant_id !== tenant_id) {
        return this.listResult([], limit, offset);
      }
      let items = Array.from(this.memory.messages.values()).filter(
        (item) => item.channel_id === channelId
      );
      items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      return this.listResult(items, limit, offset);
    }
  }

  async deleteMessage(messageId: string, tenant_id: string): Promise<boolean> {
    if (!this.supabase) {
      const record = this.memory.messages.get(messageId);
      if (!record) return false;
      const channel = this.memory.channels.get(record.channel_id);
      if (!channel || channel.tenant_id !== tenant_id) return false;
      return this.memory.messages.delete(messageId);
    }

    await this.setTenantContext(tenant_id);

    try {
      const { error } = await this.supabase
        .from('qubetalk_messages')
        .delete()
        .eq('message_id', messageId);

      return !error;
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      console.warn('QubeTalk message delete fallback to memory:', error);
      const record = this.memory.messages.get(messageId);
      if (!record) return false;
      const channel = this.memory.channels.get(record.channel_id);
      if (!channel || channel.tenant_id !== tenant_id) return false;
      return this.memory.messages.delete(messageId);
    }
  }

  // Utility operations
  async getChannelStats(channelId: string, tenant_id: string): Promise<{
    message_count: number;
    delegation_count: number;
    last_activity: string | null;
  }> {
    if (!this.supabase) {
      const channel = this.memory.channels.get(channelId);
      if (!channel || channel.tenant_id !== tenant_id) {
        return { message_count: 0, delegation_count: 0, last_activity: null };
      }
      const messages = Array.from(this.memory.messages.values()).filter(
        (item) => item.channel_id === channelId
      );
      const delegations = Array.from(this.memory.delegations.values()).filter(
        (item) => item.channel_id === channelId && item.tenant_id === tenant_id
      );
      const lastActivity = messages
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      return {
        message_count: messages.length,
        delegation_count: delegations.length,
        last_activity: lastActivity?.created_at || null,
      };
    }

    await this.setTenantContext(tenant_id);

    try {
      const [messageCount, delegationCount, lastMessage] = await Promise.all([
        this.supabase
          .from('qubetalk_messages')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', channelId),

        this.supabase
          .from('qubetalk_delegations')
          .select('*', { count: 'exact', head: true })
          .eq('channel_id', channelId),

        this.supabase
          .from('qubetalk_messages')
          .select('created_at')
          .eq('channel_id', channelId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
      ]);

      return {
        message_count: messageCount.count || 0,
        delegation_count: delegationCount.count || 0,
        last_activity: lastMessage.data?.created_at || null,
      };
    } catch (error) {
      if (!this.fallbackEnabled) throw error;
      console.warn('QubeTalk channel stats fallback to memory:', error);
      const channel = this.memory.channels.get(channelId);
      if (!channel || channel.tenant_id !== tenant_id) {
        return { message_count: 0, delegation_count: 0, last_activity: null };
      }
      const messages = Array.from(this.memory.messages.values()).filter(
        (item) => item.channel_id === channelId
      );
      const delegations = Array.from(this.memory.delegations.values()).filter(
        (item) => item.channel_id === channelId && item.tenant_id === tenant_id
      );
      const lastActivity = messages
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      return {
        message_count: messages.length,
        delegation_count: delegations.length,
        last_activity: lastActivity?.created_at || null,
      };
    }
  }
}

// Export singleton instance
export const qubetalkPersistence = new QubeTalkPersistence();

// Export individual functions for convenience
export const {
  createChannel,
  getChannel,
  listChannels,
  updateChannel,
  deleteChannel,
  createDelegation,
  getDelegation,
  getDelegationByRequestId,
  listDelegations,
  updateDelegation,
  deleteDelegation,
  createMessage,
  getMessage,
  listMessages,
  deleteMessage,
  getChannelStats,
} = qubetalkPersistence;
