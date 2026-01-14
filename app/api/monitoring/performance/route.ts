/**
 * Performance Monitoring API
 * Tracks API performance, response times, and system health
 */

import { NextRequest, NextResponse } from 'next/server';
import { performance } from 'perf_hooks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Performance metrics store (in production, use Redis or database)
const performanceMetrics = {
  requests: [] as Array<{
    timestamp: number;
    endpoint: string;
    method: string;
    duration: number;
    statusCode: number;
    userAgent?: string;
  }>,
  thresholds: {
    responseTime: 2000, // 2 seconds
    errorRate: 0.05, // 5%
    concurrentRequests: 100,
  },
};

// Middleware to track performance
export function trackPerformance(
  req: NextRequest,
  handler: (request: NextRequest) => Promise<Response>
) {
  return async () => {
    const startTime = performance.now();
    const url = new URL(req.url);
    
    try {
      const response = await handler(req);
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Store metrics
      performanceMetrics.requests.push({
        timestamp: Date.now(),
        endpoint: url.pathname,
        method: req.method,
        duration,
        statusCode: response.status || 200,
        userAgent: req.headers.get('user-agent') || undefined,
      });
      
      // Keep only last 1000 requests
      if (performanceMetrics.requests.length > 1000) {
        performanceMetrics.requests = performanceMetrics.requests.slice(-1000);
      }
      
      return response;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Store error metrics
      performanceMetrics.requests.push({
        timestamp: Date.now(),
        endpoint: url.pathname,
        method: req.method,
        duration,
        statusCode: 500,
        userAgent: req.headers.get('user-agent') || undefined,
      });
      
      throw error;
    }
  };
}

// Get performance metrics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '1h'; // 1h, 6h, 24h, 7d
    const endpoint = searchParams.get('endpoint');
    
    const now = Date.now();
    let timeRangeMs: number;
    
    switch (timeRange) {
      case '1h':
        timeRangeMs = 60 * 60 * 1000;
        break;
      case '6h':
        timeRangeMs = 6 * 60 * 60 * 1000;
        break;
      case '24h':
        timeRangeMs = 24 * 60 * 60 * 1000;
        break;
      case '7d':
        timeRangeMs = 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        timeRangeMs = 60 * 60 * 1000;
    }
    
    // Filter requests by time range and endpoint
    const filteredRequests = performanceMetrics.requests.filter(req => {
      const withinTimeRange = (now - req.timestamp) <= timeRangeMs;
      const matchesEndpoint = !endpoint || req.endpoint.includes(endpoint);
      return withinTimeRange && matchesEndpoint;
    });
    
    // Calculate metrics
    const totalRequests = filteredRequests.length;
    const successfulRequests = filteredRequests.filter(req => req.statusCode < 400).length;
    const errorRequests = totalRequests - successfulRequests;
    const errorRate = totalRequests > 0 ? errorRequests / totalRequests : 0;
    
    // Response time metrics
    const responseTimes = filteredRequests.map(req => req.duration);
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;
    const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
    const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    
    // Calculate percentiles
    const sortedTimes = [...responseTimes].sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;
    
    // Endpoint breakdown
    const endpointStats = filteredRequests.reduce((stats, req) => {
      const key = req.endpoint;
      if (!stats[key]) {
        stats[key] = {
          endpoint: key,
          requests: 0,
          errors: 0,
          avgResponseTime: 0,
          totalTime: 0,
        };
      }
      
      stats[key].requests++;
      stats[key].totalTime += req.duration;
      if (req.statusCode >= 400) {
        stats[key].errors++;
      }
      
      return stats;
    }, {} as any);
    
    // Calculate averages for each endpoint
    Object.values(endpointStats).forEach((stat: any) => {
      stat.avgResponseTime = stat.totalTime / stat.requests;
      stat.errorRate = stat.errors / stat.requests;
    });
    
    // Performance alerts
    const alerts = [];
    if (avgResponseTime > performanceMetrics.thresholds.responseTime) {
      alerts.push({
        type: 'warning',
        message: `Average response time (${avgResponseTime.toFixed(0)}ms) exceeds threshold (${performanceMetrics.thresholds.responseTime}ms)`,
      });
    }
    
    if (errorRate > performanceMetrics.thresholds.errorRate) {
      alerts.push({
        type: 'error',
        message: `Error rate (${(errorRate * 100).toFixed(1)}%) exceeds threshold (${(performanceMetrics.thresholds.errorRate * 100).toFixed(1)}%)`,
      });
    }
    
    const metrics = {
      summary: {
        timeRange,
        totalRequests,
        successfulRequests,
        errorRequests,
        errorRate: Math.round(errorRate * 100 * 100) / 100, // Round to 2 decimal places
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        maxResponseTime: Math.round(maxResponseTime * 100) / 100,
        minResponseTime: Math.round(minResponseTime * 100) / 100,
      },
      percentiles: {
        p50: Math.round(p50 * 100) / 100,
        p95: Math.round(p95 * 100) / 100,
        p99: Math.round(p99 * 100) / 100,
      },
      endpoints: Object.values(endpointStats),
      alerts,
      thresholds: performanceMetrics.thresholds,
      generatedAt: new Date().toISOString(),
    };
    
    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get performance metrics',
    }, { status: 500 });
  }
}

// Clear performance metrics
export async function DELETE() {
  performanceMetrics.requests = [];
  return NextResponse.json({
    success: true,
    message: 'Performance metrics cleared',
  });
}
