/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';

export default defineConfig(async () => {
  let svelte;
  try {
    svelte = (await import('@sveltejs/vite-plugin-svelte')).svelte;
  } catch (e) {
    console.warn('Svelte plugin not found. Skipping Svelte configuration.');
  }

  return {
  root: 'example',
  plugins: [
    nodePolyfills({
      include: ['buffer', 'path'],
    }),
    svelte ? svelte() : null
  ],
  server: {
    fs: {
      allow: ['..']
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'example/index.html'),
        playground: resolve(process.cwd(), 'example/playground/index.html'),
      },
    },
  },
  optimizeDeps: {
    include: ['@apidevtools/json-schema-ref-parser'],
  },
  test: {
    root: process.cwd(),
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
    exclude: ['playwright-tests/**'],
  },
  };
});
