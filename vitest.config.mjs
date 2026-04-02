import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { existsSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load credentials from .env.local.temp if present (not committed to repo)
const envFile = path.join(__dirname, ".env.local.temp");
if (existsSync(envFile)) {
  dotenv.config({ path: envFile });
}

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      // Live dev server for HTTP integration tests
      TEST_BASE_URL: process.env.TEST_BASE_URL || "https://dev-beta.aigentz.me",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@metame/aa-client": path.resolve(__dirname, "./packages/aa-client/src/index.ts"),
      "@metame/browser-contracts": path.resolve(__dirname, "./packages/browser-contracts/src/index.ts"),
      "@metame/iframe-bridge": path.resolve(__dirname, "./packages/iframe-bridge/src/index.ts"),
    },
  },
});
