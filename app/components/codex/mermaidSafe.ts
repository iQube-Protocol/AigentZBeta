type MermaidModule = typeof import("mermaid");
type MermaidInstance = MermaidModule["default"];

export type MermaidValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; error: string };

const MAX_MERMAID_CHARS = 50_000;
const MAX_MERMAID_NODES = 200;
const MAX_MERMAID_EDGES = 300;
const RENDER_TIMEOUT_MS = 10_000;
const QUEUE_DELAY_MS = 50;

const UNSAFE_PATTERNS = [
  /<\s*script/i,
  /javascript\s*:/i,
  /<\s*iframe/i,
  /\bon\w+\s*=/i,
];

let mermaidInstancePromise: Promise<MermaidInstance> | null = null;
let renderQueue: Promise<void> = Promise.resolve();

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function waitForAnimationFrame(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function withTimeout<T>(operation: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race<T>([
      Promise.resolve(operation),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("Mermaid render timed out"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function getMermaidInstance(): Promise<MermaidInstance> {
  if (!mermaidInstancePromise) {
    mermaidInstancePromise = import("mermaid").then((module) => {
      const mermaid = module.default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "dark",
      });
      return mermaid;
    });
  }

  return mermaidInstancePromise;
}

export function normalizeMermaidSource(source: string): string {
  return source
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

function estimateNodeCount(source: string): number {
  const nodeTokens = source.match(/\[[^\]]+\]|\([^)]+\)|\{[^}]+\}|\(\([^)]+\)\)|\[\[[^\]]+\]\]/g);
  return nodeTokens?.length ?? 0;
}

function estimateEdgeCount(source: string): number {
  const edgeTokens = source.match(/-->|==>|-.->|---|~~~|==/g);
  return edgeTokens?.length ?? 0;
}

export function validateMermaidSource(source: string): MermaidValidationResult {
  const normalized = normalizeMermaidSource(source);

  if (!normalized) {
    return { ok: false, error: "Diagram is empty." };
  }

  if (normalized.length > MAX_MERMAID_CHARS) {
    return { ok: false, error: "Diagram exceeds maximum length." };
  }

  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(normalized)) {
      return { ok: false, error: "Diagram contains unsafe markup." };
    }
  }

  const nodeCount = estimateNodeCount(normalized);
  if (nodeCount > MAX_MERMAID_NODES) {
    return { ok: false, error: "Diagram exceeds complexity limit (nodes)." };
  }

  const edgeCount = estimateEdgeCount(normalized);
  if (edgeCount > MAX_MERMAID_EDGES) {
    return { ok: false, error: "Diagram exceeds complexity limit (edges)." };
  }

  return { ok: true, normalized };
}

export function clearMermaidProcessedAttributes(root: HTMLElement): void {
  root.removeAttribute("data-processed");
  root.querySelectorAll("[data-processed]").forEach((element) => {
    element.removeAttribute("data-processed");
  });
}

export async function waitForDocumentVisible(): Promise<void> {
  if (typeof document === "undefined" || document.visibilityState === "visible") {
    return;
  }

  await new Promise<void>((resolve) => {
    const handler = () => {
      if (document.visibilityState === "visible") {
        document.removeEventListener("visibilitychange", handler);
        resolve();
      }
    };

    document.addEventListener("visibilitychange", handler);
  });
}

export async function enqueueMermaidRender<T>(task: () => Promise<T>): Promise<T> {
  const queuedTask = renderQueue.then(task);
  renderQueue = queuedTask
    .then(() => wait(QUEUE_DELAY_MS))
    .catch(() => wait(QUEUE_DELAY_MS))
    .then(() => undefined);
  return queuedTask;
}

export async function renderMermaidSvg(source: string, renderId: string): Promise<string> {
  const mermaid = await getMermaidInstance();

  await waitForDocumentVisible();
  await waitForAnimationFrame();

  await withTimeout(mermaid.parse(source), RENDER_TIMEOUT_MS);
  const rendered = await withTimeout(mermaid.render(renderId, source), RENDER_TIMEOUT_MS);
  return rendered.svg;
}
