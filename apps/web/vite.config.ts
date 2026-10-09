import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/eventdeck/' : '/',
  plugins: [react()],
  server: {
    proxy: {
      '/health': 'http://127.0.0.1:4732',
      '/api': 'http://127.0.0.1:4732',
      '/ws': { target: 'ws://127.0.0.1:4732', ws: true },
    },
  },
}))
