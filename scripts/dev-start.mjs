#!/usr/bin/env node
import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  let port = Number(process.env.PORT || 3000);
  const passthrough = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--port" && argv[i + 1]) {
      const maybePort = Number(argv[i + 1]);
      if (Number.isFinite(maybePort) && maybePort > 0) {
        port = maybePort;
      }
      i += 1;
      continue;
    }
    if (arg.startsWith("--port=")) {
      const maybePort = Number(arg.split("=")[1]);
      if (Number.isFinite(maybePort) && maybePort > 0) {
        port = maybePort;
      }
      continue;
    }
    passthrough.push(arg);
  }

  return { port, passthrough };
}

function getPortOwner(port) {
  try {
    return execFileSync(
      "lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"],
      { encoding: "utf8" }
    ).trim();
  } catch {
    return "";
  }
}

async function prewarmRoutes(port) {
  const baseUrl = `http://127.0.0.1:${port}`;
  const warmupTargets = [
    "/metame/runtime",
    "/studio/composer",
    "/content/demo",
  ];

  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      await fetch(`${baseUrl}/`, { cache: "no-store", redirect: "manual" });
      break;
    } catch {
      await sleep(1000);
    }
  }

  for (const route of warmupTargets) {
    try {
      await fetch(`${baseUrl}${route}`, { cache: "no-store", redirect: "manual" });
    } catch {
      // Ignore; this is opportunistic warmup only.
    }
  }

  console.log(`[dev] Prewarmed: ${warmupTargets.join(", ")}`);
}

async function main() {
  const { port, passthrough } = parseArgs(process.argv.slice(2));
  const owner = getPortOwner(port);

  if (owner) {
    console.error(`[dev] Port ${port} is already in use. Stop that process or use: npm run dev -- --port <port>`);
    console.error(`[dev] Listener:\n${owner.split("\n").slice(0, 3).join("\n")}`);
    process.exit(1);
  }

  const nextBin = path.resolve("node_modules/next/dist/bin/next");
  const child = spawn(
    process.execPath,
    [nextBin, "dev", "--port", String(port), ...passthrough],
    {
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
      stdio: "inherit",
    }
  );

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on("SIGINT", forwardSignal);
  process.on("SIGTERM", forwardSignal);
  process.on("SIGHUP", forwardSignal);

  void prewarmRoutes(port);

  child.on("exit", (code, signal) => {
    if (signal) {
      process.exit(1);
    }
    process.exit(code ?? 0);
  });
}

void main();
