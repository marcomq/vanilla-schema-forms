/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  root: 'example',
  plugins: [
    nodePolyfills({
      include: ['buffer', 'path'],
    })
  ],
  server: {
    fs: {
      allow: ['..']
    }
  },
  optimizeDeps: {
    include: ['@apidevtools/json-schema-ref-parser'],
  },
  test: {
    root: process.cwd(),
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
    exclude: ['playwright-tests/**'],
  }
});
