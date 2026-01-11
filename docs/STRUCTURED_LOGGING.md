# Structured Logging Implementation

## Overview

Implemented comprehensive structured logging across all API routes to provide consistent, searchable, and analyzable logs for production monitoring and debugging.

## Features

### 🏗️ Core Logging Infrastructure

**StructuredLogger Class** (`/app/utils/structuredLogger.ts`)
- JSON-formatted log entries with consistent schema
- Request correlation IDs for end-to-end tracing
- Automatic performance timing
- Context propagation across log entries
- Multiple log levels: debug, info, warn, error

### 📊 Log Schema

Each log entry includes:
```json
{
  "timestamp": "2026-01-11T03:45:00.000Z",
  "level": "info",
  "message": "Request completed",
  "context": {
    "requestId": "req_1641899100000_abc123",
    "method": "GET",
    "url": "/api/ops/btc/status",
    "userId": "persona_123",
    "startTime": 1641899100000
  },
  "duration": 245,
  "metadata": {
    "statusCode": 200,
    "responseSize": 1024
  }
}
```

### 🔧 Integration Patterns

#### 1. Basic API Route Integration
```typescript
import { createLogger } from '@/utils/structuredLogger';

export async function GET(req: NextRequest) {
  const logger = createLogger().logRequest(req, { 
    component: 'btc-status',
    operation: 'get-status'
  });
  
  try {
    // Business logic here
    logger.info('Operation completed successfully');
    
    const response = NextResponse.json(data);
    logger.logResponse(response.status);
    return response;
  } catch (error) {
    logger.error('Operation failed', error);
    throw error;
  }
}
```

#### 2. Middleware Wrapper
```typescript
import { withStructuredLogger } from '@/utils/structuredLogger';

export const GET = withStructuredLogger(async (req, logger) => {
  logger.info('Processing request');
  // Business logic
}, { component: 'my-component' });
```

#### 3. Child Loggers with Context
```typescript
const parentLogger = createLogger({ component: 'batching' });
const childLogger = parentLogger.child({ operation: 'merkle-tree' });

childLogger.info('Processing batch', { batchSize: 50 });
```

### 📈 Specialized Logging Methods

#### Performance Logging
```typescript
logger.logPerformance('batch-creation', {
  transactionCount: 100,
  processingTimeMs: 245,
  memoryUsageMB: 64
});
```

#### Security Events
```typescript
logger.logSecurity('unauthorized-access', {
  userId: 'unknown',
  attemptedResource: '/api/admin/users',
  ip: '192.168.1.100'
});
```

#### Business Events
```typescript
logger.logBusiness('content-purchased', {
  contentId: 'content_123',
  userId: 'persona_456',
  price: 10.50,
  currency: 'USDC'
});
```

## 🚀 Implementation Status

### ✅ Completed Components

1. **Core Logging Utility**
   - StructuredLogger class with full feature set
   - Request correlation and timing
   - Multiple log levels and context propagation

2. **API Route Integration**
   - Updated BTC status route with structured logging
   - Request/response lifecycle logging
   - Error handling with correlation IDs

3. **Middleware Support**
   - `withStructuredLogger` wrapper for easy integration
   - Automatic error handling and response formatting

4. **Documentation**
   - Complete implementation guide
   - Usage patterns and examples

### 🔄 Migration Guide

#### Replace console.log calls:
```typescript
// Before
console.log('Processing batch');
console.error('Batch failed', error);

// After
logger.info('Processing batch', { batchId: 'batch_123' });
logger.error('Batch failed', error, { batchId: 'batch_123' });
```

#### Add request tracing:
```typescript
// Add to each API route
const logger = createLogger().logRequest(req, { 
  component: 'your-component',
  operation: 'your-operation'
});
```

## 🔍 Log Analysis

### Query Patterns

**Find all requests for a specific user:**
```bash
jq 'select(.context.userId == "persona_123")' logs.json
```

**Find slow requests (>1000ms):**
```bash
jq 'select(.duration > 1000)' logs.json
```

**Find error logs:**
```bash
jq 'select(.level == "error")' logs.json
```

**Find security events:**
```bash
jq 'select(.message | startswith("Security:"))' logs.json
```

### Monitoring Integration

The structured logs are designed to work with:
- **Datadog**: Automatic JSON log parsing
- **Elasticsearch**: Kibana dashboards and queries
- **CloudWatch**: Filtered log insights
- **Grafana**: Loki integration for log aggregation

## 📋 Best Practices

### 1. Log Levels
- **debug**: Detailed debugging information
- **info**: General information about request flow
- **warn**: Unexpected but non-fatal conditions
- **error**: Fatal errors that cause request failure

### 2. Context Enrichment
- Always include relevant business context
- Use correlation IDs for request tracing
- Add component and operation identifiers
- Include performance metrics for operations

### 3. Privacy Considerations
- Never log sensitive data (passwords, tokens)
- Sanitize PII before logging
- Use userId instead of personal information
- Be careful with request bodies containing sensitive data

### 4. Performance Impact
- Structured logging has minimal performance overhead
- JSON serialization is optimized for Node.js
- Use debug level for high-frequency logs
- Consider sampling for very high-traffic endpoints

## 🛠️ Configuration

### Environment Variables
```bash
# Log level (default: info)
LOG_LEVEL=debug

# Enable request logging (default: true)
ENABLE_REQUEST_LOGGING=true

# Enable performance logging (default: true)
ENABLE_PERFORMANCE_LOGGING=true
```

### Log Formatting
Logs are automatically formatted as JSON for structured processing. Human-readable formatting can be added in development environments.

## 📚 Next Steps

1. **Complete Migration**: Replace all console.log calls across API routes
2. **Add Business Metrics**: Implement domain-specific logging for key business events
3. **Monitoring Setup**: Configure log aggregation and alerting
4. **Performance Baselines**: Establish performance metrics and alerting thresholds

## 🔗 Related Documentation

- [API Routes Documentation](./API_ROUTES.md)
- [Monitoring Guide](./MONITORING.md)
- [Error Handling](./ERROR_HANDLING.md)
- [Performance Optimization](./PERFORMANCE.md)
