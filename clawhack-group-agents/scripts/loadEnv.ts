import path from "node:path";
import { existsSync } from "node:fs";
import dotenv from "dotenv";

let loaded = false;

export function loadEnv(): void {
  if (loaded) {
    return;
  }

  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, ".env.local"),
    path.join(cwd, ".env"),
    path.join(cwd, "..", ".env.local"),
    path.join(cwd, "..", ".env"),
  ];

  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
    }
  }

  loaded = true;
}

