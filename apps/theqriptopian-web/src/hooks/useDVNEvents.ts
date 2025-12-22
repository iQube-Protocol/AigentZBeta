/**
 * useDVNEvents - Hook for live DVN event streaming
 */
import { useState, useEffect, useCallback } from 'react';

interface DVNEvent {
  id: string;
  event: string;
  chain: string;
  amount: string;
  timestamp: string;
  txHash?: string;
  status?: 'pending' | 'confirmed' | 'failed';
}

export function useDVNEvents(agentId: string | undefined): DVNEvent[] {
  const [events, setEvents] = useState<DVNEvent[]>([]);

  const fetchEvents = useCallback(
    async (signal?: AbortSignal) => {
      if (!agentId) return;

      try {
        const apiBase = import.meta.env.VITE_AIGENT_API_URL || '';
        const url = apiBase
          ? `${apiBase}/api/dvn/events?agentId=${encodeURIComponent(agentId)}&limit=10`
          : `/api/dvn/events?agentId=${encodeURIComponent(agentId)}&limit=10`;

        const response = await fetch(url, { signal });

        if (!response.ok) {
          setEvents([]);
          return;
        }

        const data = await response.json();
        setEvents(data.events || []);
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        setEvents([]);
        console.error('[useDVNEvents] Error:', err);
      }
    },
    [agentId]
  );

  useEffect(() => {
    if (!agentId) return;

    const controller = new AbortController();
    fetchEvents(controller.signal);

    // Poll every 10 seconds for new events
    const interval = setInterval(() => fetchEvents(undefined), 10000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchEvents]);

  return events;
}

export default useDVNEvents;
