import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte(), nodePolyfills({
    include: ['buffer', 'path'],
  })],
  root: 'examples', // Since we run vite from the playground folder or with --config
  base: './', // Ensures assets work on GitHub Pages
  resolve: {
    alias: {
      // Develop against source, not dist
      'vanilla-schema-forms': resolve(__dirname, 'src/index.ts')
    }
  },
  build: {
    outDir: '../docs', // Output to docs/ for GitHub Pages
    emptyOutDir: true
  }
});