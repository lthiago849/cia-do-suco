import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(() => {
  const basePath = process.env.VITE_BASEPATH || "/";

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: "0.0.0.0",
    },
    base: basePath,
    build: {
      chunkSizeWarningLimit: 2000,
    },
  };
});
