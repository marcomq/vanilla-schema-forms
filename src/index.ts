import "./web-components";
import { parseSchema } from "./parser";
import { renderForm } from "./renderer";
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
export { VsfInput, VsfSelect, VsfLabel, VsfFieldset, VsfLegend, VsfFormItem, VsfAdditionalProperties, VsfArray, VsfArrayItem, VsfOneOf } from "./web-components";

let globalCustomRenderers: Record<string, CustomRenderer<any>> = {};

export function setCustomRenderers(renderers: Record<string, CustomRenderer<any>>) {
  globalCustomRenderers = { ...globalCustomRenderers, ...renderers };
}

/**
 * Initializes the form in the specified container.
 * 
 * @param containerId - The ID of the HTML element to render the form into.
 * @param schemaOrUrl - The JSON schema object or a URL to fetch it from.
 * @param onDataChange - Optional callback invoked whenever the form data changes.
 * @returns An object containing the parsed root node and a function to get the current data.
 */
export async function init(containerId: string, schemaOrUrl: string | any, onDataChange?: (data: any) => void) {
  const formContainer = document.getElementById(containerId);

  if (!formContainer) {
    console.error(`Required DOM element #${containerId} not found.`);
    return;
  }

  try {
    const rootNode = await parseSchema(schemaOrUrl);

    const store = new Store<Record<string, any>>({});
    renderForm(rootNode, formContainer, store, CONFIG, globalCustomRenderers);

    // Initialize store with data scraped from the rendered form (handling defaults)
    const initialData = generateDefaultData(rootNode);
    store.reset(initialData);

    // Subscribe to store changes
    store.subscribe((data) => {
      if (onDataChange) {
        onDataChange(data);
      }
    });

    // Trigger initial data change
    if (onDataChange) {
      onDataChange(initialData);
    }

    return {
      rootNode,
      getData: () => store.get()
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

  return init(containerId, schemaOrUrl, (data) => {
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
