import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    globals: true
  },
  resolve: {
    alias: {
      'vanilla-schema-forms': resolve(__dirname, 'src/index.ts')
    }
  }
});