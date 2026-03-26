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
        // SSE: prevent proxy from buffering the streaming response
        selfHandleResponse: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Accept', 'text/event-stream')
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
