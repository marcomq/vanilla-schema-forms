import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Ensure polyfilled versions are used
      buffer: 'rollup-plugin-node-polyfills/polyfills/buffer-es6.js',
      process: 'rollup-plugin-node-polyfills/polyfills/process-es6.js',
      path: 'rollup-plugin-node-polyfills/polyfills/path.js',
      util: 'rollup-plugin-node-polyfills/polyfills/util.js'
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VanillaSchemaForms',
      fileName: (format) => `vanilla-schema-forms.${format}.js`
    },
    outDir: 'dist',
    sourcemap: true,
    commonjsOptions: {
      transformMixedEsModules: true
    },
    rollupOptions: {
      external: ['ajv', 'ajv/dist/2020.js', 'ajv-formats', '@apidevtools/json-schema-ref-parser'],
      output: {
        globals: {
          ajv: 'Ajv',
          'ajv/dist/2020.js': 'Ajv',
          'ajv-formats': 'AjvFormats',
          '@apidevtools/json-schema-ref-parser': 'RefParser'
        }
      }
    }
  },
  plugins: [
    nodePolyfills({
      include: ['buffer', 'path', 'process', 'util'],
      protocolImports: true,
      globals: {
        Buffer: true,
        process: true,
      }
    }),
    dts({
      rollupTypes: true
    })
  ]
});