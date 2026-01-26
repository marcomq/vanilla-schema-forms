import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import dts from 'vite-plugin-dts';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// https://vitejs.dev/guide/build.html#library-mode
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VanillaSchemaForms', // The global variable for the UMD build
      formats: ['es', 'umd'],
      fileName: (format) => `vanilla-schema-forms.${format}.js`,
    },
    rollupOptions: {
      // Externalize peer dependencies that consumers are likely to have.
      // @apidevtools/json-schema-ref-parser is bundled in to simplify UMD usage.
      external: ['validator-ajv-plus'],
      output: {
        // Global variables for UMD build for externalized deps
        globals: {
          'validator-ajv-plus': 'ValidatorAjvPlus',
        },
      },
    },
    sourcemap: true,
  },
  plugins: [
    // This plugin is needed because @apidevtools/json-schema-ref-parser uses node built-ins.
    nodePolyfills({
      include: ['buffer', 'path'],
    }),
    dts({ insertTypesEntry: true }),
  ],
});