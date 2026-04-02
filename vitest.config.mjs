import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      // Integration tests — require a running dev server or Supabase env vars
      "tests/backend/api.test.ts",
      "tests/lvb-agq-integration.test.ts",
      "tests/partner-platform.test.ts",
      "tests/fio-integration.test.ts",
      "tests/crm-integration.test.ts",
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
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
