import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function ensureEnv(name, fallback) {
  if (!process.env[name]) {
    process.env[name] = fallback;
  }
}

async function importModule(relativePath) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  await fs.access(absolutePath);
  return import(pathToFileURL(absolutePath).href);
}

function createEventSink() {
  const events = [];
  return {
    events,
    sink: {
      id: "browser-smoke",
      res: {
        write(chunk) {
          const line = String(chunk).trim();
          if (!line) return;
          events.push(line);
        },
      },
    },
  };
}

async function main() {
  ensureEnv("SUPABASE_URL", "https://example.supabase.co");
  ensureEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
  ensureEnv("AA_JWT_SECRET", "aa_dev_3F7pP9mY6qL2bT8vK4wR1xN9zC5sU0h");

  const [{ browserSessionService }, { subscribeBrowserEvents }] = await Promise.all([
    importModule("services/aa-api/dist/browser/sessionService.js"),
    importModule("services/aa-api/dist/browser/events.js"),
  ]);

  const auth = {
    did: "did:example:browser-smoke",
    userId: "browser-smoke-user",
    tenantId: "00000000-0000-0000-0000-000000000000",
    personaId: "browser-smoke-persona",
  };

  const created = await browserSessionService.createSession({
    auth,
    intent: "Browser smoke",
    targetUrl: "https://example.com",
  });

  const sessionId = created.session.sessionId;
  const { events, sink } = createEventSink();
  const unsubscribe = subscribeBrowserEvents(sessionId, sink);

  try {
    await browserSessionService.mountSession(sessionId);
    await browserSessionService.navigate(sessionId, "https://example.org/docs", "navigate");
    await browserSessionService.runAgentTask(sessionId, {
      instruction: "Summarize the active page",
      payload: { source: "browser_smoke" },
    });
    await browserSessionService.extractFromSession(sessionId, {
      prompt: "Extract smoke test details",
    });
    await browserSessionService.saveSessionOutput(sessionId, {
      destinationType: "estate",
      metadata: { source: "browser_smoke" },
    });
    await browserSessionService.startTakeover(sessionId);
    await browserSessionService.endTakeover(sessionId);
    await browserSessionService.closeSession(sessionId);
  } finally {
    unsubscribe();
  }

  const aggregate = browserSessionService.getSession(sessionId);

  assert(aggregate, "browser smoke did not retain a session aggregate");
  assert(aggregate.session.status === "closed", "browser smoke session was not closed");
  assert(aggregate.history.length >= 8, "browser smoke expected at least 8 history events");
  assert(aggregate.artifacts.length >= 1, "browser smoke expected at least one artifact");
  assert(aggregate.receipts.length >= aggregate.history.length, "browser smoke receipts did not track history");
  assert(aggregate.saves.length >= 1, "browser smoke expected at least one save");
  assert(aggregate.surfaceState.takeoverActive === false, "browser smoke takeover state did not reset");
  assert(
    events.some((line) => line === "event: browser.mount"),
    "browser smoke did not emit browser.mount"
  );
  assert(
    events.some((line) => line === "event: browser.unmount"),
    "browser smoke did not emit browser.unmount"
  );
  assert(
    events.some((line) => line === "event: browser.step.update"),
    "browser smoke did not emit browser.step.update"
  );
  assert(
    events.some((line) => line === "event: browser.takeover.state"),
    "browser smoke did not emit browser.takeover.state"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        sessionId,
        status: aggregate.session.status,
        currentUrl: aggregate.session.currentUrl,
        history: aggregate.history.length,
        artifacts: aggregate.artifacts.length,
        receipts: aggregate.receipts.length,
        saves: aggregate.saves.length,
        emittedEvents: Array.from(
          new Set(
            events
              .filter((line) => line.startsWith("event: "))
              .map((line) => line.replace("event: ", ""))
          )
        ).sort(),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[browser:smoke] failed");
  console.error(error);
  process.exit(1);
});
