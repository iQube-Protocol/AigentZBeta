// React hook for QCT Event Listener management
import { useState, useEffect, useCallback } from 'react';

export interface EventListenerStats {
  chainId: string;
  status: 'running' | 'stopped' | 'error';
  lastBlock: number;
  eventsProcessed: number;
  errors: number;
  uptime: number;
  lastEventAt?: number;
}

export interface EventListenerStatus {
  running: boolean;
  stats: EventListenerStats[];
  chains: Array<{
    chainId: string;
    name: string;
    type: string;
    enabled: boolean;
  }>;
  at: string;
}

export function useEventListener(refreshInterval = 10000, autoStart = false) {
  const [status, setStatus] = useState<EventListenerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);

  // Fetch current status
  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/qct/events?action=status');
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to fetch status');
      }

      setStatus(data);
    } catch (err: any) {
      console.error('[useEventListener] Status fetch error:', err);
      setError(err.message);
    }
  }, []);

  // Start event listener
  const start = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/qct/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to start listener');
      }

      // Refresh status after starting
      await fetchStatus();
      return data;
    } catch (err: any) {
      console.error('[useEventListener] Start error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  // Stop event listener
  const stop = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/qct/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to stop listener');
      }

      // Refresh status after stopping
      await fetchStatus();
      return data;
    } catch (err: any) {
      console.error('[useEventListener] Stop error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  // Restart event listener
  const restart = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/qct/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restart' }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to restart listener');
      }

      // Refresh status after restarting
      await fetchStatus();
      return data;
    } catch (err: any) {
      console.error('[useEventListener] Restart error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchStatus]);

  // Auto-refresh status and auto-start
  useEffect(() => {
    fetchStatus();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchStatus, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchStatus, refreshInterval]);

  // Auto-start functionality
  useEffect(() => {
    if (autoStart && !hasAutoStarted && status && !status.running && !loading) {
      console.log('[useEventListener] Auto-starting QCT Event Listener...');
      setHasAutoStarted(true);
      start().catch(err => {
        console.error('[useEventListener] Auto-start failed:', err);
        setHasAutoStarted(false); // Reset to allow retry
      });
    }
  }, [autoStart, hasAutoStarted, status, loading, start]);

  // Helper functions
  const getChainStats = useCallback((chainId: string) => {
    return status?.stats.find(stat => stat.chainId === chainId);
  }, [status]);

  const getTotalEvents = useCallback(() => {
    return status?.stats.reduce((total, stat) => total + stat.eventsProcessed, 0) || 0;
  }, [status]);

  const getTotalErrors = useCallback(() => {
    return status?.stats.reduce((total, stat) => total + stat.errors, 0) || 0;
  }, [status]);

  const getRunningChains = useCallback(() => {
    return status?.stats.filter(stat => stat.status === 'running').length || 0;
  }, [status]);

  const getErrorChains = useCallback(() => {
    return status?.stats.filter(stat => stat.status === 'error').length || 0;
  }, [status]);

  return {
    // State
    status,
    loading,
    error,

    // Actions
    start,
    stop,
    restart,
    refresh: fetchStatus,

    // Helpers
    getChainStats,
    getTotalEvents,
    getTotalErrors,
    getRunningChains,
    getErrorChains,

    // Computed properties
    isRunning: status?.running || false,
    totalChains: status?.chains.length || 0,
    enabledChains: status?.chains.filter(c => c.enabled).length || 0,
  };
}
