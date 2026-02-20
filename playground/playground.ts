import { 
  init, 
  setConfig, 
  resetConfig,
  resetCustomRenderers,
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
  getName,
  renderCompactFieldWrapper,
  createTypeSelectArrayRenderer,
  createAdvancedOptionsRenderer,
  createOptionalRenderer,
  hydrateNodeWithData
} from '../src/index';
import complexSchema from './schema.json';
// @ts-ignore
import complexCustomization from './customization.js?raw'; // ?raw supported by vite
// Svelte is just required for the svelte example
// @ts-ignore 
import RangeWidget from './RangeWidget.svelte';
// @ts-ignore 
import InputWidget from './InputWidget.svelte';
// @ts-ignore
import { mount } from 'svelte';

/**
 * Creates a custom renderer that wraps a Svelte component.
 * The component is expected to receive the following props:
 * - elementId: the ID of the HTML element to render into
 * - node: the FormNode object to render
 * - value: the default value of the node (can be null)
 * - name: the name of the property to render (i.e. the key of the FormNode)
 * The renderer returns the rendered HTML element.
 * If the component renders a single child, that child is returned directly.
 * Otherwise, the entire container is returned.
 */
function createSvelteRenderer(Component: any) {
  return {
    render: (node: any, path: string, elementId: string, dataPath: (string | number)[]) => {
      const tempContainer = document.createElement('div');
      mount(Component, {
        target: tempContainer,
        props: {
          elementId,
          node,
          value: node.defaultValue,
          name: getName(dataPath)
        }
      });
      return tempContainer.childElementCount === 1 ? (tempContainer.firstElementChild as Node) : tempContainer;
    }
  };
}

// --- Default Examples ---
const EXAMPLES: Record<string, { schema: any, config: any, data: any }> = {
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
  simple2: {
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
    config: `// Override renderFieldWrapper -> compact
const originalRenderer = domRenderer.renderFieldWrapper;
domRenderer.renderFieldWrapper = (node, elementId, inputElement, wrapperClass) => {
  if (["string", "number", "integer", "boolean"].includes(node.type) || node.enum) {
    return renderCompactFieldWrapper(node, elementId, inputElement);
  }
  return originalRenderer(node, elementId, inputElement, wrapperClass);
};`,
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
    config: `import RangeWidget from './RangeWidget.svelte';
import InputWidget from './InputWidget.svelte';
import { mount } from 'svelte';
import { setCustomRenderers } from "../src/index";
// we are just customizing title and priority, the rest is handled by default
setCustomRenderers({
  title: createSvelteRenderer(InputWidget),
  priority: createSvelteRenderer(RangeWidget)
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
  },
  complex: {
    schema: complexSchema,
    config: complexCustomization,
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

/**
 * Resets all global library state that might be modified by a config script.
 * This is crucial for the playground to prevent configs from leaking between examples.
 */
function resetAll() {
  resetConfig();
  resetI18n();
  resetCustomRenderers();
  domRenderer.renderFieldWrapper = originalRenderFieldWrapper;
}

// --- Logic ---

async function loadExample(key: string) {
  let ex = EXAMPLES[key];
  if (!ex) {
    console.error(`Unknown example: ${key}`);
    return;
  }
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
    } catch {
      let code = els.config.value;
      // Support for copy-pasting from JS modules (strip imports/exports)
      code = code.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, "");
      code = code.replace(/export\s+default\s+/g, "return ");
      code = code.replace(/export\s+/g, "");

      const fn = new Function(
        "h",
        "RangeWidget",
        "InputWidget",
        "mount",
        "createSvelteRenderer",
        "renderObject",
        "renderProperties",
        "renderNode",
        "getName",
        "resolvePath",
        "generateDefaultData",
        "domRenderer",
        "setI18n",
        "setConfig",
        "setCustomRenderers",
        "renderCompactFieldWrapper",
        "createTypeSelectArrayRenderer",
        "createAdvancedOptionsRenderer",
        "createOptionalRenderer",
        "hydrateNodeWithData",
        code,
      );
      config = fn(
        h,
        RangeWidget,
        InputWidget,
        mount,
        createSvelteRenderer,
        renderObject,
        renderProperties,
        renderNode,
        getName,
        resolvePath,
        generateDefaultData,
        domRenderer,
        setI18n,
        setConfig,
        setCustomRenderers,
        renderCompactFieldWrapper,
        createTypeSelectArrayRenderer,
        createAdvancedOptionsRenderer,
        createOptionalRenderer,
        hydrateNodeWithData,
      );
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
    }).catch((err: any) => {
      els.errors.textContent = "Validation error: " + String(err);
      els.errors.className = "alert alert-danger border";
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
  simple: "Simple Object (Default)",
  simple2: "Simple Object, compact layout",
  svelte: "Svelte Renderers",
  arrays: "Arrays",
  complex: "Complex"
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
loadExample('simple');
