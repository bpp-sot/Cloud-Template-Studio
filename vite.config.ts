import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages base path is configurable via the VITE_BASE_PATH env var.
// For a project site at https://bpp-sot.github.io/Cloud-Template-Studio/, set
// VITE_BASE_PATH=/Cloud-Template-Studio/ during the deploy build.
// Locally the default is "/" so `npm run dev` works out of the box.
const basePath = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
  plugins: [react()],
  base: basePath,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@data': fileURLToPath(new URL('./src/data', import.meta.url)),
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
      '@types': fileURLToPath(new URL('./src/types', import.meta.url)),
    },
  },
});
