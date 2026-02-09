import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VanillaSchemaForms',
      fileName: (format) => `vanilla-schema-forms.${format}.js`
    },
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      external: ['ajv'],
      output: {
        globals: {
          ajv: 'Ajv'
        }
      }
    }
  },
  optimizeDeps: {
    include: ['@apidevtools/json-schema-ref-parser'],
  },
  plugins: [
    dts({
      rollupTypes: true
    }),
    nodePolyfills({
      include: ['buffer', 'path'],
    })]
});