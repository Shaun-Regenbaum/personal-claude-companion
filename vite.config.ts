import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3847,
    proxy: {
      '/api/events': {
        target: 'http://localhost:3848',
        changeOrigin: true,
        // SSE needs these to prevent buffering
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['cache-control'] = 'no-cache'
            proxyRes.headers['x-accel-buffering'] = 'no'
          })
        },
      },
      '/api': {
        target: 'http://localhost:3848',
        changeOrigin: true,
      },
    },
  },
})
