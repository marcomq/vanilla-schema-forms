import { parseSchema } from "./parser";
import { renderForm, setCustomRenderers } from "./renderer";
import * as templates from "./templates";
import { CUSTOM_RENDERERS } from "./customization.js";
import { readFormData } from "./form-data-reader";
import { formStore } from "./state";

export { setConfig } from "./config";
export { setI18n } from "./i18n";
export { setTemplates } from "./templates";
export { setCustomRenderers, renderNode } from "./renderer";
export { readFormData } from "./form-data-reader";
export { adaptUiSchema } from "./ui-schema-adapter";

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
    console.log("Parsed schema:", rootNode);

    // Register custom renderer for TLS to restore the toggle functionality
    setCustomRenderers(CUSTOM_RENDERERS as any);

    renderForm(rootNode, formContainer);

    // Initialize store with data scraped from the rendered form (handling defaults)
    const initialData = readFormData(rootNode);
    formStore.reset(initialData);

    // Subscribe to store changes
    formStore.subscribe((data) => {
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
      getData: () => formStore.get()
    };
    
  } catch (error) {
    formContainer.innerHTML = templates.renderSchemaError(error);
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

document.addEventListener("DOMContentLoaded", async () => {
  if (document.getElementById("form-container") && document.getElementById("json-output")) {
    await initLinked("form-container", "/schema.json", "json-output");
  } else if (document.getElementById("form-container")) {
    await init("form-container", "/schema.json");
  }
});
