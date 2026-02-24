#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const policy = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "configs", "embed", "policy.v1.json"), "utf8")
);

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/check-embed-headers.mjs <embed-url>");
  process.exit(1);
}

const response = await fetch(target, { method: "GET", redirect: "follow" });
const csp = response.headers.get("content-security-policy") || "";
const xfo = response.headers.get("x-frame-options");

if (!response.ok) {
  console.error(`[check-embed-headers] Request failed: ${response.status} ${response.statusText}`);
  process.exit(1);
}

if (xfo) {
  console.error(`[check-embed-headers] Unexpected x-frame-options header present: ${xfo}`);
  process.exit(1);
}

if (!csp.includes("frame-ancestors")) {
  console.error("[check-embed-headers] Missing frame-ancestors in Content-Security-Policy.");
  process.exit(1);
}

const requiredOrigins = policy.frameAncestors.filter((origin) => origin !== "'self'");
const missing = requiredOrigins.filter((origin) => !csp.includes(origin));
if (missing.length > 0) {
  console.error(`[check-embed-headers] CSP missing expected origins: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("[check-embed-headers] OK");
