# LVB-AGQ Bridge API Contract

## Overview

The LVB-AGQ Bridge API provides a comprehensive interface for partner thin clients to interact with the AgentiQ Marketa platform. This contract defines all available endpoints, request/response formats, authentication requirements, and usage patterns.

**Base URL:** `http://localhost:3000/api/marketa/lvb/bridge`  
**Authentication:** Persona-based via headers  
**Content-Type:** `application/json`

---

## Authentication

### Required Headers

All API requests must include the following headers:

```http
x-persona-id: {persona_uuid}
x-tenant-id: {tenant_id}
Content-Type: application/json
```

### Persona Validation

The API validates that:
- The persona exists in the CRM system
- The persona belongs to the specified tenant
- The persona has appropriate permissions for the requested action

### Example Request

```bash
curl -H "x-persona-id: 123e4567-e89b-12d3-a456-426614174000" \
     -H "x-tenant-id: partner-123" \
     -H "Content-Type: application/json" \
     "http://localhost:3000/api/marketa/lvb/bridge?action=config"
```

---

## Response Format

### Standard Response Structure

```json
{
  "success": true|false,
  "data": {}, // Response data (varies by endpoint)
  "error": "Error message (if success=false)",
  "message": "Optional success/informational message"
}
```

### Error Response Format

```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": {} // Optional error details
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_PERSONA` | Persona not found or invalid |
| `ACCESS_DENIED` | Insufficient permissions |
| `CAMPAIGN_NOT_FOUND` | Campaign ID not found |
| `ALREADY_JOINED` | Already joined campaign |
| `WEBHOOK_FAILED` | Webhook test failed |
| `VALIDATION_ERROR` | Request validation failed |

---

## Endpoints

### 1. Configuration

#### `GET /api/marketa/lvb/bridge?action=config`

Retrieves tenant configuration and feature flags.

**Request Parameters:** None

**Response:**
```json
{
  "success": true,
  "config": {
    "tenant_id": "partner-123",
    "persona_id": "persona-456",
    "role": "partnerAdmin",
    "permissions": [
      "view_campaigns",
      "join_campaigns", 
      "manage_packs",
      "view_performance"
    ],
    "tenant_name": "Partner Company",
    "tenant_type": "partner",
    "feature_flags": {
      "custom_campaigns": true,
      "sequence_campaigns": true,
      "partner_rewards": true,
      "make_integration": true,
      "pack_approval": true
    },
    "make_config": {
      "enabled": true,
      "webhook_configured": true
    }
  }
}
```

---

### 2. Pack Management (WPP)

#### `GET /api/marketa/lvb/bridge?action=pack_queue`

Retrieves pack workflow queue for the tenant.

**Request Parameters:**
```json
{
  "status": "submitted|approved|rejected|published", // Optional, default: "submitted"
  "limit": 50, // Optional, default: 50
  "offset": 0  // Optional, default: 0
}
```

**Response:**
```json
{
  "success": true,
  "packs": [
    {
      "id": "workflow-uuid",
      "pack_id": "pack-123",
      "status": "submitted",
      "current_stage": "review",
      "created_at": "2025-01-20T10:00:00Z",
      "submitted_at": "2025-01-20T11:00:00Z",
      "pack_content": {
        "title": "Marketing Pack Title",
        "description": "Pack description",
        "assets": []
      },
      "review_feedback": []
    }
  ],
  "total": 1
}
```

#### `GET /api/marketa/lvb/bridge?action=pack_detail`

Retrieves detailed information about a specific pack.

**Request Parameters:**
```json
{
  "packId": "pack-123"
}
```

**Response:**
```json
{
  "success": true,
  "pack": {
    "id": "workflow-uuid",
    "pack_id": "pack-123",
    "status": "approved",
    "current_stage": "publishing",
    "pack_content": {},
    "created_by_persona": {
      "display_name": "John Doe",
      "email": "john@partner.com"
    },
    "reviewed_by_persona": {
      "display_name": "Jane Smith", 
      "email": "jane@agentiq.com"
    },
    "approved_at": "2025-01-20T12:00:00Z"
  }
}
```

#### `POST /api/marketa/lvb/bridge?action=approve_pack`

Approves or rejects a pack for publishing.

**Request Body:**
```json
{
  "packId": "pack-123",
  "approved": true // true for approve, false for reject
}
```

**Response:**
```json
{
  "success": true,
  "pack": {
    "id": "workflow-uuid",
    "status": "approved",
    "current_stage": "publishing"
  },
  "message": "Pack approved and ready for publishing"
}
```

#### `POST /api/marketa/lvb/bridge?action=request_pack_edits`

Submits edit requests for a pack.

**Request Body:**
```json
{
  "packId": "pack-123",
  "editRequests": [
    {
      "section": "title",
      "current_content": "Old Title",
      "requested_change": "New Title",
      "reason": "Better SEO optimization",
      "priority": "high"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "pack": {
    "id": "workflow-uuid",
    "status": "review",
    "current_stage": "creation"
  },
  "message": "Edit requests submitted. Pack returned to creation stage."
}
```

#### `GET /api/marketa/lvb/bridge?action=publish_status`

Retrieves publishing status for a pack.

**Request Parameters:**
```json
{
  "packId": "pack-123"
}
```

**Response:**
```json
{
  "success": true,
  "pack": {
    "status": "published",
    "published_at": "2025-01-20T13:00:00Z"
  },
  "delivery_logs": [
    {
      "status": "delivered",
      "platform": "linkedin",
      "published_at": "2025-01-20T13:05:00Z"
    }
  ],
  "is_published": true,
  "publish_date": "2025-01-20T13:00:00Z"
}
```

---

### 3. Campaign Management

#### `GET /api/marketa/lvb/bridge?action=campaign_catalog`

Retrieves available and joined campaigns.

**Request Parameters:**
```json
{
  "includeJoined": true, // Optional, default: true
  "includeAvailable": true, // Optional, default: true
  "campaignType": "sequence" // Optional: "wpp", "custom", "sequence"
}
```

**Response:**
```json
{
  "success": true,
  "available_campaigns": [
    {
      "id": "campaign-uuid",
      "name": "21 Awakenings",
      "description": "21-day consciousness journey",
      "campaign_type": "sequence",
      "status": "active",
      "sequence_length": 21,
      "helix_thread": "mythos",
      "marketa_multi_tenant_campaigns": {
        "participating_tenants": ["partner-123"],
        "deployment_status": "deployed"
      }
    }
  ],
  "joined_campaigns": [
    {
      "id": "config-uuid",
      "campaign_id": "campaign-uuid",
      "tenant_id": "partner-123",
      "status": "active",
      "current_day": 5,
      "start_date": "2025-01-15",
      "time_of_day": "09:00",
      "channels": ["linkedin", "x"],
      "publishing_mode": "make",
      "marketa_campaigns": {
        "id": "campaign-uuid",
        "name": "21 Awakenings",
        "campaign_type": "sequence",
        "sequence_length": 21
      }
    }
  ],
  "total_available": 1,
  "total_joined": 1
}
```

#### `GET /api/marketa/lvb/bridge?action=campaign_detail`

Retrieves detailed campaign information.

**Request Parameters:**
```json
{
  "campaignId": "campaign-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "campaign": {
    "id": "campaign-uuid",
    "name": "21 Awakenings",
    "description": "21-day consciousness journey",
    "campaign_type": "sequence",
    "status": "active",
    "sequence_length": 21,
    "primary_cta": "Begin Your Awakening",
    "secondary_cta": "Share Your Journey",
    "marketa_sequence_items": [
      {
        "day_number": 1,
        "title": "Day 1: The Awakening",
        "asset_ref": "metaknyts_scroll_1_1",
        "cta_url": "https://qriptopian.app/engage?...",
        "explainer": true,
        "status": "ready"
      }
    ],
    "marketa_partner_rewards": [
      {
        "reward_type": "access",
        "reward_value": "Premium Content Access",
        "active": true
      }
    ],
    "marketa_tenant_campaign_configs": [
      {
        "tenant_id": "partner-123",
        "status": "active",
        "current_day": 5,
        "start_date": "2025-01-15",
        "time_of_day": "09:00",
        "channels": ["linkedin", "x"],
        "publishing_mode": "make",
        "joined_at": "2025-01-15T08:00:00Z"
      }
    ]
  }
}
```

#### `POST /api/marketa/lvb/bridge?action=join_campaign`

Joins a campaign with specified configuration.

**Request Body:**
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

**Response:**
```json
{
  "success": true,
  "config": {
    "id": "config-uuid",
    "campaign_id": "campaign-uuid",
    "tenant_id": "partner-123",
    "status": "joined",
    "start_date": "2025-01-20",
    "time_of_day": "09:00",
    "channels": ["linkedin", "x", "newsletter"],
    "publishing_mode": "make"
  },
  "message": "Successfully joined campaign"
}
```

#### `POST /api/marketa/lvb/bridge?action=propose_campaign`

Proposes a new custom campaign for AGQ approval.

**Request Body:**
```json
{
  "campaign": {
    "name": "Partner Custom Campaign",
    "description": "Campaign description",
    "primaryCta": "Join Now",
    "secondaryCta": "Learn More",
    "metadata": {
      "target_audience": "tech professionals",
      "estimated_budget": 50000,
      "duration_weeks": 4
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "campaign": {
    "id": "campaign-uuid",
    "name": "Partner Custom Campaign",
    "campaign_type": "custom",
    "status": "draft",
    "created_by_persona_id": "persona-456"
  },
  "message": "Campaign proposed and awaiting approval"
}
```

#### `GET /api/marketa/lvb/bridge?action=campaign_status`

Retrieves current status and progress for a joined campaign.

**Request Parameters:**
```json
{
  "campaignId": "campaign-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "config": {
    "id": "config-uuid",
    "status": "active",
    "current_day": 5,
    "start_date": "2025-01-15",
    "marketa_campaigns": {
      "name": "21 Awakenings",
      "campaign_type": "sequence",
      "sequence_length": 21
    }
  },
  "recent_delivery_logs": [
    {
      "status": "delivered",
      "platform": "linkedin",
      "sequence_day": 5,
      "published_at": "2025-01-20T09:05:00Z"
    }
  ],
  "is_active": true,
  "progress_percentage": 23.8
}
```

---

### 4. Partner Settings

#### `POST /api/marketa/lvb/bridge?action=webhook_test`

Tests Make.com webhook configuration.

**Request Body:**
```json
{
  "makeWebhookUrl": "https://hook.make.com/your-webhook",
  "makeWebhookSecret": "your-secret-key"
}
```

**Response:**
```json
{
  "success": true,
  "test_result": {
    "status": "success",
    "response_code": 200,
    "response_time_ms": 245,
    "error_message": null
  },
  "message": "Webhook test successful"
}
```

#### `GET /api/marketa/lvb/bridge?action=make_setup_guide`

Retrieves comprehensive Make.com integration guide.

**Request Parameters:** None

**Response:**
```json
{
  "success": true,
  "guide": {
    "title": "Make Integration Setup Guide",
    "description": "Follow these steps to integrate your Make.com scenario",
    "steps": [
      {
        "step": 1,
        "title": "Create Your Make Scenario",
        "description": "Build a scenario in Make.com...",
        "details": [
          "Add a Webhook trigger module",
          "Set it to accept POST requests",
          "Configure your social media actions"
        ]
      }
    ],
    "webhook_payload_example": {
      "campaign_id": "campaign-uuid",
      "sequence_item": {
        "day_number": 1,
        "title": "Daily Content Title",
        "asset_ref": "content-asset-reference",
        "copy_variants": {
          "linkedin": "LinkedIn-specific copy",
          "x": "X/Twitter copy (280 chars)",
          "discord": "Discord-specific copy"
        },
        "cta_url": "https://example.com/cta?utm_source=partner&...",
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
      }
    },
    "troubleshooting": [
      {
        "issue": "Webhook not receiving data",
        "solution": "Verify your Make scenario is active..."
      }
    ],
    "support": {
      "documentation": "/docs/marketa/make-integration-guide",
      "contact": "support@agentiq.com",
      "community": "https://community.agentiq.com"
    }
  }
}
```

---

### 5. Reporting

#### `GET /api/marketa/lvb/bridge?action=tenant_performance`

Retrieves performance metrics for the tenant.

**Request Parameters:**
```json
{
  "dateRange": { // Optional
    "start": "2025-01-01",
    "end": "2025-01-31"
  },
  "campaignIds": ["campaign-uuid-1", "campaign-uuid-2"] // Optional
}
```

**Response:**
```json
{
  "success": true,
  "metrics": [
    {
      "id": "metrics-uuid",
      "campaign_id": "campaign-uuid",
      "sent": 1000,
      "delivered": 950,
      "opened": 400,
      "clicked": 80,
      "conversions": 20,
      "revenue": 5000,
      "marketa_campaigns": {
        "name": "21 Awakenings",
        "campaign_type": "sequence",
        "status": "active"
      }
    }
  ],
  "aggregates": {
    "total_sent": 1000,
    "total_delivered": 950,
    "total_opened": 400,
    "total_clicked": 80,
    "total_conversions": 20,
    "total_revenue": 5000
  },
  "rates": {
    "delivery_rate": 95.0,
    "open_rate": 42.1,
    "click_rate": 20.0,
    "conversion_rate": 25.0
  },
  "summary": {
    "total_campaigns": 1,
    "active_campaigns": 1,
    "total_revenue": 5000,
    "avg_conversion_rate": 25.0
  }
}
```

#### `GET /api/marketa/lvb/bridge?action=campaign_performance`

Retrieves detailed performance for a specific campaign.

**Request Parameters:**
```json
{
  "campaignId": "campaign-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "metrics": {
    "id": "metrics-uuid",
    "campaign_id": "campaign-uuid",
    "sent": 1000,
    "delivered": 950,
    "opened": 400,
    "clicked": 80,
    "conversions": 20,
    "revenue": 5000
  },
  "delivery_logs": [
    {
      "id": "log-uuid",
      "status": "delivered",
      "platform": "linkedin",
      "sequence_day": 5,
      "published_at": "2025-01-20T09:05:00Z"
    }
  ],
  "tenant_config": {
    "current_day": 5,
    "status": "active",
    "start_date": "2025-01-15"
  },
  "insights": {
    "performance_trend": "improving",
    "next_action": "continue_monitoring",
    "optimization_suggestions": [
      "Best posting time: 09:00 AM based on engagement data",
      "Top performing channel: LinkedIn",
      "Consider adding video content for higher engagement"
    ]
  }
}
```

---

## Webhook Integration

### Make.com Webhook Payload

When `publishing_mode` is set to `make`, the system sends daily payloads to the configured webhook URL.

#### Payload Structure

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

#### Headers

```http
Content-Type: application/json
User-Agent: AgentiQ-Marketa/1.0
X-Webhook-Signature: sha256=generated_hmac_signature
X-Correlation-ID: dispatch_1642678800000_abc123def
```

#### Signature Verification

```javascript
// Verify webhook signature in Make.com
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return `sha256=${expectedSignature}` === signature;
}

// Usage
const payload = requestBody; // Raw request body
const signature = headers['X-Webhook-Signature'];
const secret = 'your-webhook-secret';

const isValid = verifySignature(payload, signature, secret);
```

---

## Error Handling

### HTTP Status Codes

| Status | Description |
|--------|-------------|
| `200` | Success |
| `400` | Bad Request - Invalid parameters |
| `401` | Unauthorized - Missing headers |
| `403` | Forbidden - Invalid permissions |
| `404` | Not Found - Resource not found |
| `500` | Internal Server Error |

### Error Response Format

```json
{
  "success": false,
  "error": "Detailed error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "campaignId",
    "reason": "Campaign not found or access denied"
  }
}
```

### Common Error Scenarios

1. **Authentication Errors**
   ```json
   {
     "success": false,
     "error": "Missing persona identification headers",
     "code": "MISSING_HEADERS"
   }
   ```

2. **Permission Errors**
   ```json
   {
     "success": false,
     "error": "Access denied to this campaign",
     "code": "ACCESS_DENIED"
   }
   ```

3. **Validation Errors**
   ```json
   {
     "success": false,
     "error": "Campaign ID and channels are required",
     "code": "VALIDATION_ERROR",
     "details": {
       "missing_fields": ["campaignId", "channels"]
     }
   }
   ```

---

## Rate Limiting

### Limits

- **Standard Requests**: 100 requests per minute per tenant
- **Webhook Tests**: 10 requests per minute per tenant
- **Performance Reports**: 20 requests per minute per tenant

### Headers

Rate limit information is included in response headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642678800
```

### Exceeded Limits

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 100,
    "reset_time": "2025-01-20T10:00:00Z"
  }
}
```

---

## SDK Integration

### JavaScript/TypeScript Example

```typescript
class MarketaBridgeClient {
  private baseUrl: string;
  private personaId: string;
  private tenantId: string;

  constructor(baseUrl: string, personaId: string, tenantId: string) {
    this.baseUrl = baseUrl;
    this.personaId = personaId;
    this.tenantId = tenantId;
  }

  private async request(action: string, data?: any): Promise<any> {
    const url = `${this.baseUrl}?action=${action}`;
    const headers = {
      'x-persona-id': this.personaId,
      'x-tenant-id': this.tenantId,
      'Content-Type': 'application/json'
    };

    const response = await fetch(url, {
      method: data ? 'POST' : 'GET',
      headers,
      body: data ? JSON.stringify({ action, ...data }) : undefined
    });

    return response.json();
  }

  async getConfig() {
    return this.request('config');
  }

  async getCampaignCatalog(options?: {
    includeJoined?: boolean;
    includeAvailable?: boolean;
    campaignType?: string;
  }) {
    return this.request('campaign_catalog', options);
  }

  async joinCampaign(campaignData: {
    campaignId: string;
    channels: string[];
    startDate: string;
    timeOfDay?: string;
    publishingMode?: string;
    makeWebhookUrl?: string;
    makeWebhookSecret?: string;
  }) {
    return this.request('join_campaign', campaignData);
  }

  async testWebhook(webhookUrl: string, secret?: string) {
    return this.request('webhook_test', {
      makeWebhookUrl: webhookUrl,
      makeWebhookSecret: secret
    });
  }
}

// Usage
const client = new MarketaBridgeClient(
  'http://localhost:3000/api/marketa/lvb/bridge',
  'persona-uuid',
  'tenant-123'
);

const config = await client.getConfig();
const campaigns = await client.getCampaignCatalog();
```

---

## Testing

### Test Environment

- **Base URL**: `http://localhost:3000/api/marketa/lvb/bridge`
- **Test Persona**: Use development persona IDs
- **Test Tenant**: Use `demo-tenant` for testing

### Test Scripts

```bash
#!/bin/bash
# test_bridge_api.sh

BASE_URL="http://localhost:3000/api/marketa/lvb/bridge"
PERSONA_ID="test-persona"
TENANT_ID="demo-tenant"

# Test config
echo "Testing config..."
curl -H "x-persona-id: $PERSONA_ID" \
     -H "x-tenant-id: $TENANT_ID" \
     "$BASE_URL?action=config"

# Test campaign catalog
echo -e "\nTesting campaign catalog..."
curl -H "x-persona-id: $PERSONA_ID" \
     -H "x-tenant-id: $TENANT_ID" \
     "$BASE_URL?action=campaign_catalog"

# Test webhook
echo -e "\nTesting webhook..."
curl -X POST \
     -H "x-persona-id: $PERSONA_ID" \
     -H "x-tenant-id: $TENANT_ID" \
     -H "Content-Type: application/json" \
     -d '{
       "makeWebhookUrl": "https://httpbin.org/post",
       "makeWebhookSecret": "test-secret"
     }' \
     "$BASE_URL?action=webhook_test"
```

---

## Versioning

### API Versioning

The bridge API uses URL versioning:

- **Current Version**: v1 (implicit)
- **Future Versions**: `/api/marketa/lvb/bridge/v2/...`

### Backward Compatibility

- New fields are added without breaking existing clients
- Deprecated fields are removed after 6 months notice
- Breaking changes require version bump

### Version Headers

```http
API-Version: 1.0
Supported-Versions: 1.0
Deprecated-Versions: 
```

---

## Support

### Documentation

- **Partner Journey**: `/docs/marketa/partner-journey.md`
- **Technical Setup**: `/docs/marketa/technical-setup.md`
- **Make Integration**: `/docs/marketa/make-integration.md`

### Contact

- **Technical Support**: `support@agentiq.com`
- **API Issues**: `api-support@agentiq.com`
- **Documentation**: `docs@agentiq.com`

### Community

- **Developer Forum**: `https://community.agentiq.com`
- **Discord**: `https://discord.gg/agentiq`
- **GitHub Issues**: `https://github.com/agentiq/marketa/issues`

---

## Changelog

### v1.0.0 (2025-01-17)
- Initial release of LVB-AGQ Bridge API
- Support for WPP, custom campaigns, and sequence campaigns
- Make.com integration with webhook support
- Comprehensive performance analytics
- Multi-tenant campaign deployment

### Upcoming Features

- **v1.1.0**: Enhanced analytics with AI insights
- **v1.2.0**: Advanced scheduling and automation
- **v1.3.0**: Mobile app SDK integration
- **v2.0.0**: GraphQL API support
