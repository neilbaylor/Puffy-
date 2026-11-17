import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { offline } from './scripts/offline-plugin';

/**
 * The page starts with a tiny script (src/entry.ts) that lets the loading screen paint before it
 * runs the game's code; that code is fetched from the very start all the same (a modulepreload in
 * the page), not only once the first script asks for it. The loading screen's font too (a preload:
 * otherwise it's only asked for once the page's styles are in).
 */
const preloadGame: Plugin = {
  name: 'preload-game',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (_html, { chunk, bundle }) => [
      ...(chunk?.dynamicImports ?? []).map((file) => ({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: '', href: `./${file}` }, injectTo: 'head' as const })),
      ...Object.keys(bundle ?? {})
        .filter((file) => /\/lilita-one-latin-[\w-]{8}\.woff2$/.test(file))
        .map((file) => ({ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: '', href: `./${file}` }, injectTo: 'head' as const })),
    ],
  },
};

// `npm run build` -> normal multi-file build in dist/
// `npm run build:single` -> one self-contained HTML file (easy to share / host anywhere)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile()] : [preloadGame, offline()],
  // Phaser without the Matter physics engine (the game only uses Arcade physics): ~110 kB less
  // code for phones to download and parse at start-up
  resolve: { alias: [{ find: /^phaser$/, replacement: 'phaser/dist/phaser-arcade-physics.js' }] },
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
  },
}));
