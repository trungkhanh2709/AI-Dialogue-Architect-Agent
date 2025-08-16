import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',
      },
    },
  },
  server: {
    fs: {
      allow: ['.'], // Cho phép đọc file trong project mà không đụng tới D:\
    }
  }
})
