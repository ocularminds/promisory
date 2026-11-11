import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  ssr: { noExternal: [/^@promisory\//] },
  build: {
    target: "node22",
    ssr: resolve(import.meta.dirname, "src/server.ts"),
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: { output: { entryFileNames: "server.js" } },
  },
});
