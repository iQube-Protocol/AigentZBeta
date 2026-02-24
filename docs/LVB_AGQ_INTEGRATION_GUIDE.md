# LVB-AGQ Integration Guide
## Lovable Thin Client ↔ AgentiQ Comprehensive Platform

### Overview

This guide documents the integration between the Lovable (LVB) thin client and AgentiQ (AGQ) comprehensive platform, ensuring seamless multi-tenant marketing operations while maintaining architectural simplicity and data integrity.

### Architecture Principles

1. **AGQ as Source of Truth**: All comprehensive data, campaign definitions, and performance metrics are stored in AGQ
2. **LVB Simplicity**: LVB maintains a minimal UI with simplified data views
3. **Real-time Sync**: Data flows bidirectionally between LVB and AGQ in real-time
4. **Multi-Tenant Support**: Both systems support multi-tenant operations with proper isolation
5. **Progressive Enhancement**: LVB users can access advanced features in AGQ when needed

---

## 1. System Architecture

### Data Flow Diagram

```
┌─────────────────┐    API Bridge    ┌─────────────────┐
│   LVB Client    │ ◄──────────────► │   AGQ Platform  │
│  (Thin Client)  │                  │ (Source of Truth)│
└─────────────────┘                  └─────────────────┘
         │                                   │
         │ Performance Data                  │ Campaign Data
         ▼                                   ▼
┌─────────────────┐                  ┌─────────────────┐
│ Partner Actions │                  │ Multi-Tenant    │
│ - Quick Views  │                  │ - Deployment    │
│ - Simple Edits │                  │ - Aggregation   │
└─────────────────┘                  └─────────────────┘
```

### Key Components

#### LVB (Lovable) Components
- **Thin Header**: Minimal navigation
- **Minimal Dashboard**: Simplified campaign overview
- **Quick Campaigns**: Streamlined campaign creation
- **Bridge Client**: API client for AGQ communication

#### AGQ (AgentiQ) Components
- **Comprehensive Dashboard**: Full-featured interface
- **Multi-Tenant Engine**: Campaign deployment across partners
- **Performance Aggregation**: Data collection and analysis
- **Source of Truth**: Centralized data storage

---

## 2. API Endpoints

### LVB Bridge API (`/api/marketa/lvb/bridge`)

#### Configuration Endpoint
```http
GET /api/marketa/lvb/bridge?action=config
Headers: x-persona-id: {persona_id}
```

**Response:**
```json
{
  "success": true,
  "config": {
    "tenant_id": "tenant-123",
    "capabilities": {
      "multi_tenant": true,
      "create_campaigns": true,
      "view_analytics": true
    },
    "feature_flags": {
      "advanced_analytics": true,
      "real_time_sync": true
    }
  },
  "bridge_version": "1.0.0"
}
```

#### Campaigns Endpoint
```http
GET /api/marketa/lvb/bridge?action=campaigns
Headers: x-persona-id: {persona_id}
```

**Response:**
```json
{
  "success": true,
  "campaigns": [
    {
      "id": "campaign-123",
      "name": "Q1 Product Launch",
      "status": "active",
      "performance": {
        "sent": 1000,
        "delivered": 950,
        "conversion_rate": 0.08
      },
      "is_multi_tenant": true,
      "tenant_count": 4
    }
  ]
}
```

#### Performance Endpoint
```http
GET /api/marketa/lvb/bridge?action=performance
Headers: x-persona-id: {persona_id}
```

#### Partner Overview Endpoint
```http
GET /api/marketa/lvb/bridge?action=partner-overview
Headers: x-persona-id: {persona_id}
```

### Multi-Tenant Campaign API (`/api/marketa/campaigns/deploy`)

#### Create Multi-Tenant Campaign
```http
POST /api/marketa/campaigns/deploy
Headers: x-persona-id: {persona_id}
Content-Type: application/json

{
  "campaign_id": "campaign-123",
  "campaign": {
    "name": "Multi-Tenant Campaign",
    "phase": "codex1",
    "budget": 50000,
    "primary_cta": "Join Now"
  },
  "deployment_config": {
    "participating_tenants": ["tenant-1", "tenant-2", "tenant-3"],
    "deployment_strategy": "parallel"
  }
}
```

#### Get Multi-Tenant Performance
```http
GET /api/marketa/campaigns/deploy?campaign_id={campaign_id}
Headers: x-persona-id: {persona_id}
```

### Performance Aggregation API (`/api/marketa/performance/aggregate`)

#### Submit Performance Data
```http
POST /api/marketa/performance/aggregate
Headers: x-persona-id: {persona_id}
Content-Type: application/json

{
  "campaign_id": "campaign-123",
  "tenant_id": "tenant-1",
  "performance_data": {
    "sent": 1000,
    "delivered": 950,
    "opened": 400,
    "clicked": 80,
    "conversions": 20,
    "revenue": 5000
  },
  "metadata": {
    "platform": "email",
    "lvb_version": "1.0.0"
  }
}
```

#### Get Aggregated Performance
```http
GET /api/marketa/performance/aggregate?campaign_id={campaign_id}&aggregate=true
Headers: x-persona-id: {persona_id}
```

---

## 3. Database Schema

### Core Tables

#### `marketa_campaigns`
- Stores all campaign definitions (AGQ source of truth)
- Multi-tenant aware with tenant isolation
- Tracks campaign status, budget, and metadata

#### `marketa_campaign_metrics`
- Performance metrics per tenant per campaign
- Calculated rates (delivery, open, click, conversion)
- Real-time updates from LVB clients

#### `marketa_multi_tenant_campaigns`
- Tracks multi-tenant campaign deployments
- Manages participating tenants and deployment status
- Enables cross-tenant performance aggregation

#### `marketa_lvb_sync_tracking`
- Logs all data synchronization between LVB and AGQ
- Tracks sync status, errors, and timing
- Ensures data integrity and auditability

### Key Functions

#### `create_multi_tenant_deployment()`
- Creates multi-tenant campaign records
- Initializes metrics for all participating tenants
- Sets up deployment tracking

#### `get_multi_tenant_performance()`
- Aggregates performance across all tenants
- Calculates averages and totals
- Provides insights and comparisons

#### `track_lvb_sync()`
- Logs LVB to AGQ data synchronization
- Tracks sync success/failure
- Maintains audit trail

---

## 4. Integration Patterns

### 4.1 LVB to AGQ Data Flow

#### Campaign Creation
1. LVB creates simplified campaign data
2. Bridge API sends data to AGQ
3. AGQ stores as source of truth
4. Sync tracking logged

```typescript
// LVB Client Example
const lvbCampaign = {
  name: 'Quick Campaign',
  budget: 10000,
  target_audience: 'general'
};

const response = await fetch('/api/marketa/lvb/bridge', {
  method: 'POST',
  headers: {
    'x-persona-id': personaId,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'sync-campaign',
    data: { campaign: lvbCampaign, lvb_metadata }
  })
});
```

#### Performance Updates
1. LVB collects performance data
2. Bridge API sends metrics to AGQ
3. AGQ updates source of truth
4. Aggregation recalculated

```typescript
// LVB Performance Sync
const performanceData = {
  campaign_id: 'campaign-123',
  performance_data: {
    sent: 1000,
    conversions: 50,
    revenue: 2500
  }
};

await fetch('/api/marketa/performance/aggregate', {
  method: 'POST',
  body: JSON.stringify(performanceData)
});
```

### 4.2 AGQ to LVB Data Flow

#### Configuration Updates
1. AGQ updates tenant configuration
2. Bridge API provides updated config to LVB
3. LVB adjusts UI and capabilities

#### Multi-Tenant Deployment
1. AGQ creates multi-tenant campaign
2. Deployment status sent to LVB
3. LVB shows simplified deployment view

---

## 5. Multi-Tenant Operations

### 5.1 Campaign Deployment

#### From AGQ (Owner Tenant)
```typescript
const deployment = await fetch('/api/marketa/campaigns/deploy', {
  method: 'POST',
  body: JSON.stringify({
    campaign_id: 'campaign-123',
    campaign: campaignData,
    deployment_config: {
      participating_tenants: ['partner-1', 'partner-2'],
      deployment_strategy: 'parallel'
    }
  })
});
```

#### In LVB (Partner Tenant)
- Campaign appears automatically
- Simplified performance view
- No deployment capabilities (read-only)

### 5.2 Performance Aggregation

#### Real-time Collection
- Each tenant submits performance data
- AGQ aggregates across all tenants
- Insights calculated and distributed

#### Cross-Tenant Analytics
```json
{
  "total_metrics": {
    "total_sent": 10000,
    "total_conversions": 500,
    "total_revenue": 25000,
    "avg_conversion_rate": 0.05
  },
  "tenant_breakdown": [
    {
      "tenant_id": "partner-1",
      "contribution_percentage": 35.2,
      "conversion_rate": 0.06
    }
  ],
  "insights": {
    "top_performing_tenant": "partner-1",
    "best_conversion_rate": 0.06
  }
}
```

---

## 6. Error Handling and Recovery

### 6.1 Sync Failures

#### Detection
- LVB sync tracking monitors failures
- Automatic retry for transient errors
- Alert on persistent failures

#### Recovery
- Manual sync trigger available
- Data validation and repair tools
- Rollback capabilities for corrupted data

### 6.2 Conflict Resolution

#### Data Conflicts
- AGQ always wins as source of truth
- LVB data marked as stale during conflicts
- Automatic resync from AGQ

#### Tenant Conflicts
- Strict tenant isolation prevents conflicts
- Role-based access control
- Audit trail for all changes

---

## 7. Security Considerations

### 7.1 Authentication
- Persona-based authentication
- Tenant context validation
- API key management

### 7.2 Authorization
- Role-based permissions (admin, partner, viewer)
- Tenant-scoped data access
- Multi-tenant deployment restrictions

### 7.3 Data Privacy
- Row-level security (RLS) enabled
- Tenant data isolation
- Audit logging for compliance

---

## 8. Performance Optimization

### 8.1 Caching Strategy
- LVB client-side caching for static data
- AGQ server-side caching for aggregations
- Cache invalidation on data updates

### 8.2 Database Optimization
- Indexed queries for performance
- Materialized views for complex aggregations
- Partitioned tables for large datasets

### 8.3 API Optimization
- Batch operations for bulk updates
- Compression for large payloads
- Rate limiting for API calls

---

## 9. Monitoring and Observability

### 9.1 Key Metrics
- Sync success rate
- API response times
- Data freshness indicators
- Error rates by tenant

### 9.2 Alerting
- Sync failure alerts
- Performance degradation alerts
- Data inconsistency alerts
- Security violation alerts

### 9.3 Logging
- Structured logging for all operations
- Correlation IDs for request tracking
- Log aggregation and analysis

---

## 10. Testing Strategy

### 10.1 Unit Tests
- API endpoint validation
- Database function testing
- Business logic verification

### 10.2 Integration Tests
- LVB-AGQ data flow testing
- Multi-tenant scenario testing
- Performance aggregation testing

### 10.3 End-to-End Tests
- Full campaign lifecycle testing
- Cross-tenant performance testing
- Error recovery testing

---

## 11. Deployment and Operations

### 11.1 Environment Configuration
```bash
# LVB Configuration
NEXT_PUBLIC_LVB_BRIDGE_URL=https://agq-domain.com/api/marketa/lvb/bridge
LVB_SYNC_FREQUENCY=real-time
LVB_CLIENT_VERSION=1.0.0

# AGQ Configuration
SUPABASE_SERVICE_ROLE_KEY=your-service-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
MULTI_TENANT_ENABLED=true
```

### 11.2 Migration Process
1. Database schema updates
2. API endpoint deployment
3. LVB client configuration update
4. Data validation and testing

### 11.3 Rollback Procedures
- Database rollback scripts
- API versioning for rollback
- LVB client fallback configuration

---

## 12. Troubleshooting Guide

### Common Issues

#### LVB Cannot Connect to AGQ
- Check API endpoint configuration
- Verify authentication tokens
- Check network connectivity

#### Performance Data Not Syncing
- Review sync tracking logs
- Check tenant permissions
- Validate data format

#### Multi-Tenant Deployment Fails
- Verify tenant existence
- Check deployment permissions
- Review campaign configuration

### Debug Tools
- Sync tracking dashboard
- API request/response logging
- Database query analysis
- Performance monitoring tools

---

## 13. Future Enhancements

### Planned Features
- Real-time websocket connections
- Advanced analytics in LVB
- Cross-tenant A/B testing
- Automated optimization suggestions

### Scalability Improvements
- Horizontal scaling for API endpoints
- Database sharding for large datasets
- Edge caching for global deployment
- Load balancing for high traffic

---

## 14. Support and Contact

### Documentation
- API reference documentation
- Database schema documentation
- Integration guides and tutorials

### Support Channels
- Technical support team
- Community forums
- Issue tracking system
- Knowledge base articles

---

*This integration guide ensures that LVB remains a simple, lightweight client while leveraging AGQ's comprehensive capabilities as the source of truth for all marketing operations across multi-tenant environments.*
