/**
 * Metrics and Monitoring System
 * 
 * Provides application performance monitoring, business metrics,
 * and operational health tracking for AigentZ platform.
 */

interface MetricConfig {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  help: string;
  labels?: string[];
}

interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

interface MetricSnapshot {
  name: string;
  type: string;
  help: string;
  values: MetricValue[];
}

class MetricsCollector {
  private metrics = new Map<string, MetricSnapshot>();
  private timers = new Map<string, number>();

  /**
   * Register a new metric type
   */
  register(config: MetricConfig): void {
    if (this.metrics.has(config.name)) {
      return; // Already registered
    }

    this.metrics.set(config.name, {
      name: config.name,
      type: config.type,
      help: config.help,
      values: [],
    });
  }

  /**
   * Increment a counter metric
   */
  increment(name: string, value: number = 1, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'counter') {
      return;
    }

    const existingValue = metric.values.find(v => 
      this.labelMatch(v.labels, labels)
    );

    if (existingValue) {
      existingValue.value += value;
      existingValue.timestamp = Date.now();
    } else {
      metric.values.push({
        value,
        timestamp: Date.now(),
        labels: { ...labels },
      });
    }
  }

  /**
   * Set a gauge metric value
   */
  gauge(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'gauge') {
      return;
    }

    const existingValue = metric.values.find(v => 
      this.labelMatch(v.labels, labels)
    );

    if (existingValue) {
      existingValue.value = value;
      existingValue.timestamp = Date.now();
    } else {
      metric.values.push({
        value,
        timestamp: Date.now(),
        labels: { ...labels },
      });
    }
  }

  /**
   * Record a histogram value
   */
  histogram(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric || metric.type !== 'histogram') {
      return;
    }

    metric.values.push({
      value,
      timestamp: Date.now(),
      labels: { ...labels },
    });

    // Keep only last 1000 values to prevent memory leaks
    if (metric.values.length > 1000) {
      metric.values = metric.values.slice(-1000);
    }
  }

  /**
   * Start a timer
   */
  timerStart(name: string): string {
    const timerId = `${name}_${Date.now()}_${Math.random()}`;
    this.timers.set(timerId, Date.now());
    return timerId;
  }

  /**
   * End a timer and record the duration
   */
  timerEnd(timerId: string, labels?: Record<string, string>): void {
    const startTime = this.timers.get(timerId);
    if (!startTime) {
      return;
    }

    const duration = Date.now() - startTime;
    const name = timerId.split('_').slice(0, -2).join('_');
    
    this.histogram(`${name}_duration_ms`, duration, labels);
    this.timers.delete(timerId);
  }

  /**
   * Get all metrics as a snapshot
   */
  getSnapshot(): MetricSnapshot[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusFormat(): string {
    const lines: string[] = [];

    for (const metric of this.metrics.values()) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      for (const value of metric.values) {
        const labelStr = value.labels 
          ? `{${Object.entries(value.labels).map(([k, v]) => `${k}="${v}"`).join(',')}}`
          : '';
        lines.push(`${metric.name}${labelStr} ${value.value} ${value.timestamp}`);
      }

      lines.push(''); // Empty line between metrics
    }

    return lines.join('\n');
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    this.timers.clear();
  }

  /**
   * Get metric statistics
   */
  getStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    sum: number;
  } | null {
    const metric = this.metrics.get(name);
    if (!metric || metric.values.length === 0) {
      return null;
    }

    const values = metric.values.map(v => v.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      sum,
    };
  }

  private labelMatch(a?: Record<string, string>, b?: Record<string, string>): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => a[key] === b[key]);
  }
}

// Global metrics collector instance
const metrics = new MetricsCollector();

// Register default metrics
metrics.register({ name: 'api_requests_total', type: 'counter', help: 'Total number of API requests' });
metrics.register({ name: 'api_request_duration_ms', type: 'histogram', help: 'API request duration in milliseconds' });
metrics.register({ name: 'api_errors_total', type: 'counter', help: 'Total number of API errors' });
metrics.register({ name: 'active_users', type: 'gauge', help: 'Number of active users' });
metrics.register({ name: 'registry_templates_total', type: 'gauge', help: 'Total number of registry templates' });
metrics.register({ name: 'cache_hits_total', type: 'counter', help: 'Total number of cache hits' });
metrics.register({ name: 'cache_misses_total', type: 'counter', help: 'Total number of cache misses' });

/**
 * Metrics middleware for API routes
 */
export function withMetrics<T>(
  handler: (req: Request) => Promise<T>,
  options: {
    routeName?: string;
    trackErrors?: boolean;
    trackDuration?: boolean;
  } = {}
) {
  return async (req: Request): Promise<Response> => {
    const routeName = options.routeName || new URL(req.url).pathname;
    const timerId = metrics.timerStart('api_request');

    try {
      // Increment request counter
      metrics.increment('api_requests_total', 1, { route: routeName });

      const result = await handler(req);

      // End timer and record duration
      if (options.trackDuration !== false) {
        metrics.timerEnd(timerId, { route: routeName, status: 'success' });
      }

      // Return response
      if (result instanceof Response) {
        return result;
      }

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      // Track error
      if (options.trackErrors !== false) {
        metrics.increment('api_errors_total', 1, { 
          route: routeName, 
          error: error instanceof Error ? error.name : 'unknown' 
        });
        metrics.timerEnd(timerId, { route: routeName, status: 'error' });
      }

      console.error('Metrics middleware error:', error);
      
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}

/**
 * Business metrics tracking
 */
export class BusinessMetrics {
  /**
   * Track user registration
   */
  static trackUserRegistration(userId: string): void {
    metrics.increment('user_registrations_total', 1, { source: 'registry' });
  }

  /**
   * Track template creation
   */
  static trackTemplateCreation(type: string): void {
    metrics.increment('template_creations_total', 1, { type });
    metrics.gauge('registry_templates_total', this.getTemplateCount());
  }

  /**
   * Track template minting
   */
  static trackTemplateMinting(type: 'public' | 'private'): void {
    metrics.increment('template_minting_total', 1, { visibility: type });
  }

  /**
   * Track cross-chain operations
   */
  static trackCrossChainOperation(network: string, operation: string): void {
    metrics.increment('cross_chain_operations_total', 1, { network, operation });
  }

  /**
   * Update active users gauge
   */
  static updateActiveUsers(count: number): void {
    metrics.gauge('active_users', count);
  }

  /**
   * Get current template count (placeholder)
   */
  private static getTemplateCount(): number {
    // This would typically query the database
    return 0;
  }
}

/**
 * System health metrics
 */
export class HealthMetrics {
  /**
   * Track database connection status
   */
  static trackDatabaseStatus(healthy: boolean): void {
    metrics.gauge('database_healthy', healthy ? 1 : 0);
  }

  /**
   * Track cache performance
   */
  static trackCacheHit(): void {
    metrics.increment('cache_hits_total', 1);
  }

  static trackCacheMiss(): void {
    metrics.increment('cache_misses_total', 1);
  }

  /**
   * Track memory usage
   */
  static trackMemoryUsage(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      metrics.gauge('memory_usage_bytes', usage.heapUsed, { type: 'heap' });
      metrics.gauge('memory_usage_bytes', usage.external, { type: 'external' });
    }
  }

  /**
   * Track system uptime
   */
  static trackUptime(): void {
    if (typeof process !== 'undefined' && process.uptime) {
      metrics.gauge('process_uptime_seconds', Math.floor(process.uptime()));
    }
  }
}

// Periodic health metrics collection
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    HealthMetrics.trackMemoryUsage();
    HealthMetrics.trackUptime();
  }, 30000); // Every 30 seconds
}

export default metrics;
