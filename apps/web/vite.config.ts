import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { radarMock } from './dev/radar-mock.ts'

export default defineConfig(({ mode }) => ({
  // bun run dev:mock stands in for the radar api until the real one lands
  plugins: [react(), tailwindcss(), ...(mode === 'mock' ? [radarMock()] : [])],
  server: {
    // 127.0.0.1 not localhost, windows can resolve localhost to ipv6 where flask is not listening
    proxy: { '/api': 'http://127.0.0.1:5001' },
  },
}))
