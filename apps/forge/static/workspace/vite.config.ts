import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  resolve: { dedupe: ["react", "react-dom"] },
  publicDir: fileURLToPath(
    new URL("../../../../packages/design-system/brand", import.meta.url),
  ),
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
  server: {
    fs: { allow: [fileURLToPath(new URL("../../../..", import.meta.url))] },
  },
});
