import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/popup.jsx"),
        toolbar: resolve(__dirname, "src/injectToolbar.jsx"),
      },
      output: {
        entryFileNames: "[name].js",
        format: "es",
      },
    },
  },
});
