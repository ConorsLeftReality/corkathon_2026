import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { radarMock } from './dev/radar-mock.ts'

// matteo/app.py, the filings api, runs on its own port beside the scaffold flask app
const FILINGS_API = process.env.FILINGS_API_URL ?? 'http://127.0.0.1:5000'
const FILINGS_PATHS = ['/api/report', '/api/companies', '/api/briefing', '/api/refresh']

export default defineConfig(({ mode }) => ({
  // bun run dev:mock stands in for both apis until the real ones are running
  plugins: [react(), tailwindcss(), ...(mode === 'mock' ? [radarMock()] : [])],
  server: {
    proxy: {
      // listed before /api so these win
      ...Object.fromEntries(FILINGS_PATHS.map((path) => [path, FILINGS_API])),
      // 127.0.0.1 not localhost, windows can resolve localhost to ipv6 where flask is not listening
      '/api': 'http://127.0.0.1:5001',
    },
  },
}))
