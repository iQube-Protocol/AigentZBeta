/**
 * Tenant Management Service
 * 
 * Handles tenant creation, management, and user operations
 */

import { createClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';

// Types
export interface Tenant {
  tenant_id: string;
  name: string;
  slug: string;
  description?: string;
  status: 'active' | 'inactive' | 'suspended';
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by?: string;
  metadata: Record<string, any>;
}

export interface User {
  user_id: string;
  email: string;
  username?: string;
  display_name: string;
  avatar_url?: string;
  status: 'pending' | 'active' | 'inactive' | 'suspended';
  email_verified: boolean;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

export interface TenantMembership {
  membership_id: string;
  tenant_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'inactive' | 'pending' | 'invited';
  invited_by?: string;
  invited_at?: string;
  joined_at: string;
  permissions: Record<string, any>;
}

export interface Role {
  role_id: string;
  tenant_id?: string;
  name: string;
  description?: string;
  permissions: string[];
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserInvitation {
  invitation_id: string;
  tenant_id: string;
  email: string;
  role: string;
  invited_by: string;
  invitation_token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  created_at: string;
  expires_at: string;
  accepted_at?: string;
  accepted_by?: string;
}

export interface CreateTenantRequest {
  name: string;
  slug: string;
  description?: string;
  created_by: string;
  settings?: Record<string, any>;
}

export interface CreateUserRequest {
  email: string;
  username?: string;
  display_name: string;
  avatar_url?: string;
  password?: string;
}

export interface CreateInvitationRequest {
  tenant_id: string;
  email: string;
  role: string;
  invited_by: string;
}

class TenantService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient();
  }

  // Helper functions
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  private hashPassword(password: string): string {
    return createHash('sha256').update(password).digest('hex');
  }

  // Tenant operations
  async createTenant(request: CreateTenantRequest): Promise<Tenant> {
    const tenant = {
      tenant_id: this.generateId('tenant'),
      name: request.name,
      slug: request.slug || this.generateSlug(request.name),
      description: request.description,
      status: 'active' as const,
      settings: request.settings || {},
      created_by: request.created_by,
      metadata: {},
    };

    const { data, error } = await this.supabase
      .from('tenants')
      .insert(tenant)
      .select()
      .single();

    if (error) throw error;

    // Create default roles for the tenant
    await this.supabase.rpc('create_default_tenant_roles', {
      p_tenant_id: tenant.tenant_id
    });

    return data;
  }

  async getTenant(tenantId: string): Promise<Tenant | null> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    const { data, error } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant | null> {
    const { data, error } = await this.supabase
      .from('tenants')
      .update(updates)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async listTenants(options: {
    userId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ tenants: Tenant[]; total: number }> {
    let query = this.supabase
      .from('tenants')
      .select('*', { count: 'exact' });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return {
      tenants: data || [],
      total: count || 0,
    };
  }

  // User operations
  async createUser(request: CreateUserRequest): Promise<User> {
    const user = {
      user_id: this.generateId('user'),
      email: request.email,
      username: request.username,
      display_name: request.display_name,
      avatar_url: request.avatar_url,
      status: 'pending' as const,
      email_verified: false,
      metadata: {},
    };

    const { data, error } = await this.supabase
      .from('users')
      .insert(user)
      .select()
      .single();

    if (error) throw error;

    // Create password credential if provided
    if (request.password) {
      await this.createUserCredential({
        user_id: user.user_id,
        type: 'password',
        identifier: request.email,
        secret_hash: this.hashPassword(request.password),
      });
    }

    return data;
  }

  async getUser(userId: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // User credentials
  async createUserCredential(credential: {
    user_id: string;
    type: 'password' | 'oauth' | 'wallet' | 'did';
    identifier: string;
    secret_hash?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('user_credentials')
      .insert({
        credential_id: this.generateId('cred'),
        ...credential,
        metadata: credential.metadata || {},
      });

    if (error) throw error;
  }

  async verifyUserPassword(email: string, password: string): Promise<User | null> {
    const hashedPassword = this.hashPassword(password);

    const { data, error } = await this.supabase
      .from('user_credentials')
      .select(`
        user_id,
        users!inner(*)
      `)
      .eq('identifier', email)
      .eq('type', 'password')
      .eq('secret_hash', hashedPassword)
      .single();

    if (error) return null;
    return (data as any)?.users as User;
  }

  // Tenant membership operations
  async addTenantMembership(membership: {
    tenant_id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'member' | 'viewer';
    invited_by?: string;
  }): Promise<TenantMembership> {
    const membershipData = {
      membership_id: this.generateId('membership'),
      ...membership,
      status: 'active' as const,
      permissions: {},
      joined_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('tenant_memberships')
      .insert(membershipData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getTenantMembership(tenantId: string, userId: string): Promise<TenantMembership | null> {
    const { data, error } = await this.supabase
      .from('tenant_memberships')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async listTenantMembers(tenantId: string, options: {
    role?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ members: (TenantMembership & User)[]; total: number }> {
    let query = this.supabase
      .from('tenant_memberships')
      .select(`
        *,
        users!inner(*)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (options.role) {
      query = query.eq('role', options.role);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('joined_at', { ascending: false });

    if (error) throw error;

    return {
      members: data || [],
      total: count || 0,
    };
  }

  async updateTenantMembership(tenantId: string, userId: string, updates: Partial<TenantMembership>): Promise<TenantMembership | null> {
    const { data, error } = await this.supabase
      .from('tenant_memberships')
      .update(updates)
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async removeTenantMembership(tenantId: string, userId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('tenant_memberships')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('user_id', userId);

    return !error;
  }

  // User invitations
  async createInvitation(request: CreateInvitationRequest): Promise<UserInvitation> {
    const invitation = {
      invitation_id: this.generateId('invite'),
      ...request,
      invitation_token: this.generateToken(),
      status: 'pending' as const,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    };

    const { data, error } = await this.supabase
      .from('user_invitations')
      .insert(invitation)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getInvitation(token: string): Promise<UserInvitation | null> {
    const { data, error } = await this.supabase
      .from('user_invitations')
      .select('*')
      .eq('invitation_token', token)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  }

  async acceptInvitation(token: string, userId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('user_invitations')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: userId,
      })
      .eq('invitation_token', token);

    if (error) throw error;

    // Add user to tenant
    const invitation = await this.getInvitation(token);
    if (invitation) {
      await this.addTenantMembership({
        tenant_id: invitation.tenant_id,
        user_id: userId,
        role: invitation.role as any,
        invited_by: invitation.invited_by,
      });
    }

    return true;
  }

  // Role operations
  async listRoles(tenantId?: string): Promise<Role[]> {
    let query = this.supabase
      .from('roles')
      .select('*')
      .order('is_system_role', { ascending: false })
      .order('name', { ascending: true });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    } else {
      query = query.is('tenant_id', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async assignRole(userId: string, roleId: string, tenantId?: string, assignedBy?: string): Promise<void> {
    const { error } = await this.supabase
      .from('user_roles')
      .insert({
        assignment_id: this.generateId('assignment'),
        user_id: userId,
        role_id: roleId,
        tenant_id: tenantId,
        assigned_by: assignedBy,
      });

    if (error) throw error;
  }

  async checkUserPermission(userId: string, tenantId: string, permission: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .rpc('check_user_permission', {
        p_user_id: userId,
        p_tenant_id: tenantId,
        p_permission: permission,
      });

    if (error) throw error;
    return data || false;
  }

  // Utility functions
  async getTenantStats(tenantId: string): Promise<{
    total_users: number;
    active_users: number;
    total_invitations: number;
    pending_invitations: number;
  }> {
    const [members, invitations] = await Promise.all([
      this.listTenantMembers(tenantId),
      this.supabase
        .from('user_invitations')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ]);

    const activeUsers = members.members.filter(m => m.status === 'active').length;
    const pendingInvitations = invitations.count || 0;

    return {
      total_users: members.total,
      active_users: activeUsers,
      total_invitations: pendingInvitations,
      pending_invitations: pendingInvitations,
    };
  }
}

// Export singleton instance
export const tenantService = new TenantService();

// Export individual functions for convenience
export const {
  createTenant,
  getTenant,
  getTenantBySlug,
  updateTenant,
  listTenants,
  createUser,
  getUser,
  getUserByEmail,
  updateUser,
  createUserCredential,
  verifyUserPassword,
  addTenantMembership,
  getTenantMembership,
  listTenantMembers,
  updateTenantMembership,
  removeTenantMembership,
  createInvitation,
  getInvitation,
  acceptInvitation,
  listRoles,
  assignRole,
  checkUserPermission,
  getTenantStats,
} = tenantService;
