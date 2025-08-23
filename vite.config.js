import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'src/injectToolbar.jsx'),
      output: {
        format: 'iife',      // phải IIFE để inject vào page
        name: 'ToolbarApp',  // biến global
        entryFileNames: 'main.js'
      }
    },
    target: 'es2017',
    minify: false,
    server: {
    port: 5173,
    strictPort: true,
  },
  }
})
