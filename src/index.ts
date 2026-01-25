import "./web-components";
import { parseSchema } from "./parser";
import { renderForm, hydrateNodeWithData } from "./renderer";
import { type CustomRenderer } from "./types";
import { generateDefaultData } from "./form-data-reader";
import { Store } from "./state";
import { CONFIG } from "./config";
import { domRenderer, rendererConfig } from "./dom-renderer";

export { setConfig } from "./config";
export { setI18n } from "./i18n";
export { renderNode, renderObject, renderProperties } from "./renderer";
export type { RenderContext, CustomRenderer } from "./types";
export { generateDefaultData } from "./form-data-reader";
export { adaptUiSchema } from "./ui-schema-adapter";
export { domRenderer, rendererConfig };
export { VsfInput, VsfSelect, VsfLabel, VsfFieldset, VsfLegend, VsfFormItem, VsfAdditionalProperties, VsfArray, VsfArrayItem, VsfOneOf, VsfAdditionalPropertyItem } from "./web-components";

let globalCustomRenderers: Record<string, CustomRenderer<any>> = {};

export function setCustomRenderers(renderers: Record<string, CustomRenderer<any>>) {
  globalCustomRenderers = { ...globalCustomRenderers, ...renderers };
}

/**
 * Initializes the form in the specified container.
 * 
 * @param containerId - The ID of the HTML element to render the form into.
 * @param schemaOrUrl - The JSON schema object or a URL to fetch it from.
 * @param initialData - Optional initial data to populate the form with.
 * @param onDataChange - Optional callback invoked whenever the form data changes.
 * @returns An object containing the parsed root node and a function to get the current data.
 */
export async function init(containerId: string, schemaOrUrl: string | any, initialDataOrCallback?: any, onDataChangeCallback?: (data: any) => void) {
  let initialData: any = undefined;
  let onDataChange: ((data: any) => void) | undefined = undefined;

  if (typeof initialDataOrCallback === 'function') {
    onDataChange = initialDataOrCallback;
  } else {
    initialData = initialDataOrCallback;
    onDataChange = onDataChangeCallback;
  }

  const formContainer = document.getElementById(containerId);

  if (!formContainer) {
    console.error(`Required DOM element #${containerId} not found.`);
    return;
  }

  try {
    let rootNode = await parseSchema(schemaOrUrl);

    // Hydrate with initial data if provided, otherwise generate defaults
    const data = initialData !== undefined ? initialData : generateDefaultData(rootNode);
    
    // Pre-hydrate the root node so the renderer knows about default values (important for arrays/oneOf)
    if (initialData !== undefined) {
      rootNode = hydrateNodeWithData(rootNode, data);
    }

    const store = new Store<Record<string, any>>({});
    
    // Render the form
    renderForm(rootNode, formContainer, store, CONFIG, globalCustomRenderers);

    // Initialize store
    store.reset(data);

    // Subscribe to store changes
    store.subscribe((data) => {
      if (onDataChange) {
        onDataChange(data);
      }
    });

    // Trigger initial data change
    if (onDataChange && data) {
      onDataChange(data);
    }

    const setData = (newData: any) => {
      // To ensure UI consistency (especially for arrays/oneOf), we re-render on programmatic set.
      const hydrated = hydrateNodeWithData(rootNode, newData);
      renderForm(hydrated, formContainer, store, CONFIG, globalCustomRenderers);
      store.reset(newData);
    }

    return {
      rootNode,
      getData: () => store.get(),
      setData,
      validate: async () => {
        // We need the context populated by renderForm to map errors to DOM elements.
        // Since renderForm doesn't return it, we can't easily call validateAndShowErrors here without refactoring renderer.ts.
        // However, we can return the raw errors.
        const { validateData } = await import("./validator");
        return validateData(store.get());
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
 * @param containerId - The ID of the HTML element to render the form into.
 * @param schemaOrUrl - The JSON schema object or a URL to fetch it from.
 * @param outputId - The ID of the HTML element to update with the JSON data.
 */
export async function initLinked(containerId: string, schemaOrUrl: string | any, outputId: string) {
  const outputElement = document.getElementById(outputId);

  return init(containerId, schemaOrUrl, undefined, (data) => {
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
