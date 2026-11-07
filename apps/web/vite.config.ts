import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // 127.0.0.1 not localhost, windows can resolve localhost to ipv6 where flask is not listening
    proxy: { '/api': 'http://127.0.0.1:5001' },
  },
})
