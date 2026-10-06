import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    // Route and data tests run in Node; component tests opt into jsdom with
    // a `// @vitest-environment jsdom` comment at the top of the file.
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    restoreMocks: true,
    // next-intl imports "next/server" without a file extension, which only
    // resolves when Vite bundles it rather than leaving it to Node.
    server: { deps: { inline: ["next-intl"] } },
  },
});
