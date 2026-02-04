/**
 * Marketa RBAC Middleware and API Security
 * 
 * Ensures tenant isolation and proper access control for Marketa API endpoints.
 * Partners can only access their own tenant data, never other partners' data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface MarketaAuthContext {
  tenantId: string;
  personaId: string;
  partnerId?: string;
  role: 'admin' | 'partner' | 'viewer';
  permissions: string[];
}

export interface MarketaPermissions {
  // Partner-specific permissions
  'marketa:partners:read': boolean;
  'marketa:partners:write': boolean;
  'marketa:campaigns:read': boolean;
  'marketa:campaigns:write': boolean;
  'marketa:packs:read': boolean;
  'marketa:packs:write': boolean;
  'marketa:publish': boolean;
  'marketa:segments:read': boolean;
  'marketa:segments:write': boolean;
  'marketa:rewards:read': boolean;
  'marketa:rewards:issue': boolean;
  'marketa:reports:read': boolean;
  'marketa:crm:read': boolean;
  'marketa:crm:write': boolean;
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Extract and validate authentication token from request
 */
export async function authenticateMarketaRequest(
  req: NextRequest
): Promise<MarketaAuthContext | null> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.MARKETA_JWT_SECRET!) as any;
    
    if (!decoded.tenantId || !decoded.personaId) {
      return null;
    }

    // Get persona details to verify role and permissions
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: persona } = await supabase
      .from('crm_personas')
      .select(`
        *,
        crm_tenants!inner(
          id,
          franchise_id,
          is_active
        )
      `)
      .eq('id', decoded.personaId)
      .eq('tenant_id', decoded.tenantId)
      .single();

    if (!persona || !persona.crm_tenants?.is_active) {
      return null;
    }

    // Determine role and permissions
    const role = await determineUserRole(decoded.personaId, decoded.tenantId);
    const permissions = getPermissionsForRole(role);

    return {
      tenantId: decoded.tenantId,
      personaId: decoded.personaId,
      partnerId: decoded.partnerId,
      role,
      permissions,
    };
  } catch (error) {
    console.error('[Marketa Auth] Authentication failed:', error);
    return null;
  }
}

/**
 * Determine user role based on persona and tenant relationships
 */
async function determineUserRole(
  personaId: string,
  tenantId: string
): Promise<'admin' | 'partner' | 'viewer'> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // For now, default to partner role for all authenticated users
  // TODO: Implement proper admin role checking when crm_tenant_admins table exists
  
  // Check if user is partner (has partner access)
  const { data: partnerAccess } = await supabase
    .from('marketa.partner_access')
    .select('*')
    .eq('persona_id', personaId)
    .eq('tenant_id', tenantId)
    .single();

  if (partnerAccess) {
    return 'partner';
  }

  // Default to partner for authenticated users in their tenant
  return 'partner';
}

/**
 * Get permissions for a given role
 */
function getPermissionsForRole(role: 'admin' | 'partner' | 'viewer'): string[] {
  const rolePermissions = {
    admin: [
      'marketa:partners:read',
      'marketa:partners:write',
      'marketa:campaigns:read',
      'marketa:campaigns:write',
      'marketa:packs:read',
      'marketa:packs:write',
      'marketa:publish',
      'marketa:segments:read',
      'marketa:segments:write',
      'marketa:rewards:read',
      'marketa:rewards:issue',
      'marketa:reports:read',
      'marketa:crm:read',
      'marketa:crm:write',
    ],
    partner: [
      'marketa:partners:read',
      'marketa:campaigns:read',
      'marketa:campaigns:write',
      'marketa:packs:read',
      'marketa:packs:write',
      'marketa:publish',
      'marketa:segments:read',
      'marketa:segments:write',
      'marketa:rewards:read',
      'marketa:rewards:issue',
      'marketa:reports:read',
      'marketa:crm:read',
    ],
    viewer: [
      'marketa:campaigns:read',
      'marketa:packs:read',
      'marketa:segments:read',
      'marketa:rewards:read',
      'marketa:reports:read',
      'marketa:crm:read',
    ],
  };

  return rolePermissions[role] || [];
}

// ============================================================================
// AUTHORIZATION HELPERS
// ============================================================================

/**
 * Check if user has specific permission
 */
export function hasPermission(
  authContext: MarketaAuthContext,
  permission: keyof MarketaPermissions
): boolean {
  return authContext.permissions.includes(permission);
}

/**
 * Require specific permission, throw error if not authorized
 */
export function requirePermission(
  authContext: MarketaAuthContext,
  permission: keyof MarketaPermissions
): void {
  if (!hasPermission(authContext, permission)) {
    throw new Error(`Insufficient permissions: ${permission} required`);
  }
}

/**
 * Check if user can access tenant data (tenant isolation)
 */
export function canAccessTenantData(
  authContext: MarketaAuthContext,
  targetTenantId: string
): boolean {
  // Users can only access their own tenant data
  // Admin users can access all data (for platform management)
  return authContext.role === 'admin' || authContext.tenantId === targetTenantId;
}

/**
 * Require tenant access, throw error if not authorized
 */
export function requireTenantAccess(
  authContext: MarketaAuthContext,
  targetTenantId: string
): void {
  if (!canAccessTenantData(authContext, targetTenantId)) {
    throw new Error(`Access denied: Cannot access tenant ${targetTenantId}`);
  }
}

// ============================================================================
// API MIDDLEWARE WRAPPER
// ============================================================================

/**
 * Wrap API route with RBAC authentication and authorization
 */
export function withMarketaAuth(
  handler: (req: NextRequest, authContext: MarketaAuthContext) => Promise<NextResponse>,
  options?: {
    requiredPermission?: keyof MarketaPermissions;
    requireTenantId?: boolean;
  }
) {
  return async (req: NextRequest) => {
    try {
      // Authenticate request
      const authContext = await authenticateMarketaRequest(req);
      if (!authContext) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Check required permission
      if (options?.requiredPermission) {
        requirePermission(authContext, options.requiredPermission);
      }

      // Check tenant access if tenantId is required
      if (options?.requireTenantId) {
        const { searchParams } = new URL(req.url);
        const tenantId = searchParams.get('tenantId') || authContext.tenantId;
        requireTenantAccess(authContext, tenantId);
      }

      // Call the actual handler
      return await handler(req, authContext);
    } catch (error) {
      console.error('[Marketa Auth] Middleware error:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Insufficient permissions')) {
          return NextResponse.json(
            { error: error.message },
            { status: 403 }
          );
        }
        if (error.message.includes('Access denied')) {
          return NextResponse.json(
            { error: error.message },
            { status: 403 }
          );
        }
      }

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

// ============================================================================
// DATABASE QUERY HELPERS
// ============================================================================

/**
 * Apply tenant filtering to database queries
 */
export function applyTenantFilter(
  query: any,
  authContext: MarketaAuthContext,
  tenantIdColumn = 'tenant_id'
) {
  // Admin users can see all data
  if (authContext.role === 'admin') {
    return query;
  }

  // Non-admin users can only see their tenant data
  return query.eq(tenantIdColumn, authContext.tenantId);
}

/**
 * Apply partner filtering for partner-specific data
 */
export function applyPartnerFilter(
  query: any,
  authContext: MarketaAuthContext,
  partnerIdColumn = 'partner_id'
) {
  // If user has specific partner access, filter to that partner
  if (authContext.partnerId) {
    return query.eq(partnerIdColumn, authContext.partnerId);
  }

  // Otherwise, apply tenant filtering
  return applyTenantFilter(query, authContext);
}
