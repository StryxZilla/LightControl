import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@core': path.resolve(__dirname, '../../packages/core/src'),
      '@adapters': path.resolve(__dirname, '../../packages/adapters/src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
