import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "public",
  publicDir: "assets",
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: resolve("dist"),
    emptyOutDir: true,
    sourcemap: true,
  },
});
