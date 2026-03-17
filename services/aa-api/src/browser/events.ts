import type { Response } from 'express';

type BrowserEventName =
  | 'browser.mount'
  | 'browser.unmount'
  | 'browser.surface.state'
  | 'browser.step.update'
  | 'browser.takeover.state'
  | 'browser.badges.update'
  | 'browser.error';

type BrowserEventSink = {
  id: string;
  res: Response;
};

const sinks = new Map<string, Set<BrowserEventSink>>();

function ensureSessionSinks(sessionId: string): Set<BrowserEventSink> {
  const existing = sinks.get(sessionId);
  if (existing) return existing;
  const created = new Set<BrowserEventSink>();
  sinks.set(sessionId, created);
  return created;
}

export function subscribeBrowserEvents(sessionId: string, sink: BrowserEventSink): () => void {
  const sessionSinks = ensureSessionSinks(sessionId);
  sessionSinks.add(sink);
  return () => {
    sessionSinks.delete(sink);
    if (sessionSinks.size === 0) {
      sinks.delete(sessionId);
    }
  };
}

export function emitBrowserEvent(sessionId: string, event: BrowserEventName, payload: Record<string, unknown>): void {
  const sessionSinks = sinks.get(sessionId);
  if (!sessionSinks || sessionSinks.size === 0) return;
  const serialized = JSON.stringify(payload);

  for (const sink of sessionSinks) {
    sink.res.write(`event: ${event}\n`);
    sink.res.write(`data: ${serialized}\n\n`);
  }
}
