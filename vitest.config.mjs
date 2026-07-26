import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { existsSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load credentials — try .env.local first (standard), then .env.local.temp (sandbox fallback)
const envLocal = path.join(__dirname, ".env.local");
const envLocalTemp = path.join(__dirname, ".env.local.temp");
if (existsSync(envLocal)) {
  dotenv.config({ path: envLocal });
} else if (existsSync(envLocalTemp)) {
  dotenv.config({ path: envLocalTemp });
}

export default defineConfig({
  // tsconfig.json sets `jsx: "preserve"` for Next.js, which leaves .tsx
  // untransformed for Vite -- so ANY test importing a component failed to
  // COLLECT with "content contains invalid JS syntax", reported at the first
  // JSX close tag. That silently hid whole suites (bearing-instrument,
  // meta-vitruvian) behind what looked like a syntax error in shipped code.
  //
  // Overriding the transform HERE affects the test runner only; the Next.js
  // production build keeps `preserve` and its own JSX handling.
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    // DEFAULT SUITE = unit tests only. `npm test` must be runnable from a
    // clean checkout with NO external services (operator-ratified 2026-07-25).
    //
    // Tests that genuinely cross a process or network boundary -- live HTTP
    // servers, deployed APIs, databases the test does not provision, partner
    // services, canisters, remote auth -- are named `*.integration.test.ts`
    // and run via `npm run test:integration`.
    //
    // The guardrail that made this necessary: ~90 environment-absence failures
    // were drowning 16 real unit failures, so the suite could not distinguish
    // "the code is broken" from "the test environment is absent". A test is
    // moved because it crosses a boundary, NEVER because it currently fails.
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
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
