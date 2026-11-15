import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client',
  // Everything in assets/ is served as-is, so the game can load assets/maps/x.json as "maps/x.json".
  publicDir: '../assets',
  server: {
    // The client imports rule code from ../shared, which sits outside `root`.
    fs: { allow: ['..'] },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Two pages: the game (index.html) and the rules sandbox (sandbox.html).
    rollupOptions: {
      input: { main: 'client/index.html', sandbox: 'client/sandbox.html' },
    },
    // Phaser is one large library (about 1.2 MB), which is expected.
    chunkSizeWarningLimit: 1600,
  },
});
