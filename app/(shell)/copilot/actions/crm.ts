/**
 * CopilotKit CRM Actions
 * 
 * Backend actions for CRM operations via natural language.
 * Integrates with the CRM service layer and logs interactions to copilot history.
 */

import * as crmService from '@/services/crm/crmService';
import * as db from '@/services/crm/crmDataAccess';
import { TenantId, TokenType } from '@/types/crm';

// ============================================================================
// PERSONA ACTIONS
// ============================================================================

export const listCrmPersonasAction = {
  name: 'listCrmPersonas',
  description: 'List personas in the CRM for a specific tenant. Personas are user identities within a tenant application.',
  parameters: [
    {
      name: 'tenantId',
      type: 'string' as const,
      description: 'The tenant ID to list personas for',
      required: true,
    },
    {
      name: 'search',
      type: 'string' as const,
      description: 'Optional search term to filter personas by name or email',
      required: false,
    },
    {
      name: 'limit',
      type: 'number' as const,
      description: 'Maximum number of personas to return (default: 20)',
      required: false,
    },
  ],
  handler: async ({ tenantId, search, limit = 20 }: { tenantId: string; search?: string; limit?: number }) => {
    const startTime = Date.now();
    try {
      const personas = await crmService.listPersonas(tenantId as TenantId, { search, limit });
      
      // Log to copilot history
      await db.createCopilotHistory({
        tenantId,
        queryText: `List personas${search ? ` matching "${search}"` : ''}`,
        parsedIntent: 'list_personas',
        extractedEntities: { tenantId, search, limit },
        executedActions: ['listCrmPersonas'],
        resultSummary: `Found ${personas.length} personas`,
        resultCount: personas.length,
        executionTimeMs: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        personas: personas.map(p => ({
          id: p.id,
          displayName: p.displayName || `Persona ${p.id.slice(0, 8)}`,
          email: p.email,
          personaState: p.personaState,
          reputationBucket: p.reputationBucket,
          createdAt: p.createdAt,
        })),
        count: personas.length,
      };
    } catch (error: any) {
      await db.createCopilotHistory({
        tenantId,
        queryText: `List personas${search ? ` matching "${search}"` : ''}`,
        parsedIntent: 'list_personas',
        success: false,
        errorMessage: error.message,
        executionTimeMs: Date.now() - startTime,
      });
      return { success: false, error: error.message };
    }
  },
};

export const getPersonaSummaryAction = {
  name: 'getPersonaSummary',
  description: 'Get a detailed summary of a persona including their PoKW score, recent contributions, and entitlements.',
  parameters: [
    {
      name: 'tenantId',
      type: 'string' as const,
      description: 'The tenant ID',
      required: true,
    },
    {
      name: 'personaId',
      type: 'string' as const,
      description: 'The persona ID to get summary for',
      required: true,
    },
  ],
  handler: async ({ tenantId, personaId }: { tenantId: string; personaId: string }) => {
    const startTime = Date.now();
    try {
      const summary = await crmService.getPersonaSummary(tenantId as TenantId, personaId);
      
      if (!summary) {
        return { success: false, error: 'Persona not found' };
      }

      await db.createCopilotHistory({
        tenantId,
        personaId,
        queryText: `Get summary for persona ${personaId}`,
        parsedIntent: 'get_persona_summary',
        executedActions: ['getPersonaSummary'],
        resultSummary: `PoKW: ${summary.pokw.total.toFixed(2)}, ${summary.recentContributions.length} recent contributions`,
        executionTimeMs: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        persona: {
          id: summary.persona.id,
          displayName: summary.persona.displayName,
          email: summary.persona.email,
          personaState: summary.persona.personaState,
          reputationBucket: summary.persona.reputationBucket,
        },
        pokw: summary.pokw,
        recentContributions: summary.recentContributions.slice(0, 5).map(c => ({
          type: c.contributionType,
          pokwScore: c.pokwScore,
          createdAt: c.createdAt,
        })),
        entitlementCount: summary.entitlements.length,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// CONTRIBUTION ACTIONS
// ============================================================================

export const recordContributionAction = {
  name: 'recordContribution',
  description: 'Record a contribution for a persona. This computes and awards PoKW (Proof of Knowledge Work) points.',
  parameters: [
    {
      name: 'tenantId',
      type: 'string' as const,
      description: 'The tenant ID',
      required: true,
    },
    {
      name: 'personaId',
      type: 'string' as const,
      description: 'The persona ID making the contribution',
      required: true,
    },
    {
      name: 'contributionType',
      type: 'string' as const,
      description: 'Type of contribution (e.g., article_created, comment_posted, quiz_completed)',
      required: true,
    },
    {
      name: 'units',
      type: 'number' as const,
      description: 'Number of units for this contribution (default: 1)',
      required: false,
    },
    {
      name: 'qubeId',
      type: 'string' as const,
      description: 'Optional iQube ID this contribution is associated with',
      required: false,
    },
  ],
  handler: async ({ 
    tenantId, 
    personaId, 
    contributionType, 
    units = 1, 
    qubeId 
  }: { 
    tenantId: string; 
    personaId: string; 
    contributionType: string; 
    units?: number; 
    qubeId?: string;
  }) => {
    const startTime = Date.now();
    try {
      const result = await crmService.recordContribution({
        tenantId: tenantId as TenantId,
        personaId,
        contributionType,
        units,
        qubeId,
        source: 'copilot',
      });

      await db.createCopilotHistory({
        tenantId,
        personaId,
        queryText: `Record ${contributionType} contribution`,
        parsedIntent: 'record_contribution',
        extractedEntities: { contributionType, units, qubeId },
        executedActions: ['recordContribution'],
        resultSummary: `Awarded ${result.pokwScore.toFixed(2)} PoKW`,
        executionTimeMs: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        contributionId: result.id,
        pokwAwarded: result.pokwScore,
        message: `Recorded ${contributionType} contribution. Awarded ${result.pokwScore.toFixed(2)} PoKW points.`,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// TOP CONTRIBUTORS ACTION
// ============================================================================

export const getTopContributorsAction = {
  name: 'getTopContributors',
  description: 'Get the top contributors for a tenant within a time period, ranked by PoKW score.',
  parameters: [
    {
      name: 'tenantId',
      type: 'string' as const,
      description: 'The tenant ID',
      required: true,
    },
    {
      name: 'periodStart',
      type: 'string' as const,
      description: 'Start of period (ISO date string, e.g., 2024-01-01)',
      required: true,
    },
    {
      name: 'periodEnd',
      type: 'string' as const,
      description: 'End of period (ISO date string, e.g., 2024-01-31)',
      required: true,
    },
    {
      name: 'limit',
      type: 'number' as const,
      description: 'Number of top contributors to return (default: 10)',
      required: false,
    },
  ],
  handler: async ({ 
    tenantId, 
    periodStart, 
    periodEnd, 
    limit = 10 
  }: { 
    tenantId: string; 
    periodStart: string; 
    periodEnd: string; 
    limit?: number;
  }) => {
    const startTime = Date.now();
    try {
      const topContributors = await crmService.getTopContributors(
        tenantId as TenantId,
        periodStart,
        periodEnd,
        limit
      );

      await db.createCopilotHistory({
        tenantId,
        queryText: `Get top ${limit} contributors from ${periodStart} to ${periodEnd}`,
        parsedIntent: 'get_top_contributors',
        extractedEntities: { periodStart, periodEnd, limit },
        executedActions: ['getTopContributors'],
        resultSummary: `Found ${topContributors.length} contributors`,
        resultCount: topContributors.length,
        executionTimeMs: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        period: { start: periodStart, end: periodEnd },
        topContributors: topContributors.map((c, i) => ({
          rank: i + 1,
          personaId: c.personaId,
          displayName: c.displayName || `Persona ${c.personaId.slice(0, 8)}`,
          totalPokw: c.totalPokw,
          contributionCount: c.contributionCount,
          engagementCount: c.engagementCount,
        })),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// REWARD ACTIONS
// ============================================================================

export const proposeRewardsAction = {
  name: 'proposeRewards',
  description: 'Propose rewards for top contributors based on their PoKW scores. Allocates budget pro-rata.',
  parameters: [
    {
      name: 'tenantId',
      type: 'string' as const,
      description: 'The tenant ID',
      required: true,
    },
    {
      name: 'periodStart',
      type: 'string' as const,
      description: 'Start of reward period (ISO date string)',
      required: true,
    },
    {
      name: 'periodEnd',
      type: 'string' as const,
      description: 'End of reward period (ISO date string)',
      required: true,
    },
    {
      name: 'qctBudget',
      type: 'number' as const,
      description: 'QCT token budget to distribute',
      required: false,
    },
    {
      name: 'qoynBudget',
      type: 'number' as const,
      description: 'QOYN token budget to distribute',
      required: false,
    },
    {
      name: 'topN',
      type: 'number' as const,
      description: 'Number of top contributors to reward (default: 10)',
      required: false,
    },
  ],
  handler: async ({ 
    tenantId, 
    periodStart, 
    periodEnd, 
    qctBudget, 
    qoynBudget, 
    topN = 10 
  }: { 
    tenantId: string; 
    periodStart: string; 
    periodEnd: string; 
    qctBudget?: number; 
    qoynBudget?: number; 
    topN?: number;
  }) => {
    const startTime = Date.now();
    try {
      const budget: Partial<Record<TokenType, number>> = {};
      if (qctBudget) budget.QCT = qctBudget;
      if (qoynBudget) budget.QOYN = qoynBudget;

      if (Object.keys(budget).length === 0) {
        return { success: false, error: 'At least one budget (qctBudget or qoynBudget) is required' };
      }

      const result = await crmService.proposeRewards({
        tenantId: tenantId as TenantId,
        periodStart,
        periodEnd,
        budget,
        topN,
      });

      await db.createCopilotHistory({
        tenantId,
        queryText: `Propose rewards for period ${periodStart} to ${periodEnd}`,
        parsedIntent: 'propose_rewards',
        extractedEntities: { periodStart, periodEnd, budget, topN },
        executedActions: ['proposeRewards'],
        resultSummary: `Created ${result.rewards.length} reward proposals`,
        resultCount: result.rewards.length,
        executionTimeMs: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        totalPokw: result.totalPokw,
        allocations: result.allocations,
        rewardCount: result.rewards.length,
        rewards: result.rewards.slice(0, 5).map(r => ({
          id: r.id,
          personaId: r.personaId,
          tokenType: r.tokenType,
          amount: r.amount,
          status: r.status,
        })),
        message: `Created ${result.rewards.length} reward proposals totaling ${JSON.stringify(result.allocations)}`,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// UNIFIED PROFILE ACTION
// ============================================================================

export const getUnifiedProfileAction = {
  name: 'getUnifiedProfile',
  description: 'Get a unified profile view for a Kybe DID holder, showing their activity across ALL tenants they participate in.',
  parameters: [
    {
      name: 'kybeDid',
      type: 'string' as const,
      description: 'The Kybe DID to get unified profile for',
      required: true,
    },
  ],
  handler: async ({ kybeDid }: { kybeDid: string }) => {
    const startTime = Date.now();
    try {
      const profile = await crmService.getUnifiedProfile(kybeDid);
      
      if (!profile) {
        return { success: false, error: 'Profile not found for this Kybe DID' };
      }

      await db.createCopilotHistory({
        queryText: `Get unified profile for ${kybeDid}`,
        parsedIntent: 'get_unified_profile',
        extractedEntities: { kybeDid },
        executedActions: ['getUnifiedProfile'],
        resultSummary: `Found profile with ${profile.personas.length} personas across ${profile.aggregatedStats.tenantCount} tenants`,
        executionTimeMs: Date.now() - startTime,
        success: true,
      });

      return {
        success: true,
        kybeDid: profile.kybeDid,
        authProfile: profile.authProfile ? {
          email: profile.authProfile.email,
          displayName: profile.authProfile.displayName,
        } : null,
        stats: profile.aggregatedStats,
        personas: profile.personas.map(p => ({
          personaId: p.persona.id,
          displayName: p.persona.displayName,
          tenantName: p.tenant.name,
          franchiseName: p.franchise.name,
          isPrimary: p.isPrimary,
        })),
        recentActivity: profile.recentActivity.slice(0, 5),
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// FRANCHISE & TENANT ACTIONS
// ============================================================================

export const listFranchisesAction = {
  name: 'listFranchises',
  description: 'List all franchises in the AgentiQ platform.',
  parameters: [],
  handler: async () => {
    try {
      const franchises = await crmService.listFranchises();
      return {
        success: true,
        franchises: franchises.map(f => ({
          id: f.id,
          slug: f.slug,
          name: f.name,
          description: f.description,
          isActive: f.isActive,
        })),
        count: franchises.length,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

export const listTenantsAction = {
  name: 'listTenants',
  description: 'List tenants, optionally filtered by franchise.',
  parameters: [
    {
      name: 'franchiseId',
      type: 'string' as const,
      description: 'Optional franchise ID to filter tenants',
      required: false,
    },
  ],
  handler: async ({ franchiseId }: { franchiseId?: string }) => {
    try {
      const tenants = await crmService.listTenants(franchiseId);
      return {
        success: true,
        tenants: tenants.map(t => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          franchiseId: t.franchiseId,
          domain: t.domain,
          isActive: t.isActive,
        })),
        count: tenants.length,
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// EXPORT ALL CRM ACTIONS
// ============================================================================

export const crmActions = [
  listCrmPersonasAction,
  getPersonaSummaryAction,
  recordContributionAction,
  getTopContributorsAction,
  proposeRewardsAction,
  getUnifiedProfileAction,
  listFranchisesAction,
  listTenantsAction,
];
