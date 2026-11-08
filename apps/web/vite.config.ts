import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { radarMock } from './dev/radar-mock.ts'

export default defineConfig(({ mode }) => ({
  // bun run dev:mock stands in for the radar api with placeholder data
  plugins: [react(), tailwindcss(), ...(mode === 'mock' ? [radarMock()] : [])],
  server: {
    proxy: {
      // 127.0.0.1 not localhost, windows can resolve localhost to ipv6 where flask is not listening
      '/api': 'http://127.0.0.1:5001',
    },
  },
}))
