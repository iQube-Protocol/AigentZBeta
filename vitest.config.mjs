import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
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
