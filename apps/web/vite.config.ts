import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { radarMock } from './dev/radar-mock.ts'

// the filings routes live in apps/api like everything else under /api
// set FILINGS_API_URL to send them to matteo/app.py running on its own instead
const FILINGS_API = process.env.FILINGS_API_URL
const FILINGS_PATHS = ['/api/report', '/api/companies', '/api/briefing', '/api/refresh']
const FILINGS_TOKEN = process.env.FILINGS_TOKEN

function filingsProxy(target: string) {
  return {
    target,
    // the filings app only answers requests whose host header names it, so send its own
    changeOrigin: true,
    ...(FILINGS_TOKEN ? { headers: { 'X-Filings-Token': FILINGS_TOKEN } } : {}),
  }
}

export default defineConfig(({ mode }) => ({
  // bun run dev:mock stands in for the apis until the real ones are running
  plugins: [react(), tailwindcss(), ...(mode === 'mock' ? [radarMock()] : [])],
  server: {
    proxy: {
      // listed before /api so these win
      ...(FILINGS_API
        ? Object.fromEntries(FILINGS_PATHS.map((path) => [path, filingsProxy(FILINGS_API)]))
        : {}),
      // 127.0.0.1 not localhost, windows can resolve localhost to ipv6 where flask is not listening
      '/api': 'http://127.0.0.1:5001',
    },
  },
}))
