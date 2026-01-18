# AgentiQ Marketa Partner Journey Guide

## Overview

This document outlines the complete partner journey in the AgentiQ Marketa platform, from onboarding to active campaign participation and performance optimization. The guide covers the LVB thin client experience, admin workflows, and technical integration points.

## Table of Contents

1. [Partner Onboarding](#partner-onboarding)
2. [LVB Thin Client Experience](#lvb-thin-client-experience)
3. [Campaign Participation](#campaign-participation)
4. [Make.com Integration](#makecom-integration)
5. [Performance Monitoring](#performance-monitoring)
6. [Admin Operations](#admin-operations)
7. [Technical Workflows](#technical-workflows)
8. [Troubleshooting](#troubleshooting)

---

## Partner Onboarding

### 1. Initial Setup

**Prerequisites:**
- Valid tenant account in AgentiQ CRM
- Persona with `partnerAdmin` role
- Basic social media accounts for content publishing

**Onboarding Steps:**

1. **Tenant Creation** (by AGQ Admin)
   ```sql
   INSERT INTO crm_tenants (id, name, type, status) 
   VALUES ('partner-123', 'Partner Company Name', 'partner', 'active');
   ```

2. **Persona Setup**
   - Create partner admin persona
   - Link to tenant
   - Assign appropriate permissions

3. **Initial Configuration**
   - Set tenant preferences
   - Configure default channels
   - Set up notification preferences

### 2. LVB Access Configuration

**Bridge API Configuration:**
```bash
# Test partner access
curl -H "x-persona-id: {persona_id}" \
     -H "x-tenant-id: {tenant_id}" \
     "http://localhost:3000/api/marketa/lvb/bridge?action=config"
```

**Expected Response:**
```json
{
  "success": true,
  "config": {
    "tenant_id": "partner-123",
    "persona_id": "persona-456",
    "role": "partnerAdmin",
    "feature_flags": {
      "custom_campaigns": true,
      "sequence_campaigns": true,
      "partner_rewards": true,
      "make_integration": false
    }
  }
}
```

---

## LVB Thin Client Experience

### 1. Dashboard Overview

The LVB thin client provides a simplified interface focused on essential partner operations:

**Key Components:**
- **Campaign Queue**: Shows available and joined campaigns
- **Performance Summary**: Real-time metrics and insights
- **Quick Actions**: Join campaigns, approve packs, test webhooks
- **Settings**: Make integration, channel preferences

### 2. Navigation Structure

```
LVB Thin Client
├── Dashboard (Home)
│   ├── Campaign Overview
│   ├── Performance Metrics
│   └── Quick Actions
├── Campaigns
│   ├── Available Campaigns
│   ├── Active Campaigns
│   └── Campaign Details
├── Content
│   ├── Pack Queue
│   ├── Pack Review
│   └── Publishing Status
├── Analytics
│   ├── Performance Reports
│   ├── Engagement Metrics
│   └── Revenue Tracking
└── Settings
    ├── Make Integration
    ├── Channel Configuration
    └── Profile Management
```

### 3. User Experience Principles

**Simplicity First:**
- Minimal clicks to complete actions
- Clear visual hierarchy
- Progressive disclosure of complex features

**Real-Time Updates:**
- Live campaign status
- Instant performance updates
- Real-time notifications

**Mobile-First Design:**
- Responsive layout
- Touch-friendly interfaces
- Optimized for quick actions

---

## Campaign Participation

### 1. Campaign Discovery

**Browse Available Campaigns:**
```bash
curl -H "x-persona-id: {persona_id}" \
     -H "x-tenant-id: {tenant_id}" \
     "http://localhost:3000/api/marketa/lvb/bridge?action=campaign_catalog"
```

**Campaign Types:**
- **WPP (White Paper Partner)**: Traditional content packs
- **Custom Campaigns**: Partner-specific initiatives
- **Sequence Campaigns**: Multi-day content series (e.g., 21 Awakenings)

### 2. Joining a Campaign

**Step-by-Step Process:**

1. **Review Campaign Details**
   ```bash
   curl -H "x-persona-id: {persona_id}" \
        -H "x-tenant-id: {tenant_id}" \
        "http://localhost:3000/api/marketa/lvb/bridge?action=campaign_detail&id={campaign_id}"
   ```

2. **Configure Participation**
   ```json
   {
     "campaignId": "campaign-uuid",
     "channels": ["linkedin", "x", "newsletter"],
     "startDate": "2025-01-20",
     "timeOfDay": "09:00",
     "publishingMode": "make",
     "makeWebhookUrl": "https://hook.make.com/your-webhook",
     "makeWebhookSecret": "your-secret-key"
   }
   ```

3. **Submit Join Request**
   ```bash
   curl -X POST \
        -H "x-persona-id: {persona_id}" \
        -H "x-tenant-id: {tenant_id}" \
        -H "Content-Type: application/json" \
        -d @join_request.json \
        "http://localhost:3000/api/marketa/lvb/bridge?action=join_campaign"
   ```

### 3. Campaign Management

**Monitor Progress:**
```bash
curl -H "x-persona-id: {persona_id}" \
     -H "x-tenant-id: {tenant_id}" \
     "http://localhost:3000/api/marketa/lvb/bridge?action=campaign_status&id={campaign_id}"
```

**Update Configuration:**
- Pause/resume participation
- Modify publishing schedule
- Update channel preferences
- Change webhook settings

---

## Make.com Integration

### 1. Setup Process

**Step 1: Create Make Scenario**
1. Log into Make.com
2. Create new scenario
3. Add "Webhooks" → "Custom Webhook" trigger
4. Configure social media actions (LinkedIn, X, etc.)
5. Test scenario

**Step 2: Configure Webhook**
```bash
# Test webhook configuration
curl -X POST \
     -H "x-persona-id: {persona_id}" \
     -H "x-tenant-id: {tenant_id}" \
     -H "Content-Type: application/json" \
     -d '{
       "makeWebhookUrl": "https://hook.make.com/your-webhook",
       "makeWebhookSecret": "your-secret-key"
     }' \
     "http://localhost:3000/api/marketa/lvb/bridge?action=webhook_test"
```

**Step 3: Validate Integration**
- Check webhook test results
- Verify payload structure
- Test end-to-end flow

### 2. Webhook Payload Structure

**Standard Payload:**
```json
{
  "campaign_id": "campaign-uuid",
  "sequence_item": {
    "day_number": 1,
    "title": "Daily Content Title",
    "description": "Content description",
    "asset_ref": "content-asset-reference",
    "copy_variants": {
      "linkedin": "LinkedIn-specific copy with professional tone",
      "x": "X/Twitter copy under 280 characters",
      "discord": "Discord-specific copy with emojis",
      "newsletter": "Email newsletter format"
    },
    "cta_url": "https://qriptopian.app/engage?utm_source=partner&utm_medium=social&utm_campaign=campaign-name&utm_content=day_1&utm_term=tenant-123",
    "explainer": false
  },
  "tenant_config": {
    "channels": ["linkedin", "x"],
    "utm_parameters": {
      "utm_source": "partner",
      "utm_medium": "social",
      "utm_campaign": "campaign-name",
      "utm_content": "day_1",
      "utm_term": "tenant-123"
    }
  },
  "correlation_id": "dispatch_1642678800000_abc123def",
  "dispatch_timestamp": "2025-01-20T09:00:00.000Z"
}
```

### 3. Security Features

**HMAC Signature Verification:**
```javascript
// In Make.com, verify webhook signature
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return signature === expectedSignature;
}
```

**Best Practices:**
- Always verify webhook signatures
- Check correlation IDs for deduplication
- Implement retry logic for failed deliveries
- Log all webhook activities

---

## Performance Monitoring

### 1. Real-Time Metrics

**Tenant Performance Overview:**
```bash
curl -H "x-persona-id: {persona_id}" \
     -H "x-tenant-id: {tenant_id}" \
     "http://localhost:3000/api/marketa/lvb/bridge?action=tenant_performance"
```

**Key Metrics:**
- **Delivery Metrics**: Sent, delivered, bounce rates
- **Engagement Metrics**: Opens, clicks, shares
- **Conversion Metrics**: Conversions, revenue, ROI
- **Platform Performance**: Best times, top channels

### 2. Campaign-Specific Analytics

**Detailed Campaign Performance:**
```bash
curl -H "x-persona-id: {persona_id}" \
     -H "x-tenant-id: {tenant_id}" \
     "http://localhost:3000/api/marketa/lvb/bridge?action=campaign_performance&id={campaign_id}"
```

**Performance Insights:**
- Trend analysis
- Optimization suggestions
- Channel comparison
- Audience behavior patterns

### 3. Reporting Features

**Automated Reports:**
- Daily performance summaries
- Weekly trend analysis
- Monthly comprehensive reports
- Custom date range reports

**Export Options:**
- CSV downloads
- PDF reports
- API data access
- Dashboard sharing

---

## Admin Operations

### 1. Campaign Creation

**Create Custom Campaign:**
```bash
curl -X POST \
     -H "x-persona-id: {admin_persona_id}" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "create_campaign",
       "campaign": {
         "name": "Partner Custom Campaign",
         "description": "Campaign description",
         "campaign_type": "custom",
         "primary_cta": "Join Now",
         "secondary_cta": "Learn More"
       }
     }' \
     "http://localhost:3000/api/marketa/admin/campaigns"
```

**Create Sequence Campaign:**
```bash
curl -X POST \
     -H "x-persona-id: {admin_persona_id}" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "create_campaign",
       "campaign": {
         "name": "21 Awakenings",
         "description": "21-day consciousness journey",
         "campaign_type": "sequence",
         "sequence_length": 21,
         "helix_thread": "mythos"
       },
       "sequence_items": [
         {
           "day_number": 1,
           "title": "Day 1: The Awakening",
           "asset_ref": "metaknyts_scroll_1_1",
           "explainer": true
         }
       ]
     }' \
     "http://localhost:3000/api/marketa/admin/campaigns"
```

### 2. Multi-Tenant Deployment

**Deploy to Partners:**
```bash
curl -X POST \
     -H "x-persona-id: {admin_persona_id}" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "deploy_multi_tenant",
       "deployment": {
         "campaign_id": "campaign-uuid",
         "participating_tenants": ["tenant-1", "tenant-2", "tenant-3"],
         "deployment_config": {
           "auto_join": true,
           "default_channels": ["linkedin", "x"],
           "default_time_of_day": "09:00",
           "default_publishing_mode": "manual"
         }
       }
     }' \
     "http://localhost:3000/api/marketa/admin/campaigns"
```

### 3. Partner Management

**Tenant Administration:**
- Create and manage tenant accounts
- Assign personas and permissions
- Configure tenant settings
- Monitor partner activity

**Support Operations:**
- Troubleshoot partner issues
- Review webhook test results
- Analyze performance problems
- Provide technical guidance

---

## Technical Workflows

### 1. Sequence Campaign Dispatch

**Automated Scheduler:**
```bash
# Trigger sequence dispatch (called by cron job)
curl -X POST \
     -H "Authorization: Bearer {dispatch_secret}" \
     "http://localhost:3000/api/marketa/sequence/dispatch"
```

**Dispatch Process:**
1. Identify active sequence campaigns
2. Calculate next dispatch items
3. Build platform-specific payloads
4. Send to Make webhooks or mark as manual
5. Log delivery attempts
6. Update tenant progress
7. Handle failures and retries

### 2. Content Asset Management

**Asset Reference System:**
```javascript
// Asset reference format
const assetRef = {
  type: "video",
  source: "qubebase",
  id: "metaknyts_scroll_1_1",
  url: "https://qubebase.app/assets/metaknyts_scroll_1_1",
  thumbnail: "https://qubebase.app/thumbnails/metaknyts_scroll_1_1.jpg",
  duration: 300,
  metadata: {
    theme: "awakening",
    difficulty: "beginner",
    tags: ["meditation", "consciousness"]
  }
};
```

**Content Sourcing:**
- QubeBase content repository
- Qriptopian web app assets
- Partner-specific content
- User-generated content

### 3. UTM Parameter Management

**UTM Structure:**
```
utm_source=partner
utm_medium=social
utm_campaign={campaign_name}
utm_content=day_{day_number}
utm_term={tenant_id}
```

**Tracking Implementation:**
- Automatic UTM generation
- Cross-platform consistency
- Performance attribution
- Revenue tracking

---

## Troubleshooting

### 1. Common Issues

**Webhook Failures:**
- Check Make scenario status
- Verify webhook URL accessibility
- Confirm signature verification
- Review payload format

**Campaign Sync Issues:**
- Validate persona permissions
- Check tenant configuration
- Review RLS policies
- Verify correlation IDs

**Performance Discrepancies:**
- Check data aggregation timing
- Verify UTM parameters
- Review attribution windows
- Validate tracking implementation

### 2. Debugging Tools

**API Testing:**
```bash
# Test bridge connectivity
curl -v "http://localhost:3000/api/marketa/lvb/bridge?action=config" \
     -H "x-persona-id: test-persona" \
     -H "x-tenant-id: test-tenant"
```

**Database Queries:**
```sql
-- Check tenant campaign configs
SELECT * FROM marketa_tenant_campaign_config 
WHERE tenant_id = 'your-tenant-id';

-- Review delivery logs
SELECT * FROM marketa_delivery_logs 
WHERE tenant_id = 'your-tenant-id' 
  AND created_at > NOW() - INTERVAL '1 day';

-- Verify sequence progress
SELECT tc.*, c.sequence_length 
FROM marketa_tenant_campaign_config tc
JOIN marketa_campaigns c ON tc.campaign_id = c.id
WHERE tc.tenant_id = 'your-tenant-id';
```

### 3. Support Procedures

**Escalation Path:**
1. Partner admin attempts self-service
2. Check documentation and FAQs
3. Contact AGQ support via bridge API
4. Technical team investigation
5. Resolution and follow-up

**Monitoring Alerts:**
- Webhook failure rates > 10%
- Campaign dispatch delays > 1 hour
- Performance drops > 20%
- Authentication failures

---

## Best Practices

### 1. Partner Success

**Onboarding Excellence:**
- Comprehensive setup guide
- Interactive webhook testing
- Progressive feature introduction
- Regular check-ins

**Performance Optimization:**
- Data-driven content scheduling
- Channel-specific optimization
- A/B testing methodologies
- Continuous improvement cycles

### 2. Technical Excellence

**API Design:**
- Consistent response formats
- Comprehensive error handling
- Detailed logging
- Version compatibility

**Security Practices:**
- HMAC signature verification
- Persona-based authorization
- Tenant isolation
- Audit logging

### 3. Operational Excellence

**Monitoring:**
- Real-time dashboards
- Automated alerting
- Performance baselines
- Capacity planning

**Maintenance:**
- Regular database optimization
- API performance monitoring
- Security audits
- Documentation updates

---

## Conclusion

The AgentiQ Marketa Partner Journey provides a comprehensive, scalable platform for partner marketing operations. By maintaining simplicity in the LVB thin client while providing powerful backend capabilities, the platform enables partners to participate effectively in multi-tenant campaigns while ensuring AGQ remains the source of truth.

The integration with Make.com, automated sequence dispatch, and comprehensive analytics create a robust ecosystem that scales from individual partners to enterprise-level operations while maintaining data integrity and performance optimization.

For technical support or questions about specific implementations, refer to the [API Documentation](./bridge-contract.md) or contact the AgentiQ engineering team.
