"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { QubeTalkClientImpl } from "./client";
import type { QubeTalkAuthority, QubeTalkClient, QubeTalkMessage, QubeTalkMessageDraft, QubeTalkThread } from "./types";

type QubeTalkContextValue = {
  client: QubeTalkClient;
  authority: QubeTalkAuthority;
  connected: boolean;
  error: string | null;
};

type QubeTalkProviderProps = {
  children: React.ReactNode;
  wsUrl: string;
  authToken?: string;
  authority: QubeTalkAuthority;
  channel?: string;
  autoConnect?: boolean;
};

const QubeTalkContext = createContext<QubeTalkContextValue | null>(null);

export function QubeTalkProvider({
  children,
  wsUrl,
  authToken,
  authority,
  channel,
  autoConnect = true,
}: QubeTalkProviderProps) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(
    () =>
      new QubeTalkClientImpl({
        wsUrl,
        authToken,
        authority,
        channel,
        onConnectionChange: setConnected,
        onError: (nextError) => setError(nextError.message),
      }),
    [authority, authToken, channel, wsUrl]
  );

  useEffect(() => {
    if (!autoConnect || !wsUrl) return;

    client.connect().catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Unable to connect to QubeTalk");
    });

    return () => {
      client.disconnect();
    };
  }, [autoConnect, client, wsUrl]);

  const value = useMemo(
    () => ({
      client,
      authority,
      connected,
      error,
    }),
    [authority, client, connected, error]
  );

  return <QubeTalkContext.Provider value={value}>{children}</QubeTalkContext.Provider>;
}

export function useQubeTalkClient(): QubeTalkContextValue {
  const context = useContext(QubeTalkContext);
  if (!context) {
    throw new Error("useQubeTalkClient must be used inside QubeTalkProvider");
  }
  return context;
}

export function useQubeTalk(thread: QubeTalkThread) {
  const { client, connected, error } = useQubeTalkClient();
  const [messages, setMessages] = useState<QubeTalkMessage[]>([]);

  useEffect(() => {
    let active = true;

    client
      .getHistory(thread, 50)
      .then((history) => {
        if (active) {
          setMessages(history);
        }
      })
      .catch(() => {
        if (active) {
          setMessages([]);
        }
      });

    const unsubscribe = client.subscribe(thread, (message) => {
      setMessages((prev) => {
        const next = [...prev, message];
        return next.slice(Math.max(next.length - 50, 0));
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [client, thread]);

  const sendMessage = useCallback(
    async (message: QubeTalkMessageDraft): Promise<QubeTalkMessage> => {
      if (message.thread !== thread) {
        throw new Error(`Draft thread ${message.thread} does not match hook thread ${thread}`);
      }
      return client.publishDraft(message);
    },
    [client, thread]
  );

  return {
    messages,
    connected,
    error,
    sendMessage,
  };
}
