import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  server: {
    // The client imports rule code from ../shared, which sits outside `root`.
    fs: { allow: ['..'] },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Phaser is one large library (about 1.2 MB), which is expected.
    chunkSizeWarningLimit: 1600,
  },
});
