import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@custom-clickup/shared": fileURLToPath(new URL("../shared/src/index.ts", import.meta.url))
    }
  },
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:4000",
      "/auth": "http://localhost:4000"
    }
  }
});
