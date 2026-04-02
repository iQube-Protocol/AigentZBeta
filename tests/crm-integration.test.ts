/**
 * CRM Integration Test Suite
 * Tests for AgentiQ CRM service layer, API endpoints, and data access
 * 
 * Test Coverage:
 * - Persona CRUD operations
 * - Contribution recording and PoKW calculations
 * - Reward proposal workflow
 * - Segment management
 * - Franchise/Tenant hierarchy
 * - Admin role access control
 * 
 * Run with: npm run test:crm
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as crmService from '../services/crm/crmService';
import * as db from '../services/crm/crmDataAccess';
import { TenantId, TokenType, ContributionType, RewardStatus, ReputationBucket } from '../types/crm';

// Test tenant ID for isolation
const TEST_TENANT_ID = 'test-tenant-crm' as TenantId;
const TEST_FRANCHISE_ID = 'test-franchise-crm';
// Admin roles table uses UUID type for tenant_id — use a valid UUID for those tests
const TEST_ADMIN_TENANT_UUID = '00000000-0000-0000-0000-000000000099' as unknown as TenantId;

// ============================================================================
// PERSONA TESTS
// ============================================================================

describe('CRM Persona Operations', () => {
  let testPersonaId: string;

  describe('Create Persona', () => {
    it('should create a new persona with required fields', async () => {
      const personaData = {
        tenantId: TEST_TENANT_ID,
        displayName: 'Test User',
        email: `test-${Date.now()}@example.com`,
        personaState: 'pseudonymous' as const,
      };

      const persona = await crmService.createPersona(personaData);
      testPersonaId = persona.id;

      expect(persona).toBeDefined();
      expect(persona.id).toBeDefined();
      expect(persona.displayName).toBe(personaData.displayName);
      expect(persona.email).toBe(personaData.email);
      expect(persona.tenantId).toBe(TEST_TENANT_ID);
      expect(persona.personaState).toBe('pseudonymous');
    });

    it('should create persona with Kybe DID', async () => {
      const personaData = {
        tenantId: TEST_TENANT_ID,
        kybeDid: `did:kybe:test-${Date.now()}`,
        displayName: 'DID User',
        personaState: 'pseudonymous' as const,
      };

      const persona = await crmService.createPersona(personaData);

      expect(persona.kybeDid).toBe(personaData.kybeDid);
    });

    it('should reject duplicate email within same tenant', async () => {
      const email = `duplicate-${Date.now()}@example.com`;
      
      await crmService.createPersona({
        tenantId: TEST_TENANT_ID,
        email,
        displayName: 'First User',
        personaState: 'pseudonymous',
      });

      await expect(
        crmService.createPersona({
          tenantId: TEST_TENANT_ID,
          email,
          displayName: 'Second User',
          personaState: 'pseudonymous',
        })
      ).rejects.toThrow();
    });
  });

  describe('List Personas', () => {
    it('should list personas for a tenant', async () => {
      const personas = await crmService.listPersonas(TEST_TENANT_ID, { limit: 10 });

      expect(Array.isArray(personas)).toBe(true);
      personas.forEach(p => {
        expect(p.tenantId).toBe(TEST_TENANT_ID);
      });
    });

    it('should filter personas by search term', async () => {
      const personas = await crmService.listPersonas(TEST_TENANT_ID, { 
        search: 'Test',
        limit: 10 
      });

      personas.forEach(p => {
        const matchesSearch = 
          p.displayName?.toLowerCase().includes('test') ||
          p.email?.toLowerCase().includes('test');
        expect(matchesSearch).toBe(true);
      });
    });

    it('should respect limit parameter', async () => {
      const personas = await crmService.listPersonas(TEST_TENANT_ID, { limit: 5 });
      expect(personas.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Get Persona', () => {
    it('should retrieve persona by ID', async () => {
      if (!testPersonaId) {
        console.warn('Skipping: No test persona created');
        return;
      }

      const persona = await crmService.getPersona(TEST_TENANT_ID, testPersonaId);

      expect(persona).toBeDefined();
      expect(persona?.id).toBe(testPersonaId);
    });

    it('should return null for non-existent persona', async () => {
      const persona = await crmService.getPersona(TEST_TENANT_ID, 'non-existent-id');
      expect(persona).toBeNull();
    });
  });
});

// ============================================================================
// CONTRIBUTION TESTS
// ============================================================================

describe('CRM Contribution Operations', () => {
  let testPersonaId: string;

  beforeAll(async () => {
    // Create a test persona for contributions
    const persona = await crmService.createPersona({
      tenantId: TEST_TENANT_ID,
      displayName: 'Contributor Test User',
      email: `contributor-${Date.now()}@example.com`,
      personaState: 'pseudonymous',
    });
    testPersonaId = persona.id;
  });

  describe('Record Contribution', () => {
    it('should record a contribution with PoKW score', async () => {
      const contribution = await crmService.recordContribution({
        tenantId: TEST_TENANT_ID,
        personaId: testPersonaId,
        contributionType: 'article_created' as ContributionType,
        units: 1,
        source: 'test',
        metadata: { title: 'Test Article' },
      });

      expect(contribution).toBeDefined();
      expect(contribution.id).toBeDefined();
      expect(contribution.personaId).toBe(testPersonaId);
      expect(contribution.contributionType).toBe('article_created');
      expect(contribution.pokwScore).toBeGreaterThan(0);
    });

    it('should calculate PoKW based on contribution type', async () => {
      const articleContrib = await crmService.recordContribution({
        tenantId: TEST_TENANT_ID,
        personaId: testPersonaId,
        contributionType: 'article_created' as ContributionType,
        units: 1,
        source: 'test',
      });

      const commentContrib = await crmService.recordContribution({
        tenantId: TEST_TENANT_ID,
        personaId: testPersonaId,
        contributionType: 'comment_posted' as ContributionType,
        units: 1,
        source: 'test',
      });

      // Articles should have higher PoKW than comments
      expect(articleContrib.pokwScore).toBeGreaterThan(commentContrib.pokwScore);
    });

    it('should scale PoKW by units', async () => {
      const singleUnit = await crmService.recordContribution({
        tenantId: TEST_TENANT_ID,
        personaId: testPersonaId,
        contributionType: 'quiz_completed' as ContributionType,
        units: 1,
        source: 'test',
      });

      const multipleUnits = await crmService.recordContribution({
        tenantId: TEST_TENANT_ID,
        personaId: testPersonaId,
        contributionType: 'quiz_completed' as ContributionType,
        units: 3,
        source: 'test',
      });

      expect(multipleUnits.pokwScore).toBeGreaterThan(singleUnit.pokwScore);
    });
  });

  describe('List Contributions', () => {
    it('should list contributions for a tenant', async () => {
      const contributions = await crmService.listContributions(TEST_TENANT_ID, {
        topN: 10,
      });

      expect(Array.isArray(contributions)).toBe(true);
    });

    it('should filter contributions by persona', async () => {
      const contributions = await crmService.listContributions(TEST_TENANT_ID, {
        personaId: testPersonaId,
        topN: 10,
      });

      contributions.forEach(c => {
        expect(c.personaId).toBe(testPersonaId);
      });
    });

    it('should filter contributions by date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const contributions = await crmService.listContributions(TEST_TENANT_ID, {
        periodStart: yesterday.toISOString(),
        periodEnd: now.toISOString(),
        topN: 10,
      });

      contributions.forEach(c => {
        const createdAt = new Date(c.createdAt);
        expect(createdAt >= yesterday).toBe(true);
        expect(createdAt <= now).toBe(true);
      });
    });
  });

  describe('Top Contributors', () => {
    it('should return top contributors by PoKW', async () => {
      const topContributors = await crmService.getTopContributors(TEST_TENANT_ID, {
        topN: 5,
      });

      expect(Array.isArray(topContributors)).toBe(true);
      
      // Verify sorted by PoKW descending
      for (let i = 1; i < topContributors.length; i++) {
        expect(topContributors[i - 1].totalPokw).toBeGreaterThanOrEqual(topContributors[i].totalPokw);
      }
    });

    it('should include persona details in top contributors', async () => {
      const topContributors = await crmService.getTopContributors(TEST_TENANT_ID, {
        topN: 5,
      });

      topContributors.forEach(tc => {
        expect(tc.personaId).toBeDefined();
        expect(tc.totalPokw).toBeDefined();
        expect(typeof tc.totalPokw).toBe('number');
      });
    });
  });
});

// ============================================================================
// REWARD TESTS
// ============================================================================

describe('CRM Reward Operations', () => {
  describe('Propose Rewards', () => {
    it('should propose rewards based on PoKW', async () => {
      const result = await crmService.proposeRewards({
        tenantId: TEST_TENANT_ID,
        budget: { QCT: 100 },
        periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date().toISOString(),
        topN: 10,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.rewards)).toBe(true);
      expect(result.totalPokw).toBeDefined();
      expect(result.allocations).toBeDefined();
    });

    it('should allocate rewards proportionally to PoKW', async () => {
      const result = await crmService.proposeRewards({
        tenantId: TEST_TENANT_ID,
        budget: { QCT: 1000 },
        periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date().toISOString(),
        topN: 10,
      });

      if (result.rewards.length > 1) {
        // Higher PoKW should get higher reward
        const sortedByPokw = [...result.rewards].sort((a, b) => b.pokwBasis - a.pokwBasis);
        const sortedByAmount = [...result.rewards].sort((a, b) => b.amount - a.amount);
        
        expect(sortedByPokw[0].personaId).toBe(sortedByAmount[0].personaId);
      }
    });

    it('should create rewards with proposed status', async () => {
      const result = await crmService.proposeRewards({
        tenantId: TEST_TENANT_ID,
        budget: { QCT: 50 },
        periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date().toISOString(),
        topN: 5,
      });

      result.rewards.forEach(r => {
        expect(r.status).toBe('proposed');
      });
    });
  });

  describe('List Rewards', () => {
    it('should list rewards for a tenant', async () => {
      const rewards = await crmService.listRewards(TEST_TENANT_ID, { limit: 10 });

      expect(Array.isArray(rewards)).toBe(true);
    });

    it('should filter rewards by status', async () => {
      const proposedRewards = await crmService.listRewards(TEST_TENANT_ID, {
        status: 'proposed' as RewardStatus,
        topN: 10,
      });

      proposedRewards.forEach(r => {
        expect(r.status).toBe('proposed');
      });
    });

    it('should filter rewards by token type', async () => {
      const qctRewards = await crmService.listRewards(TEST_TENANT_ID, {
        tokenType: 'QCT' as TokenType,
        topN: 10,
      });

      qctRewards.forEach(r => {
        expect(r.tokenType).toBe('QCT');
      });
    });
  });

  describe('Approve/Reject Rewards', () => {
    let testRewardId: string;

    beforeAll(async () => {
      // Create a test reward
      const result = await crmService.proposeRewards({
        tenantId: TEST_TENANT_ID,
        budget: { QCT: 10 },
        periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date().toISOString(),
        topN: 1,
      });
      if (result.rewards.length > 0) {
        testRewardId = result.rewards[0].id;
      }
    });

    it('should approve a proposed reward', async () => {
      if (!testRewardId) {
        console.warn('Skipping: No test reward created');
        return;
      }

      const approved = await crmService.approveReward(TEST_TENANT_ID, testRewardId, 'admin-user');

      expect(approved.status).toBe('approved');
      expect(approved.approvedBy).toBe('admin-user');
      expect(approved.approvedAt).toBeDefined();
    });

    it('should reject a proposed reward', async () => {
      // Create another reward to reject
      const result = await crmService.proposeRewards({
        tenantId: TEST_TENANT_ID,
        budget: { QCT: 5 },
        periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date().toISOString(),
        topN: 1,
      });

      if (result.rewards.length > 0) {
        const rejected = await crmService.cancelReward(TEST_TENANT_ID, result.rewards[0].id);
        expect(rejected.status).toBe('cancelled');
      }
    });
  });
});

// ============================================================================
// SEGMENT TESTS
// ============================================================================

describe('CRM Segment Operations', () => {
  let testSegmentId: string;

  describe('Create Segment', () => {
    it('should create a static segment', async () => {
      const segment = await crmService.createSegment({
        tenantId: TEST_TENANT_ID,
        name: `Test Segment ${Date.now()}`,
        description: 'A test segment for integration tests',
        isDynamic: false,
      });

      testSegmentId = segment.id;

      expect(segment).toBeDefined();
      expect(segment.id).toBeDefined();
      expect(segment.isDynamic).toBe(false);
    });

    it('should create a dynamic segment with rules', async () => {
      const segment = await crmService.createSegment({
        tenantId: TEST_TENANT_ID,
        name: `Dynamic Segment ${Date.now()}`,
        description: 'Users with high PoKW',
        isDynamic: true,
        ruleDefinition: {
          minPokw: 100,
          activeWithinDays: 30,
        },
      });

      expect(segment.isDynamic).toBe(true);
      expect(segment.ruleDefinition).toBeDefined();
      expect(segment.ruleDefinition?.minPokw).toBe(100);
    });
  });

  describe('List Segments', () => {
    it('should list segments for a tenant', async () => {
      const segments = await crmService.listSegments(TEST_TENANT_ID, { limit: 10 });

      expect(Array.isArray(segments)).toBe(true);
    });
  });

  describe('Segment Membership', () => {
    let testPersonaId: string;

    beforeAll(async () => {
      const persona = await crmService.createPersona({
        tenantId: TEST_TENANT_ID,
        displayName: 'Segment Test User',
        email: `segment-${Date.now()}@example.com`,
        personaState: 'pseudonymous',
      });
      testPersonaId = persona.id;
    });

    it('should add persona to segment', async () => {
      if (!testSegmentId || !testPersonaId) {
        console.warn('Skipping: Missing test data');
        return;
      }

      const member = await db.addSegmentMember(testSegmentId, testPersonaId);

      expect(member).toBeDefined();
      expect(member.segmentId).toBe(testSegmentId);
      expect(member.personaId).toBe(testPersonaId);
    });

    it('should list segment members', async () => {
      if (!testSegmentId) {
        console.warn('Skipping: No test segment');
        return;
      }

      const members = await db.getSegmentMembers(testSegmentId);

      expect(Array.isArray(members)).toBe(true);
    });

    it('should remove persona from segment', async () => {
      if (!testSegmentId || !testPersonaId) {
        console.warn('Skipping: Missing test data');
        return;
      }

      await db.removeSegmentMember(testSegmentId, testPersonaId);
      const members = await db.getSegmentMembers(testSegmentId);
      
      const stillMember = members.some(m => m.personaId === testPersonaId);
      expect(stillMember).toBe(false);
    });
  });
});

// ============================================================================
// FRANCHISE/TENANT HIERARCHY TESTS
// ============================================================================

describe('CRM Franchise/Tenant Hierarchy', () => {
  describe('List Franchises', () => {
    it('should list all franchises', async () => {
      const franchises = await crmService.listFranchises();

      expect(Array.isArray(franchises)).toBe(true);
    });

    it('should filter active franchises only', async () => {
      const franchises = await crmService.listFranchises({ activeOnly: true });

      franchises.forEach(f => {
        expect(f.isActive).toBe(true);
      });
    });
  });

  describe('List Tenants', () => {
    it('should list tenants for a franchise', async () => {
      const franchises = await crmService.listFranchises({ activeOnly: true });
      
      if (franchises.length > 0) {
        const tenants = await crmService.listTenants(franchises[0].id);
        
        expect(Array.isArray(tenants)).toBe(true);
        tenants.forEach(t => {
          expect(t.franchiseId).toBe(franchises[0].id);
        });
      }
    });
  });
});

// ============================================================================
// UNIFIED PROFILE TESTS
// ============================================================================

describe('CRM Unified Profile', () => {
  it('should build unified profile for a persona', async () => {
    // First create a persona with some activity
    const persona = await crmService.createPersona({
      tenantId: TEST_TENANT_ID,
      displayName: 'Profile Test User',
      email: `profile-${Date.now()}@example.com`,
      personaState: 'pseudonymous',
    });

    // Record some contributions
    await crmService.recordContribution({
      tenantId: TEST_TENANT_ID,
      personaId: persona.id,
      contributionType: 'article_created' as ContributionType,
      units: 2,
      source: 'test',
    });

    // Get unified profile
    const profile = await crmService.getUnifiedProfile(TEST_TENANT_ID, persona.id);

    expect(profile).toBeDefined();
    expect(profile.persona).toBeDefined();
    expect(profile.persona.id).toBe(persona.id);
    expect(profile.totalPokw).toBeGreaterThan(0);
    expect(profile.contributionCount).toBeGreaterThan(0);
  });
});

// ============================================================================
// ADMIN ROLE TESTS
// ============================================================================

describe('CRM Admin Role Access Control', () => {
  describe('Admin Categories', () => {
    it('should list admin categories', async () => {
      const categories = await db.listAdminCategories();

      expect(Array.isArray(categories)).toBe(true);
      // Should have default categories from migration
      expect(categories.length).toBeGreaterThan(0);
    });
  });

  describe('Admin Role Assignment', () => {
    it('should create an admin role', async () => {
      const role = await db.createAdminRole({
        kybeDid: `did:kybe:admin-test-${Date.now()}`,
        roleType: 'tenant_super_admin',
        tenantId: TEST_ADMIN_TENANT_UUID,
        permissions: {
          read: true,
          write: true,
          delete: false,
          manage_users: true,
        },
      });

      expect(role).toBeDefined();
      expect(role.id).toBeDefined();
      expect(role.roleType).toBe('tenant_super_admin');
      expect(role.isActive).toBe(true);
    });

    it('should list admin roles by scope', async () => {
      const roles = await db.getAdminRolesForScope({
        tenantId: TEST_ADMIN_TENANT_UUID,
      });

      expect(Array.isArray(roles)).toBe(true);
    });

    it('should check admin access', async () => {
      const kybeDid = `did:kybe:access-test-${Date.now()}`;
      
      // Create a role
      await db.createAdminRole({
        kybeDid,
        roleType: 'tenant_super_admin',
        tenantId: TEST_ADMIN_TENANT_UUID,
        permissions: { read: true, write: true },
      });

      // Check access
      const hasAccess = await db.checkAdminAccess({
        kybeDid,
        action: 'read',
        tenantId: TEST_ADMIN_TENANT_UUID,
      });

      expect(hasAccess).toBe(true);
    });

    it('should deny access for non-admin', async () => {
      const hasAccess = await db.checkAdminAccess({
        kybeDid: 'did:kybe:non-existent',
        action: 'write',
        tenantId: TEST_ADMIN_TENANT_UUID,
      });

      expect(hasAccess).toBe(false);
    });

    it('should check if user is uber admin', async () => {
      const isUber = await db.isUberAdmin('did:kybe:non-existent');
      expect(isUber).toBe(false);
    });

    it('should check if user has any admin role', async () => {
      const kybeDid = `did:kybe:any-role-test-${Date.now()}`;
      
      // Initially should have no roles
      let hasRole = await db.hasAnyAdminRole(kybeDid);
      expect(hasRole).toBe(false);

      // Create a role
      await db.createAdminRole({
        kybeDid,
        roleType: 'category_admin',
        categoryId: undefined, // Will need a real category ID in practice
        tenantId: TEST_ADMIN_TENANT_UUID,
        permissions: { read: true },
      });

      // Now should have a role
      hasRole = await db.hasAnyAdminRole(kybeDid);
      expect(hasRole).toBe(true);
    });
  });
});

// ============================================================================
// COPILOT HISTORY TESTS
// ============================================================================

describe('CRM Copilot History', () => {
  it('should log copilot interactions', async () => {
    const history = await db.createCopilotHistory({
      tenantId: TEST_TENANT_ID,
      queryText: 'List all personas',
      parsedIntent: 'list_personas',
      executedActions: ['listCrmPersonas'],
      resultSummary: 'Found 10 personas',
      resultCount: 10,
      executionTimeMs: 150,
      success: true,
    });

    expect(history).toBeDefined();
    expect(history.id).toBeDefined();
    expect(history.success).toBe(true);
  });

  it('should list copilot history for tenant', async () => {
    const history = await db.listCopilotHistory(TEST_TENANT_ID, { limit: 10 });

    expect(Array.isArray(history)).toBe(true);
  });
});

// ============================================================================
// CLEANUP
// ============================================================================

afterAll(async () => {
  // Note: In a real test environment, you would clean up test data here
  // For now, we leave test data for inspection
  console.log('CRM Integration Tests Complete');
  console.log(`Test Tenant: ${TEST_TENANT_ID}`);
});
