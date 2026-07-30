import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiProxy = {
  "/api": {
    target: process.env.API_URL ?? "http://localhost:4100",
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ""),
  },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 3100, proxy: apiProxy },
  preview: { port: 3100, proxy: apiProxy },
});
