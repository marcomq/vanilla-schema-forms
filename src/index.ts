import { parseSchema } from "./parser";
import { renderForm, hydrateNodeWithData, DEFAULT_CUSTOM_RENDERERS } from "./renderer";
import { type CustomRenderer, RenderContext } from "./types";
import { generateDefaultData } from "./form-data-reader";
import { Store } from "./state";
import { CONFIG } from "./config";
import { domRenderer, rendererConfig } from "./dom-renderer";
import { validateAndShowErrors, resolvePath } from "./events";

export { setConfig, resetConfig } from "./config";
export { setI18n, resetI18n } from "./i18n";
export { renderNode, renderObject, renderProperties, getName } from "./renderer";
export type { RenderContext, CustomRenderer } from "./types";
export { generateDefaultData } from "./form-data-reader";
export { adaptUiSchema } from "./ui-schema-adapter";
export { h } from "./hyperscript";
export { domRenderer, rendererConfig };
export { validateAndShowErrors, resolvePath };

let globalCustomRenderers: Record<string, CustomRenderer<any>> = {};

export function setCustomRenderers(renderers: Record<string, CustomRenderer<any>>) {
  globalCustomRenderers = { ...globalCustomRenderers, ...renderers };
}

export interface RenderOptions {
  subSchemaPath?: string;
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
        const errorMsg = `Error: sub-schema path "${renderOptions.subSchemaPath}" not found.`;
        console.error(errorMsg);
        formContainer.innerHTML = '';
        formContainer.appendChild(domRenderer.renderSchemaError(new Error(errorMsg)));
        return;
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

    // Initialize store
    store.reset(finalData);

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
    throw error;
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
