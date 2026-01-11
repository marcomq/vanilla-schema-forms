import { defineConfig } from 'vite';
import { resolve } from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import fs from 'fs';

export default defineConfig({
  plugins: [
    nodePolyfills({
      include: ['buffer', 'path'],
    }),
    {
      name: 'generate-dist-example',
      closeBundle() {
        const exampleDir = resolve(process.cwd(), 'example');
        
        // 1. Generate customization.dist.js
        try {
          const customizationSrc = fs.readFileSync(resolve(exampleDir, 'customization.js'), 'utf-8');
          const distImport = "import { renderObject, renderProperties, templates, setI18n, setConfig } from '../dist/json-schema-mapper.js';";
          
          const customizationDist = [
              distImport,
              ...customizationSrc.split('\n').filter(line => !line.trim().startsWith('import') || !line.includes('../src/'))
          ].join('\n');
          
          fs.writeFileSync(resolve(exampleDir, 'customization.dist.js'), customizationDist);
          console.log('Generated example/customization.dist.js');
        } catch (e) {
          console.warn('Could not generate customization.dist.js:', e);
        }

        // 2. Generate index.dist.html
        try {
          const indexSrc = fs.readFileSync(resolve(exampleDir, 'index.html'), 'utf-8');
          const corsComment = `<!-- 
  NOTE: To run this example, you must serve the project root via a local HTTP server 
  to avoid CORS errors with ES modules (file:// protocol is not supported).
  
  Example:
  1. Build the library: npx vite build -c vite.lib.config.ts
  2. Run server in project root: npx http-server .
  3. Open http://127.0.0.1:8080/example/index.dist.html
-->`;
          
          let indexDist = indexSrc
              .replace('<!DOCTYPE html>', `<!DOCTYPE html>\n${corsComment}`)
              .replace('<title>JSON Schema Mapper Example</title>', '<title>JSON Schema Mapper Example (Dist)</title>')
              .replace('<h2 class="mb-4">Form</h2>', '<h2 class="mb-4">Form (Dist Build)</h2>')
              .replace("from '../src/index.ts'", "from '../dist/json-schema-mapper.js'")
              .replace("from './customization.js'", "from './customization.dist.js'");

          fs.writeFileSync(resolve(exampleDir, 'index.dist.html'), indexDist);
          console.log('Generated example/index.dist.html');
        } catch (e) {
          console.warn('Could not generate index.dist.html:', e);
        }
      }
    }
  ],
  build: {
    lib: {
      entry: resolve(process.cwd(), 'src/index.ts'),
      name: 'JsonSchemaMapper',
      fileName: 'json-schema-mapper',
    },
    outDir: 'dist',
    emptyOutDir: true
  }
});
