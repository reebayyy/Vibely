import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward API and uploaded images to the Express server.
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
      // Socket.IO uses WebSockets (and HTTP polling as a fallback).
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
})
