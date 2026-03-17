const sinks = new Map();
function ensureSessionSinks(sessionId) {
    const existing = sinks.get(sessionId);
    if (existing)
        return existing;
    const created = new Set();
    sinks.set(sessionId, created);
    return created;
}
export function subscribeBrowserEvents(sessionId, sink) {
    const sessionSinks = ensureSessionSinks(sessionId);
    sessionSinks.add(sink);
    return () => {
        sessionSinks.delete(sink);
        if (sessionSinks.size === 0) {
            sinks.delete(sessionId);
        }
    };
}
export function emitBrowserEvent(sessionId, event, payload) {
    const sessionSinks = sinks.get(sessionId);
    if (!sessionSinks || sessionSinks.size === 0)
        return;
    const serialized = JSON.stringify(payload);
    for (const sink of sessionSinks) {
        sink.res.write(`event: ${event}\n`);
        sink.res.write(`data: ${serialized}\n\n`);
    }
}
