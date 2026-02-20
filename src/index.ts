import { parseSchema } from "./core/parser";
import { renderForm, hydrateNodeWithData, DEFAULT_CUSTOM_RENDERERS } from "./vanilla-renderer/renderer";
import { type CustomRenderer, RenderContext } from "./vanilla-renderer/types";
import { generateDefaultData } from "./core/form-data-reader";
import { Store } from "./core/state";
import { CONFIG } from "./core/config";
import { domRenderer, rendererConfig, renderCompactFieldWrapper } from "./vanilla-renderer/dom-renderer";
import { validateAndShowErrors, resolvePath } from "./vanilla-renderer/events";

export { setConfig, resetConfig } from "./core/config";
export { setI18n, resetI18n } from "./core/i18n";
export { 
  renderNode, 
  renderObject, 
  renderProperties, 
  getName,
  createTypeSelectArrayRenderer,
  createAdvancedOptionsRenderer,
  createOptionalRenderer,
  hydrateNodeWithData
} from "./vanilla-renderer/renderer";
export type { RenderContext, CustomRenderer } from "./vanilla-renderer/types";
export { generateDefaultData } from "./core/form-data-reader";
export { adaptUiSchema } from "./core/ui-schema-adapter";
export { h } from "./vanilla-renderer/hyperscript";
export { domRenderer, rendererConfig, renderCompactFieldWrapper };
export { validateAndShowErrors, resolvePath };
export { parseSchema } from "./core/parser";
export { Store } from "./core/state";
export type { FormNode } from "./core/types";

let globalCustomRenderers: Record<string, CustomRenderer<any>> = {};

export function setCustomRenderers(renderers: Record<string, CustomRenderer<any>>) {
  globalCustomRenderers = { ...globalCustomRenderers, ...renderers };
}

export function resetCustomRenderers() {
  globalCustomRenderers = {};
}

export interface RenderOptions {
  subSchemaPath?: string;
}

/**
 * Initializes the core form logic (parsing, data hydration, state) without rendering to the DOM.
 * This is useful for creating custom renderers (e.g. React, Vue) that consume the core logic.
 */
export async function createForm(
  schemaOrUrl: string | any, 
  initialData?: any, 
  renderOptions?: RenderOptions
) {
  let schema = schemaOrUrl;
  let data = initialData;

  if (renderOptions?.subSchemaPath) {
    // Ensure schema is an object before traversing
    let schemaObj = typeof schema === 'string' ? await (await fetch(schema)).json() : schema;
    
    const pathParts = renderOptions.subSchemaPath.split('.');
    let subSchema: any = schemaObj;
    let subData: any = data;

    for (const part of pathParts) {
      // This traversal logic is simplistic and assumes a path of properties.
      if (subSchema && subSchema.properties && subSchema.properties[part]) {
        subSchema = subSchema.properties[part];
        if (subData && typeof subData === 'object' && subData !== null && subData[part] !== undefined) {
          subData = subData[part];
        } else {
          subData = undefined;
        }
      } else {
        subSchema = undefined;
        break;
      }
    }

    if (subSchema) {
      schema = subSchema;
      data = subData;
    } else {
      throw new Error(`Error: sub-schema path "${renderOptions.subSchemaPath}" not found.`);
    }
  }

  let rootNode = await parseSchema(schema);

  // Hydrate with initial data if provided, otherwise generate defaults
  const finalData = data !== undefined ? data : generateDefaultData(rootNode);
  
  // Pre-hydrate the root node so the renderer knows about default values (important for arrays/oneOf)
  if (finalData !== undefined) {
    rootNode = hydrateNodeWithData(rootNode, finalData);
  }

  const store = new Store<Record<string, any>>({});
  
  // Initialize store
  store.reset(finalData);

  return { rootNode, store, finalData };
}

/**
 * Initializes the form in the specified container.
 * 
 * @param containerOrId - The ID of the HTML element or the element itself to render the form into.
 * @param schemaOrUrl - The JSON schema object or a URL to fetch it from.
 * @param initialData - Optional initial data to populate the form with.
 * @param onDataChange - Optional callback invoked whenever the form data changes.
 * @returns An object containing the parsed root node and a function to get the current data.
 */
export async function init(
  containerOrId: string | HTMLElement, 
  schemaOrUrl: string | any, 
  initialDataOrCallback?: any, 
  onDataChangeCallback?: (data: any) => void,
  renderOptions?: RenderOptions
) {
  let initialData: any = undefined;
  let onDataChange: ((data: any) => void) | undefined = undefined;

  if (typeof initialDataOrCallback === 'function') {
    onDataChange = initialDataOrCallback;
  } else {
    initialData = initialDataOrCallback;
    onDataChange = onDataChangeCallback;
  }

  const formContainer = typeof containerOrId === 'string' ? document.getElementById(containerOrId) : containerOrId;

  if (!formContainer) {
    console.error(`Required DOM element ${typeof containerOrId === 'string' ? '#' + containerOrId : ''} not found.`);
    return;
  }

  try {
    const { rootNode, store, finalData } = await createForm(schemaOrUrl, initialData, renderOptions);
    
    const context: RenderContext = {
      store,
      rootNode,
      config: CONFIG,
      nodeRegistry: new Map(),
      dataPathRegistry: new Map(),
      elementIdToDataPath: new Map(),
      customRenderers: { ...DEFAULT_CUSTOM_RENDERERS, ...globalCustomRenderers },
    };

    // Render the form
    renderForm(formContainer, context);

    // Subscribe to store changes
    store.subscribe((data) => {
      if (onDataChange) {
        onDataChange(data);
      }
    });

    // Trigger initial data change
    if (typeof onDataChange === 'function' && finalData !== undefined) {
      onDataChange(finalData);
    }

    const setData = (newData: any) => {
      // To ensure UI consistency (especially for arrays/oneOf), we re-render on programmatic set.
      context.rootNode = hydrateNodeWithData(rootNode, newData);
      renderForm(formContainer, context);
      store.reset(newData);
    }

    return {
      rootNode,
      getData: () => store.get(),
      setData,
      validate: async () => {
        // This validates the data and displays errors in the form UI.
        return validateAndShowErrors(context);
      }
    };
    
  } catch (error) {
    formContainer.innerHTML = '';
    formContainer.appendChild(domRenderer.renderSchemaError(error));
    console.error(error);
  }
}

/**
 * Initializes the form and links it to an output element (textarea, input, or div).
 * This is useful for:
 * - Debugging (displaying JSON in a div/pre)
 * - Form submission (syncing JSON to a hidden input)
 * 
 * @param containerOrId - The ID of the HTML element or the element itself to render the form into.
 * @param schemaOrUrl - The JSON schema object or a URL to fetch it from.
 * @param outputId - The ID of the HTML element to update with the JSON data.
 */
export async function initLinked(containerOrId: string | HTMLElement, schemaOrUrl: string | any, outputId: string) {
  const outputElement = document.getElementById(outputId);

  return init(containerOrId, schemaOrUrl, undefined, (data) => {
    if (outputElement) {
      const jsonString = JSON.stringify(data, null, 2);
      if (outputElement instanceof HTMLInputElement || outputElement instanceof HTMLTextAreaElement) {
        outputElement.value = jsonString;
      } else {
        outputElement.textContent = jsonString;
        outputElement.style.whiteSpace = "pre";
      }
    }
  });
}
