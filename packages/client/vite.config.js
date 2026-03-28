import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          ethers: ["ethers"],
          leaflet: ["leaflet", "react-leaflet"],
        },
      },
    },
  },
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
      "/ws/game": {
        target: "ws://localhost:9997",
        ws: true,
      },
    },
  },
});
