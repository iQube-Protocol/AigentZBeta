import crypto from "crypto";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { subscribeBrowserEvents } from "../../../../../../services/aa-api/src/browser/events";
import { browserSessionService } from "../../../../../../services/aa-api/src/browser/sessionService";
import { browserbaseProviderAdapter } from "../../../../../../services/aa-api/src/browser/providers/browserbase";
import { browserPlaywrightExec } from "../../../../../../services/aa-api/src/browser/exec/playwright";
import { browserStagehandExec } from "../../../../../../services/aa-api/src/browser/exec/stagehand";
import type {
  BrowserAuthScope,
  BrowserMountMode,
  BrowserSessionAggregate,
} from "../../../../../../services/aa-api/src/browser/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: {
    path?: string[];
  };
};

type BrowserSessionServiceApi = {
  createSession: (input: {
    auth: BrowserAuthScope;
    intent?: string | null;
    mountMode?: BrowserMountMode;
    targetUrl?: string | null;
  }) => Promise<BrowserSessionAggregate>;
  getSession: (sessionId: string) => BrowserSessionAggregate | null;
  closeSession: (sessionId: string) => Promise<BrowserSessionAggregate>;
  suspendSession: (sessionId: string) => Promise<BrowserSessionAggregate>;
  resumeSession: (sessionId: string) => Promise<BrowserSessionAggregate>;
  mountSession: (sessionId: string) => Promise<BrowserSessionAggregate>;
  unmountSession: (sessionId: string) => Promise<BrowserSessionAggregate>;
  navigate: (
    sessionId: string,
    url: string,
    action: "navigate" | "back" | "forward" | "refresh"
  ) => Promise<BrowserSessionAggregate>;
  runAgentTask: (
    sessionId: string,
    input: { instruction?: string | null; payload: Record<string, unknown> }
  ) => Promise<Record<string, unknown>>;
  pauseAgentExecution: (sessionId: string) => Promise<BrowserSessionAggregate>;
  resumeAgentExecution: (sessionId: string) => Promise<BrowserSessionAggregate>;
  startTakeover: (sessionId: string) => Promise<BrowserSessionAggregate>;
  endTakeover: (sessionId: string) => Promise<BrowserSessionAggregate>;
  extractFromSession: (
    sessionId: string,
    input: { prompt?: string | null; schema?: Record<string, unknown> | null }
  ) => Promise<Record<string, unknown>>;
  saveSessionOutput: (
    sessionId: string,
    input: {
      destinationType?: string;
      destinationId?: string | null;
      artifactId?: string | null;
      metadata: Record<string, unknown>;
      savedBy?: string | null;
    }
  ) => Promise<Record<string, unknown>>;
};

const typedBrowserSessionService = browserSessionService as unknown as BrowserSessionServiceApi;

function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

function getDefaultAuthScope(): BrowserAuthScope {
  return {
    tenantId: process.env.DEFAULT_TENANT_ID || "metame",
    personaId: process.env.DEFAULT_PERSONA_ID || "guest",
    did: "did:metame:runtime-shell",
    userId: "did:metame:runtime-shell",
  };
}

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  const queryToken = request.nextUrl.searchParams.get("access_token");
  return queryToken && queryToken.trim().length > 0 ? queryToken.trim() : null;
}

function resolveAuthScope(request: NextRequest): BrowserAuthScope {
  const token = getBearerToken(request);
  const staticToken = process.env.NEXT_PUBLIC_AA_API_TOKEN || process.env.AA_API_TOKEN || null;
  const secret = process.env.AA_JWT_SECRET || process.env.SUPABASE_JWT_SECRET || null;

  if (token && staticToken && token === staticToken) {
    return getDefaultAuthScope();
  }

  if (token && secret) {
    try {
      const payload = jwt.verify(token, secret) as Record<string, unknown>;
      return {
        did: typeof payload.did === "string" ? payload.did : undefined,
        userId: typeof payload.user_id === "string" ? payload.user_id : undefined,
        tenantId:
          typeof payload.tenant_id === "string"
            ? payload.tenant_id
            : process.env.DEFAULT_TENANT_ID || "metame",
        personaId:
          typeof payload.persona_id === "string"
            ? payload.persona_id
            : process.env.DEFAULT_PERSONA_ID ||
              (typeof payload.did === "string" ? payload.did : "guest"),
      };
    } catch {
      return getDefaultAuthScope();
    }
  }

  return getDefaultAuthScope();
}

async function parseRequestBody(request: NextRequest): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore invalid JSON
  }
  return {};
}

function serializeAggregate(aggregate: BrowserSessionAggregate) {
  return {
    session: aggregate.session,
    mountPayload: aggregate.mountPayload,
    surfaceState: aggregate.surfaceState,
    badges: aggregate.badges,
  };
}

function errorStatus(message: string): number {
  if (/unknown browser session|browser session not found/i.test(message)) return 404;
  return 400;
}

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unknown browser error";
  return json({ error: message }, { status: errorStatus(message) });
}

function assertBrowserSessionAccess(aggregate: BrowserSessionAggregate, auth: BrowserAuthScope): void {
  const matchesUser =
    (typeof auth.userId === "string" && auth.userId === aggregate.session.userId) ||
    (typeof auth.did === "string" && auth.did === aggregate.session.userId);
  const matchesPersona =
    typeof auth.personaId === "string" &&
    typeof aggregate.session.personaId === "string" &&
    auth.personaId === aggregate.session.personaId;
  const matchesTenant =
    typeof auth.tenantId === "string" &&
    typeof aggregate.session.tenantId === "string" &&
    auth.tenantId === aggregate.session.tenantId;

  if (aggregate.session.userId) {
    if (!matchesUser) throw new Error("Browser session not found");
    return;
  }

  if (aggregate.session.personaId) {
    if (!matchesPersona) throw new Error("Browser session not found");
    return;
  }

  if (aggregate.session.tenantId && !matchesTenant) {
    throw new Error("Browser session not found");
  }
}

function getScopedSession(sessionId: string, auth: BrowserAuthScope): BrowserSessionAggregate {
  const aggregate = typedBrowserSessionService.getSession(sessionId);
  if (!aggregate) {
    throw new Error("Browser session not found");
  }
  assertBrowserSessionAccess(aggregate, auth);
  return aggregate;
}

function parseMountMode(value: unknown): BrowserMountMode | undefined {
  if (value === "overlay" || value === "docked" || value === "panel") {
    return value;
  }
  return undefined;
}

async function handleCreateSession(request: NextRequest, auth: BrowserAuthScope): Promise<Response> {
  const body = await parseRequestBody(request);
  const requestedUrl =
    typeof body.targetUrl === "string" ? body.targetUrl : typeof body.url === "string" ? body.url : null;
  const aggregate = await typedBrowserSessionService.createSession({
    auth,
    intent: typeof body.intent === "string" ? body.intent : null,
    mountMode: parseMountMode(body.mountMode),
    targetUrl: requestedUrl,
  });
  return json(serializeAggregate(aggregate));
}

function handleEvents(sessionId: string, auth: BrowserAuthScope, request: NextRequest): Response {
  const aggregate = getScopedSession(sessionId, auth);
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (chunk: string) => {
        if (!closed) {
          controller.enqueue(encoder.encode(chunk));
        }
      };

      write(`event: browser.surface.state\n`);
      write(`data: ${JSON.stringify(aggregate.surfaceState)}\n\n`);
      write(`event: browser.badges.update\n`);
      write(`data: ${JSON.stringify(aggregate.badges)}\n\n`);
      write(`event: browser.takeover.state\n`);
      write(
        `data: ${JSON.stringify({
          sessionId: aggregate.session.sessionId,
          active: aggregate.surfaceState.takeoverActive,
        })}\n\n`
      );

      unsubscribe = subscribeBrowserEvents(sessionId, {
        id: crypto.randomUUID(),
        res: { write },
      });

      const heartbeat = setInterval(() => {
        write(`: keepalive\n\n`);
      }, 15000);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      };

      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      closed = true;
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

async function handleSessionPost(
  sessionId: string,
  action: string,
  request: NextRequest,
  auth: BrowserAuthScope
): Promise<Response> {
  getScopedSession(sessionId, auth);
  const body = await parseRequestBody(request);

  switch (action) {
    case "close":
      return json(serializeAggregate(await typedBrowserSessionService.closeSession(sessionId)));
    case "suspend":
      return json(serializeAggregate(await typedBrowserSessionService.suspendSession(sessionId)));
    case "resume":
      return json(serializeAggregate(await typedBrowserSessionService.resumeSession(sessionId)));
    case "mount":
      return json(serializeAggregate(await typedBrowserSessionService.mountSession(sessionId)));
    case "unmount":
      return json(serializeAggregate(await typedBrowserSessionService.unmountSession(sessionId)));
    case "navigate": {
      const url = typeof body.url === "string" ? body.url : null;
      if (!url) return json({ error: "url is required" }, { status: 400 });
      return json(serializeAggregate(await typedBrowserSessionService.navigate(sessionId, url, "navigate")));
    }
    case "back":
      return json(serializeAggregate(await typedBrowserSessionService.navigate(sessionId, "", "back")));
    case "forward":
      return json(serializeAggregate(await typedBrowserSessionService.navigate(sessionId, "", "forward")));
    case "refresh":
      return json(serializeAggregate(await typedBrowserSessionService.navigate(sessionId, "", "refresh")));
    case "extract":
      return json(
        await typedBrowserSessionService.extractFromSession(sessionId, {
          prompt: typeof body.prompt === "string" ? body.prompt : null,
          schema:
            body.schema && typeof body.schema === "object" && !Array.isArray(body.schema)
              ? (body.schema as Record<string, unknown>)
              : null,
        })
      );
    case "save":
      return json(
        await typedBrowserSessionService.saveSessionOutput(sessionId, {
          destinationType: typeof body.destinationType === "string" ? body.destinationType : undefined,
          destinationId: typeof body.destinationId === "string" ? body.destinationId : null,
          artifactId: typeof body.artifactId === "string" ? body.artifactId : null,
          metadata:
            body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
              ? (body.metadata as Record<string, unknown>)
              : {},
          savedBy: auth.userId || auth.did || null,
        })
      );
    default:
      return json({ error: "Not found" }, { status: 404 });
  }
}

async function handleNestedSessionPost(
  sessionId: string,
  scope: string,
  action: string,
  request: NextRequest,
  auth: BrowserAuthScope
): Promise<Response> {
  getScopedSession(sessionId, auth);
  const body = await parseRequestBody(request);

  if (scope === "agent") {
    switch (action) {
      case "run":
        return json({
          ...(await typedBrowserSessionService.runAgentTask(sessionId, {
            instruction: typeof body.instruction === "string" ? body.instruction : null,
            payload: body,
          })),
          stagehand: browserStagehandExec.getStatus(),
        });
      case "pause":
        return json(serializeAggregate(await typedBrowserSessionService.pauseAgentExecution(sessionId)));
      case "resume":
        return json(serializeAggregate(await typedBrowserSessionService.resumeAgentExecution(sessionId)));
      default:
        return json({ error: "Not found" }, { status: 404 });
    }
  }

  if (scope === "takeover") {
    switch (action) {
      case "start":
        return json(serializeAggregate(await typedBrowserSessionService.startTakeover(sessionId)));
      case "end":
        return json(serializeAggregate(await typedBrowserSessionService.endTakeover(sessionId)));
      default:
        return json({ error: "Not found" }, { status: 404 });
    }
  }

  return json({ error: "Not found" }, { status: 404 });
}

function handleSessionGet(sessionId: string, action: string | null, auth: BrowserAuthScope, request: NextRequest): Response {
  const aggregate = getScopedSession(sessionId, auth);

  if (!action) {
    return json(serializeAggregate(aggregate));
  }

  switch (action) {
    case "surface-state":
      return json({ surfaceState: aggregate.surfaceState });
    case "events":
      return handleEvents(sessionId, auth, request);
    case "history":
      return json({ history: aggregate.history });
    case "artifacts":
      return json({ artifacts: aggregate.artifacts });
    case "receipts":
      return json({ receipts: aggregate.receipts });
    default:
      return json({ error: "Not found" }, { status: 404 });
  }
}

async function handleRequest(request: NextRequest, context: RouteContext): Promise<Response> {
  const auth = resolveAuthScope(request);
  const path = context.params.path ?? [];

  try {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "Content-Type, Authorization",
          "access-control-max-age": "600",
        },
      });
    }

    if (path.length === 1 && path[0] === "status" && request.method === "GET") {
      return json({
        provider: browserbaseProviderAdapter.getStatus(),
        playwright: browserPlaywrightExec.getStatus(),
        stagehand: browserStagehandExec.getStatus(),
      });
    }

    if (path[0] !== "sessions") {
      return json({ error: "Not found" }, { status: 404 });
    }

    if (path.length === 1 && request.method === "POST") {
      return await handleCreateSession(request, auth);
    }

    const sessionId = path[1];
    if (!sessionId) {
      return json({ error: "Not found" }, { status: 404 });
    }

    if (request.method === "GET") {
      return handleSessionGet(sessionId, path[2] || null, auth, request);
    }

    if (request.method === "POST" && path.length === 3) {
      return await handleSessionPost(sessionId, path[2], request, auth);
    }

    if (request.method === "POST" && path.length === 4) {
      return await handleNestedSessionPost(sessionId, path[2], path[3], request, auth);
    }

    return json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleRequest(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext): Promise<Response> {
  return handleRequest(request, context);
}
