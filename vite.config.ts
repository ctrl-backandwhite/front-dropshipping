import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3003,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:18082',
        changeOrigin: true,
      },
      '/oauth2': {
        target: 'http://localhost:18082',
        changeOrigin: true,
      },
      '/login/oauth2': {
        target: 'http://localhost:18082',
        changeOrigin: true,
      },
      '/.well-known': {
        target: 'http://localhost:18082',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3003,
    strictPort: true,
  },
})
