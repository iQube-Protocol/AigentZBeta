import { NextRequest, NextResponse } from 'next/server';
import metrics from '../../utils/metrics';

/**
 * Metrics API endpoint
 * 
 * Provides application metrics in various formats for monitoring
 * and observability systems.
 * 
 * GET /api/metrics?format=prometheus - Prometheus format
 * GET /api/metrics?format=json - JSON format
 * GET /api/metrics/stats/{metric_name} - Statistics for specific metric
 */

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    const metricName = url.pathname.split('/').pop();

    // Handle specific metric statistics
    if (metricName && metricName !== 'metrics') {
      const stats = metrics.getStats(metricName);
      if (!stats) {
        return NextResponse.json({ error: 'Metric not found' }, { status: 404 });
      }

      return NextResponse.json({
        name: metricName,
        stats,
        timestamp: Date.now(),
      });
    }

    switch (format.toLowerCase()) {
      case 'prometheus':
        const prometheusData = metrics.getPrometheusFormat();
        return new Response(prometheusData, {
          headers: {
            'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
          },
        });

      case 'json':
      default:
        const snapshot = metrics.getSnapshot();
        return NextResponse.json({
          timestamp: Date.now(),
          metrics: snapshot,
        });
    }
  } catch (error) {
    console.error('Metrics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

/**
 * Health check endpoint with metrics
 */
export async function HEAD(request: NextRequest) {
  try {
    // Basic health check - if we can get metrics, we're healthy
    const snapshot = metrics.getSnapshot();
    
    return new Response(null, {
      status: 200,
      headers: {
        'X-Metrics-Count': snapshot.length.toString(),
        'X-Timestamp': Date.now().toString(),
      },
    });
  } catch (error) {
    return new Response(null, { status: 503 });
  }
}
