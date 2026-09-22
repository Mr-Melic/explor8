import { fileURLToPath, URL } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Test-only Vite configuration.
 *
 * The production `vite.config.js` is left untouched: it injects deploy-time
 * environment variables and a dev proxy that a jsdom run neither needs nor can
 * satisfy. This config mirrors only the two aliases the app's own imports rely
 * on (`@` and `declarations`) so component modules resolve exactly as they do
 * in the built app.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "declarations",
        replacement: fileURLToPath(new URL("../declarations", import.meta.url)),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
    ],
    dedupe: ["@icp-sdk/core"],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    restoreMocks: true,
    // The build image pins conflicting thread counts in the ambient
    // environment; the forks pool sidesteps that and is the safer default for
    // jsdom component tests anyway.
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
