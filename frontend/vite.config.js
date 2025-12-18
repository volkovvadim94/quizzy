import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
      // (опционально) если хочешь, чтобы сокеты работали в деве через vite:
      // '/socket.io': {
      //   target: 'http://localhost:5001',
      //   ws: true,
      //   changeOrigin: true,
      // }
    },
  },
  build: {
    outDir: resolve(__dirname, '../backend/dist'),
    emptyOutDir: true,
  },
})
