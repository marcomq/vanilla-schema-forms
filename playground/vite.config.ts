import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  define: {
    global: 'globalThis'
  },
  plugins: [
    svelte(),
    nodePolyfills({
      include: ['buffer', 'path', 'process', 'util'],
      protocolImports: true,
      globals: {
        Buffer: true,
        process: true
      }
    })
  ],
  root: __dirname,
  base: './',
  resolve: {
    alias: {
      'vanilla-schema-forms': resolve(__dirname, '../src/index.ts')
    }
  },
  build: {
    outDir: '../docs',
    emptyOutDir: true,
    commonjsOptions: {
      transformMixedEsModules: true
    }
  }
});