import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: resolve(__dirname, "src/injectToolbar.jsx"),
      output: {
        format: "iife", // Immediately Invoked Function Expression
        name: "ToolbarApp", // global variable name
        entryFileNames: "main.js",
      },
    },
    target: "es2017",
    minify: false,
    server: {
      port: 5173,
      strictPort: true,
    },
  },
});
