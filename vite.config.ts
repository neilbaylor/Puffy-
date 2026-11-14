import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` -> normal multi-file build in dist/
// `npm run build:single` -> one self-contained HTML file (easy to share / host anywhere)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [],
  // Phaser without the Matter physics engine (the game only uses Arcade physics): ~110 kB less
  // code for phones to download and parse at start-up
  resolve: { alias: [{ find: /^phaser$/, replacement: 'phaser/dist/phaser-arcade-physics.js' }] },
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
  },
}));
