import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Served by the local service at /trace/. In development the API comes from a running
// `npm run serve` (port 8790); changeOrigin makes the proxied Host pass the service's Host check.
export default defineConfig({
  base: '/trace/',
  plugins: [react()],
  server: {
    port: 5178,
    proxy: { '/api': { target: 'http://127.0.0.1:8790', changeOrigin: true } },
  },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1500 },
});
