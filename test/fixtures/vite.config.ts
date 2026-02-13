import { defineConfig } from 'vite';
import { resolve } from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['buffer', 'path'],
      globals: { Buffer: true }
    })
  ],
  root: '.', // Since we run vite from the playground folder or with --config
  publicDir: resolve(__dirname, '../../dist'),
  base: './', // Ensures assets work on GitHub Pages
  resolve: {
    alias: {
      // Develop against source, not dist
      'vanilla-schema-forms': resolve(__dirname, '../../src/index.ts')
    }
  },
  build: {
    outDir: '../docs', // Output to docs/ for GitHub Pages
    emptyOutDir: true
  }
});