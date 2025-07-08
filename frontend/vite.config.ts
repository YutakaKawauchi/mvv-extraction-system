import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/mvv-extraction-system/' : '/',
  server: {
    port: 5173,
    host: '0.0.0.0', // Allow access from any IP
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      }
    }
  }
})
