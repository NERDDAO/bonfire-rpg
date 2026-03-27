import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/game": {
        target: "http://localhost:9997",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:9997",
        ws: true,
      },
    },
  },
});
