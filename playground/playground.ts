import { 
  init, 
  setConfig, 
  resetConfig, 
  resetI18n, 
  adaptUiSchema, 
  setCustomRenderers, 
  setI18n, 
  h, 
  renderObject, 
  renderProperties,
  generateDefaultData,
  renderNode,
  domRenderer, 
  resolvePath,
  getName
} from '../src/index';
import defaultSchema from './schema.json';
import defaultCustomization from './customization.js?raw'; // ?raw supported by vite
// @ts-ignore
import RangeWidget from './RangeWidget.svelte';
// @ts-ignore
import { mount } from 'svelte';

// --- Default Examples ---
const EXAMPLES: Record<string, { schema: any, config: any, data: any }> = {
  default: {
    schema: defaultSchema,
    config: defaultCustomization,
    data: {
      "Default Route": {
        "input": {
          "middlewares": [],
          "null": null
        },
        "output": {
          "middlewares": [],
          "null": null
        }
      }
    }
  },
  simple: {
    schema: {
      type: "object",
      title: "User Profile",
      properties: {
        firstName: { type: "string", title: "First Name" },
        lastName: { type: "string", title: "Last Name" },
        age: { type: "integer", title: "Age", minimum: 0 },
        isActive: { type: "boolean", title: "Is Active" }
      },
      required: ["firstName", "lastName"]
    },
    config: {},
    data: { firstName: "John", isActive: true }
  },
  svelte: {
    schema: {
      type: "object",
      title: "Svelte Configured Form",
      properties: {
        title: { type: "string", title: "Project Title" },
        description: { type: "string", title: "Description" },
        priority: { type: "integer", title: "Priority Level", minimum: 1, maximum: 10, default: 5 },
        meta: {
          type: "object",
          title: "Metadata",
          properties: {
            author: { type: "string", title: "Author" },
            tags: { type: "string", title: "Tags" }
          }
        }
      }
    },
    config: `import RangeWidget from '../RangeWidget.svelte';
import { mount } from 'svelte';
import { setCustomRenderers, getName } from "../src/index";
setCustomRenderers({
  priority: {
    render: (node, path, elementId, dataPath) => {
      // Create a temporary container to mount the Svelte component.
      const tempContainer = document.createElement('div');
      mount(RangeWidget, {
        target: tempContainer,
        props: {
          elementId,
          node,
          value: node.defaultValue,
          name: getName(dataPath)
        }
      });
      // If the component rendered a single root element, return it directly
      // to avoid an unnecessary wrapper div. Otherwise, return the container.
      return tempContainer.childElementCount === 1 ? tempContainer.firstElementChild : tempContainer;
    }
  }
});`,
    data: {}
  },
  arrays: {
    schema: {
      type: "object",
      title: "Task List",
      properties: {
        title: { type: "string" },
        tags: { 
          type: "array", 
          items: { type: "string", enum: ["work", "home", "urgent"] } 
        },
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              done: { type: "boolean" }
            }
          }
        }
      }
    },
    config: {},
    data: {}
  }
};

// --- DOM Elements ---
const els = {
  schema: document.getElementById('input-schema') as HTMLTextAreaElement,
  config: document.getElementById('input-config') as HTMLTextAreaElement,
  data: document.getElementById('input-data') as HTMLTextAreaElement,
  output: document.getElementById('output-data') as HTMLElement,
  errors: document.getElementById('validation-errors') as HTMLElement,
  btnRender: document.getElementById('btn-render') as HTMLButtonElement,
  selector: document.getElementById('example-selector') as HTMLSelectElement,
};

// --- State Management for Playground ---

// Store the original renderer functions to reset monkey-patching
const originalRenderFieldWrapper = domRenderer.renderFieldWrapper;

// Keys from customization.js to reset custom renderers
const customRendererKeys = [
  "tls", "routes", "middlewares", "output.mode", "value",
  "aws", "kafka", "nats", "file", "static", "memory", "amqp", 
  "mongodb", "mqtt", "http", "ibmmq", "zeromq", "switch", 
  "response", "custom"
];
const renderersToReset = Object.fromEntries(customRendererKeys.map(k => [k, {} as any]));

/**
 * Resets all global library state that might be modified by a config script.
 * This is crucial for the playground to prevent configs from leaking between examples.
 */
function resetAll() {
  resetConfig();
  resetI18n();
  setCustomRenderers(renderersToReset); // Effectively clears the custom renderers
  domRenderer.renderFieldWrapper = originalRenderFieldWrapper;
}

// --- Logic ---

async function loadExample(key: string) {
  let ex = EXAMPLES[key];
  els.schema.value = JSON.stringify(ex.schema, null, 2);
  els.config.value = typeof ex.config === 'string' ? ex.config : JSON.stringify(ex.config, null, 2);
  els.data.value = JSON.stringify(ex.data, null, 2);
  
  render();
}

async function render() {
  // 1. Reset Global State
  resetAll();

  // 2. Parse Inputs
  let schema, config, initialData;
  try {
    schema = JSON.parse(els.schema.value);
    initialData = els.data.value ? JSON.parse(els.data.value) : undefined;

    // Try parsing config as JSON, fallback to JS eval
    try {
      config = els.config.value ? JSON.parse(els.config.value) : {};
      console.log("json found");
    } catch {

      let code = els.config.value;
      // Support for copy-pasting from JS modules (strip imports/exports)
      code = code.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '');
      code = code.replace(/export\s+default\s+/g, 'return ');
      code = code.replace(/export\s+/g, '');
      
      try {
        // Try as expression (wrapped in parens to ensure it's an expression, not a block, and to fail on multiple statements)
        const fn = new Function('h', 'renderObject', 'renderProperties', 'renderNode', 'getName', 'resolvePath', 'generateDefaultData', 'domRenderer', 'setI18n', 'setConfig', 'setCustomRenderers', 'RangeWidget', 'mount', `return (${code});`);
        config = fn(h, renderObject, renderProperties, renderNode, getName, resolvePath, generateDefaultData, domRenderer, setI18n, setConfig, setCustomRenderers, RangeWidget, mount);
        console.log("js 1 found");
      } catch (e) {
        // code += "\nif (typeof CUSTOM_RENDERERS !== 'undefined') { setCustomRenderers(CUSTOM_RENDERERS); }";
        const fn = new Function('h', 'renderObject', 'renderProperties', 'renderNode', 'getName', 'resolvePath', 'generateDefaultData', 'domRenderer', 'setI18n', 'setConfig', 'setCustomRenderers', 'RangeWidget', 'mount', code);
        config = fn(h, renderObject, renderProperties, renderNode, getName, resolvePath, generateDefaultData, domRenderer, setI18n, setConfig, setCustomRenderers, RangeWidget, mount);
        console.log("js 2 found");
      }
      console.log(config);
    }
  } catch (e) {
    alert("Invalid JSON or JS in one of the editors: " + `${e}`,);
    return;
  }

  // 3. Apply Config
  // Check if it's a wrapper object with renderers/i18n
  let uiConfig = config || {};
  if (uiConfig.renderers || uiConfig.i18n || uiConfig.config) {
    if (uiConfig.renderers) setCustomRenderers(uiConfig.renderers);
    if (uiConfig.i18n) setI18n(uiConfig.i18n);
    uiConfig = uiConfig.config || {};
  }

  if (uiConfig.uiSchema) {
    adaptUiSchema(uiConfig.uiSchema, schema.title || "root");
  }
  // Merge other config options if present
  setConfig(uiConfig);

  // 4. Initialize Form
  let form: any;
  const updateValidation = () => {
    if (!form) return;
    form.validate().then((errors: any) => {
      els.errors.textContent = errors ? JSON.stringify(errors, null, 2) : "Valid";
      els.errors.className = errors ? "alert alert-danger border" : "alert alert-success border";
    });
  };

  form = await init('form-container', schema, initialData, (newData) => {
    els.output.textContent = JSON.stringify(newData, null, 2);
    updateValidation();
  });
  updateValidation();
}

// --- Event Listeners ---
els.btnRender.addEventListener('click', render);

// Populate selector options dynamically
const optionMap: Record<string, string> = {
  default: "Complex (Default)",
  simple: "Simple Object",
  svelte: "Custom Renderers (Svelte Style)",
  arrays: "Arrays"
};
els.selector.innerHTML = '';
Object.keys(EXAMPLES).forEach(key => {
  const option = document.createElement('option');
  option.value = key;
  option.textContent = optionMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
  els.selector.appendChild(option);
});

els.selector.addEventListener('change', (e) => {
  loadExample((e.target as HTMLSelectElement).value);
});

// Initial Load
loadExample('default');
