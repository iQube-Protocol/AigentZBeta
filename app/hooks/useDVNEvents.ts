import { useEffect, useState } from "react";

export type DVNEvent = {
  event: "PaymentInitiated" | "PaymentConfirmed" | "PaymentFailed";
  chain: string;
  asset: string;
  txHash: string;
  amount: string;
  proofHash?: string;
  timestamp?: number;
  meta?: Record<string, any>;
};

const DVN_SSE = process.env.NEXT_PUBLIC_DVN_SSE_URL as string | undefined;

export function useDVNEvents(agentId?: string) {
  const [events, setEvents] = useState<DVNEvent[]>([]);
  useEffect(() => {
    if (!DVN_SSE) return;
    const src = new EventSource(`${DVN_SSE}?agent=${agentId ?? ""}`);
    src.onmessage = (e) => {
      try {
        const ev: DVNEvent = JSON.parse(e.data);
        setEvents((prev) => [ev, ...prev].slice(0, 200));
      } catch {}
    };
    src.onerror = () => {
      // noop: transient errors in SSE
    };
    return () => src.close();
  }, [agentId]);
  return events;
}
