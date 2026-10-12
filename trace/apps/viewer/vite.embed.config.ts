import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The trace view for pages without a build step (docs/SPEC.md 17.6): src/embed.tsx as one classic
// script that sets window.HubTrace, React included, CSS inlined. It is written into the observatory's
// vendor folder and committed with it, so the observatory works without building anything.
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: fileURLToPath(new URL('../../../hub/vendor', import.meta.url)),
    emptyOutDir: false,
    copyPublicDir: false,
    chunkSizeWarningLimit: 2000,
    lib: {
      entry: fileURLToPath(new URL('src/embed.tsx', import.meta.url)),
      name: 'HubTrace',
      formats: ['iife'],
      fileName: () => 'hub-trace.js',
    },
  },
});
