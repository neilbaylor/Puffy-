import { defineConfig } from 'vite';

// Bundles the world-sketch painter into one IIFE script for the sketches page.
export default defineConfig({
  build: {
    outDir: 'dist-sketches',
    emptyOutDir: true,
    lib: { entry: 'src/sketches/main.ts', name: 'Sketches', formats: ['iife'], fileName: () => 'sketches.js' },
  },
});
