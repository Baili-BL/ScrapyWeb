import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { apiPlugin } from './server/api-plugin.ts'

export default defineConfig({
  plugins: [react(), apiPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
})
