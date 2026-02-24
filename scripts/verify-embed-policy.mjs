#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const policyPath = path.join(repoRoot, "configs", "embed", "policy.v1.json");
const middlewarePath = path.join(repoRoot, "middleware.ts");
const bridgePath = path.join(
  repoRoot,
  "app",
  "(embed)",
  "triad",
  "embed",
  "codex",
  "_lib",
  "useCodexEmbedAuthBridge.ts"
);

function fail(message) {
  console.error(`[verify-embed-policy] ${message}`);
  process.exitCode = 1;
}

const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
const expectedCsp = `frame-ancestors ${policy.frameAncestors.join(" ")};`;

const nextConfig = await import(path.join(repoRoot, "next.config.js"));
const resolvedNextConfig = nextConfig.default || nextConfig;
if (!resolvedNextConfig || typeof resolvedNextConfig.headers !== "function") {
  fail("next.config.js does not expose headers() for verification.");
} else {
  const headersConfig = await resolvedNextConfig.headers();
  const embedRule = headersConfig.find((rule) => rule.source === "/triad/embed/:path*");
  if (!embedRule) {
    fail("next.config.js is missing /triad/embed/:path* header rule.");
  } else {
    const cspHeader = embedRule.headers?.find((header) => header.key === "Content-Security-Policy");
    if (!cspHeader) {
      fail("next.config.js embed rule is missing Content-Security-Policy header.");
    } else if (cspHeader.value !== expectedCsp) {
      fail("next.config.js embed CSP does not match configs/embed/policy.v1.json.");
    }
  }
}

const middlewareSource = fs.readFileSync(middlewarePath, "utf8");
if (!middlewareSource.includes("response.headers.set('Content-Security-Policy', EMBED_CSP);")) {
  fail("middleware.ts is not applying EMBED_CSP on embed routes.");
}
if (middlewareSource.includes("frame-ancestors 'self' https://qriptopian.lovable.app")) {
  fail("middleware.ts still contains legacy hardcoded Lovable-only frame-ancestors.");
}

const bridgeSource = fs.readFileSync(bridgePath, "utf8");
if (!bridgeSource.includes("import embedPolicy from \"@/configs/embed/policy.v1.json\"")) {
  fail("useCodexEmbedAuthBridge.ts must import shared embed policy json.");
}
if (!bridgeSource.includes("embedPolicy.authAllowedOrigins")) {
  fail("useCodexEmbedAuthBridge.ts is not using authAllowedOrigins from shared policy.");
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}

console.log("[verify-embed-policy] OK");
