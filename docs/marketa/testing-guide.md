# AgentiQ Marketa Partner Platform - Testing Guide

## Overview

This guide provides comprehensive testing procedures for the AgentiQ Marketa Partner Platform, including automated tests, manual validation, and integration testing for the new partner platform features.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Test Environment Setup](#test-environment-setup)
3. [Automated Testing](#automated-testing)
4. [Manual Testing](#manual-testing)
5. [Integration Testing](#integration-testing)
6. [Performance Testing](#performance-testing)
7. [Database Validation](#database-validation)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Environment Requirements

- **Node.js**: Version 20.x or higher
- **Supabase**: Local development instance or remote project
- **Database**: PostgreSQL with migration `20250117_marketa_partner_platform.sql` applied
- **Environment Variables**: Properly configured `.env.local` file

### Required Environment Variables

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Test Configuration
SEQUENCE_DISPATCH_SECRET=test-dispatch-secret
NODE_ENV=development
```

### Test Data Setup

Ensure the following test data exists:
- Test tenant: `demo-tenant`
- Test personas: `test-persona-partner`, `test-persona-admin`
- 21 Awakenings campaign: `21-awakenings-campaign`

---

## Test Environment Setup

### 1. Database Setup

```bash
# Apply database migrations
supabase db push

# Verify tables exist
supabase db shell
\dt marketa.*
```

### 2. Development Server

```bash
# Start development server
npm run dev

# Verify server is running
curl http://localhost:3000/api/health
```

### 3. Test Persona Setup

```sql
-- Create test personas if they don't exist
INSERT INTO public.crm_personas (id, tenant_id, display_name, external_user_id, persona_state)
VALUES 
  ('test-persona-partner', 'demo-tenant', 'Test Partner', 'test-partner', 'identifiable'),
  ('test-persona-admin', 'agq-tenant', 'Test Admin', 'test-admin', 'identifiable')
ON CONFLICT (id) DO NOTHING;
```

---

## Automated Testing

### 1. Unit Tests with Vitest

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:ci

# Run specific test file
npm run test -- tests/partner-platform.test.ts
```

### 2. Test Suite Coverage

The automated test suite covers:

#### **LVB Bridge API Tests**
- ✅ Configuration retrieval
- ✅ Authentication validation
- ✅ Pack management operations
- ✅ Campaign catalog and details
- ✅ Campaign join flow
- ✅ Custom campaign proposals

#### **Make.com Integration Tests**
- ✅ Setup guide provision
- ✅ Webhook functionality testing
- ✅ Error handling for invalid URLs
- ✅ HMAC signature validation

#### **Performance Analytics Tests**
- ✅ Tenant performance metrics
- ✅ Campaign-specific analytics
- ✅ Performance aggregation
- ✅ Insights generation

#### **Admin Operations Tests**
- ✅ Campaign CRUD operations
- ✅ Multi-tenant deployment
- ✅ Sequence campaign creation
- ✅ Tenant management

#### **Sequence Dispatch Tests**
- ✅ Scheduler status checking
- ✅ Pending dispatch retrieval
- ✅ Automated dispatch simulation

#### **Error Handling Tests**
- ✅ Invalid request parameters
- ✅ Authentication failures
- ✅ Authorization violations
- ✅ Data validation

### 3. Running Specific Test Categories

```bash
# Test only LVB Bridge functionality
npm run test -- --testNamePattern="LVB Bridge"

# Test only Admin functionality
npm run test -- --testNamePattern="Admin"

# Test only Make integration
npm run test -- --testNamePattern="Make.com"
```

---

## Manual Testing

### 1. Shell Script Testing

```bash
# Run comprehensive manual test suite
./scripts/test-partner-platform.sh

# Run with custom configuration
BASE_URL=http://localhost:3000 ./scripts/test-partner-platform.sh
```

### 2. Manual Test Checklist

#### **Authentication & Authorization**
- [ ] Test with missing headers
- [ ] Test with invalid persona ID
- [ ] Test with wrong tenant ID
- [ ] Test admin-only endpoints with partner persona

#### **Campaign Management**
- [ ] Browse campaign catalog
- [ ] View 21 Awakenings details
- [ ] Join campaign with different configurations
- [ ] Check campaign status updates
- [ ] Propose custom campaign
- [ ] View joined campaigns

#### **Make.com Integration**
- [ ] Access setup guide
- [ ] Test webhook with httpbin.org
- [ ] Test webhook with invalid URL
- [ ] Verify HMAC signature generation
- [ ] Test webhook payload structure

#### **Performance Analytics**
- [ ] View tenant performance dashboard
- [ ] Check campaign-specific metrics
- [ ] Verify aggregation calculations
- [ ] Test performance insights generation

#### **Admin Operations**
- [ ] List all campaigns
- [ ] Create custom campaign
- [ ] Create sequence campaign with items
- [ ] Deploy to multiple tenants
- [ ] Manage partner rewards

### 3. API Testing with curl

#### **Configuration Test**
```bash
curl -H "x-persona-id: test-persona-partner" \
     -H "x-tenant-id: demo-tenant" \
     "http://localhost:3000/api/marketa/lvb/bridge?action=config"
```

#### **Campaign Join Test**
```bash
curl -X POST \
     -H "x-persona-id: test-persona-partner" \
     -H "x-tenant-id: demo-tenant" \
     -H "Content-Type: application/json" \
     -d '{
       "campaignId": "21-awakenings-campaign",
       "channels": ["linkedin", "x"],
       "startDate": "2025-01-20",
       "publishingMode": "manual"
     }' \
     "http://localhost:3000/api/marketa/lvb/bridge?action=join_campaign"
```

#### **Webhook Test**
```bash
curl -X POST \
     -H "x-persona-id: test-persona-partner" \
     -H "x-tenant-id: demo-tenant" \
     -H "Content-Type: application/json" \
     -d '{
       "makeWebhookUrl": "https://httpbin.org/post",
       "makeWebhookSecret": "test-secret"
     }' \
     "http://localhost:3000/api/marketa/lvb/bridge?action=webhook_test"
```

---

## Integration Testing

### 1. End-to-End Workflow Testing

#### **Complete Partner Journey**
1. **Partner Onboarding**
   ```bash
   # Test partner setup
   curl -H "x-persona-id: new-partner" \
        -H "x-tenant-id: new-tenant" \
        "http://localhost:3000/api/marketa/lvb/bridge?action=config"
   ```

2. **Campaign Discovery & Join**
   ```bash
   # Browse campaigns
   curl -H "x-persona-id: new-partner" \
        -H "x-tenant-id: new-tenant" \
        "http://localhost:3000/api/marketa/lvb/bridge?action=campaign_catalog"
   
   # Join 21 Awakenings
   curl -X POST \
        -H "x-persona-id: new-partner" \
        -H "x-tenant-id: new-tenant" \
        -H "Content-Type: application/json" \
        -d '{"campaignId": "21-awakenings-campaign", "channels": ["linkedin"]}' \
        "http://localhost:3000/api/marketa/lvb/bridge?action=join_campaign"
   ```

3. **Make.com Setup**
   ```bash
   # Get setup guide
   curl -H "x-persona-id: new-partner" \
        -H "x-tenant-id: new-tenant" \
        "http://localhost:3000/api/marketa/lvb/bridge?action=make_setup_guide"
   
   # Test webhook
   curl -X POST \
        -H "x-persona-id: new-partner" \
        -H "x-tenant-id: new-tenant" \
        -H "Content-Type: application/json" \
        -d '{"makeWebhookUrl": "https://your-make-webhook.com"}' \
        "http://localhost:3000/api/marketa/lvb/bridge?action=webhook_test"
   ```

4. **Performance Monitoring**
   ```bash
   # Check performance
   curl -H "x-persona-id: new-partner" \
        -H "x-tenant-id: new-tenant" \
        "http://localhost:3000/api/marketa/lvb/bridge?action=tenant_performance"
   ```

### 2. Multi-Tenant Testing

#### **Admin Creates Campaign**
```bash
curl -X POST \
     -H "x-persona-id: test-persona-admin" \
     -H "x-tenant-id: agq-tenant" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "create_campaign",
       "campaign": {
         "name": "Multi-Partner Test Campaign",
         "campaign_type": "custom",
         "primary_cta": "Join Now"
       }
     }' \
     "http://localhost:3000/api/marketa/admin/campaigns"
```

#### **Deploy to Multiple Tenants**
```bash
curl -X POST \
     -H "x-persona-id: test-persona-admin" \
     -H "x-tenant-id: agq-tenant" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "deploy_multi_tenant",
       "deployment": {
         "campaign_id": "new-campaign-id",
         "participating_tenants": ["demo-tenant", "partner-1", "partner-2"]
       }
     }' \
     "http://localhost:3000/api/marketa/admin/campaigns"
```

### 3. Sequence Campaign Testing

#### **Create Sequence Campaign**
```bash
curl -X POST \
     -H "x-persona-id: test-persona-admin" \
     -H "x-tenant-id: agq-tenant" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "create_campaign",
       "campaign": {
         "name": "Test Sequence Campaign",
         "campaign_type": "sequence",
         "sequence_length": 3
       },
       "sequence_items": [
         {"day_number": 1, "title": "Day 1", "asset_ref": "asset-1"},
         {"day_number": 2, "title": "Day 2", "asset_ref": "asset-2"},
         {"day_number": 3, "title": "Day 3", "asset_ref": "asset-3"}
       ]
     }' \
     "http://localhost:3000/api/marketa/admin/campaigns"
```

#### **Test Sequence Dispatch**
```bash
# Check pending dispatches
curl -H "Authorization: Bearer test-dispatch-secret" \
     "http://localhost:3000/api/marketa/sequence/dispatch?action=pending"

# Trigger dispatch (for testing)
curl -X POST \
     -H "Authorization: Bearer test-dispatch-secret" \
     "http://localhost:3000/api/marketa/sequence/dispatch"
```

---

## Performance Testing

### 1. Load Testing

#### **Concurrent User Simulation**
```bash
# Install artillery if needed
npm install -g artillery

# Run load test
artillery run load-test-config.yml
```

#### **Load Test Configuration** (`load-test-config.yml`)
```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 20
    - duration: 60
      arrivalRate: 5

scenarios:
  - name: "Partner Platform Load Test"
    weight: 70
    flow:
      - get:
          url: "/api/marketa/lvb/bridge?action=config"
          headers:
            x-persona-id: "test-persona-partner"
            x-tenant-id: "demo-tenant"
      - get:
          url: "/api/marketa/lvb/bridge?action=campaign_catalog"
          headers:
            x-persona-id: "test-persona-partner"
            x-tenant-id: "demo-tenant"
  
  - name: "Admin Operations Load Test"
    weight: 30
    flow:
      - get:
          url: "/api/marketa/admin/campaigns?action=list"
          headers:
            x-persona-id: "test-persona-admin"
            x-tenant-id: "agq-tenant"
```

### 2. Database Performance

#### **Query Performance Analysis**
```sql
-- Check slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
WHERE query LIKE '%marketa%'
ORDER BY mean_time DESC
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'marketa'
ORDER BY idx_scan DESC;
```

#### **Connection Pool Testing**
```bash
# Test database connection limits
pgbench -h localhost -U postgres -d postgres -c 20 -j 4 -t 100
```

---

## Database Validation

### 1. Schema Validation

```sql
-- Verify all new tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'marketa' 
  AND table_name IN (
    'marketa_sequence_items',
    'marketa_tenant_campaign_config', 
    'marketa_partner_rewards',
    'marketa_pack_workflows',
    'marketa_webhook_tests'
  );

-- Verify foreign key constraints
SELECT tc.table_name, tc.constraint_name, tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'marketa'
  AND tc.constraint_type = 'FOREIGN KEY';

-- Verify RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'marketa';
```

### 2. Data Integrity Checks

```sql
-- Check 21 Awakenings campaign
SELECT id, name, campaign_type, sequence_length, status
FROM marketa.marketa_campaigns
WHERE id = '21-awakenings-campaign';

-- Verify sequence items
SELECT campaign_id, day_number, title, status
FROM marketa.marketa_sequence_items
WHERE campaign_id = '21-awakenings-campaign'
ORDER BY day_number;

-- Check tenant configurations
SELECT campaign_id, tenant_id, status, current_day, channels
FROM marketa.marketa_tenant_campaign_config
WHERE campaign_id = '21-awakenings-campaign';
```

### 3. Performance Metrics Validation

```sql
-- Test performance aggregation function
SELECT * FROM marketa.get_multi_tenant_performance('demo-tenant');

-- Test sequence item retrieval
SELECT * FROM marketa.get_next_sequence_item('demo-tenant', '21-awakenings-campaign');

-- Check delivery logs
SELECT campaign_id, platform, status, published_at
FROM marketa.marketa_delivery_logs
WHERE tenant_id = 'demo-tenant'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Troubleshooting

### 1. Common Test Failures

#### **Authentication Issues**
```bash
# Error: "Missing persona identification headers"
# Solution: Ensure x-persona-id and x-tenant-id headers are present

# Error: "Persona not found"
# Solution: Verify persona exists in crm_personas table
```

#### **Database Connection Issues**
```bash
# Error: "Connection refused"
# Solution: Check Supabase local instance is running
supabase start

# Error: "Migration not applied"
# Solution: Apply database migration
supabase db push
```

#### **Make.com Integration Issues**
```bash
# Error: "Webhook test failed"
# Solution: Check webhook URL is accessible
curl -X POST https://your-webhook-url.com -d '{"test": "data"}'

# Error: "Invalid signature"
# Solution: Verify HMAC signature implementation
```

### 2. Performance Issues

#### **Slow API Responses**
```sql
-- Check for missing indexes
EXPLAIN ANALYZE SELECT * FROM marketa.marketa_campaigns WHERE campaign_type = 'sequence';

-- Add missing indexes if needed
CREATE INDEX CONCURRENTLY idx_campaigns_type_status 
ON marketa.marketa_campaigns(campaign_type, status);
```

#### **Memory Issues**
```bash
# Check Node.js memory usage
node --max-old-space-size=4096 server.js

# Monitor database connections
SELECT * FROM pg_stat_activity WHERE datname = 'your_database';
```

### 3. Debug Mode

#### **Enable Debug Logging**
```bash
# Set environment variables
export DEBUG=marketa:*
export NODE_ENV=development

# Run with verbose output
npm run dev -- --verbose
```

#### **Database Query Logging**
```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 100;
SELECT pg_reload_conf();
```

---

## Test Results Documentation

### 1. Test Report Template

```markdown
# Test Execution Report

**Date**: 2025-01-20
**Environment**: Development
**Test Suite**: Partner Platform v1.0.0

## Summary
- Total Tests: 45
- Passed: 43
- Failed: 2
- Skipped: 0
- Coverage: 87%

## Failed Tests
1. Test Name: Admin campaign creation with invalid data
   - Error: Validation failed
   - Status: Known issue, ticket #123

2. Test Name: Sequence dispatch with invalid tenant
   - Error: Tenant not found
   - Status: Expected behavior

## Performance Metrics
- Average API Response Time: 145ms
- Database Query Time: 23ms
- Memory Usage: 256MB

## Recommendations
1. Fix admin validation logic
2. Add more comprehensive error handling
3. Optimize database queries for large datasets
```

### 2. Continuous Integration

```yaml
# .github/workflows/test.yml
name: Partner Platform Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:ci
      - run: npm run lint:check
      - run: npm run type-check
```

---

## Conclusion

This comprehensive testing suite ensures the AgentiQ Marketa Partner Platform meets all requirements for:

- ✅ **Functionality**: All features work as specified
- ✅ **Performance**: Acceptable response times and scalability
- ✅ **Security**: Proper authentication and authorization
- ✅ **Reliability**: Error handling and recovery
- ✅ **Integration**: Seamless Make.com and third-party connections

Regular execution of these tests ensures platform stability and reliability as new features are added and existing functionality is enhanced.

For additional support or questions about testing, refer to the [API Documentation](./bridge-contract.md) or contact the development team.
