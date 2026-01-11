import { parseSchema } from "./parser";
import { renderForm, setCustomRenderers } from "./renderer";
import * as templates from "./templates";
import { CUSTOM_RENDERERS } from "./customization";
import { readFormData } from "./form-data-reader";

export { setConfig } from "./config";
export { setI18n } from "./i18n";
export { setTemplates } from "./templates";
export { setCustomRenderers, renderNode } from "./renderer";
export { readFormData } from "./form-data-reader";
export { adaptUiSchema } from "./ui-schema-adapter";

export interface InitOptions {
  schemaUrl?: string;
  schema?: any;
  containerId?: string;
  outputId?: string;
  onDataChange?: (data: any) => void;
}

export async function init(options: InitOptions = {}) {
  const containerId = options.containerId || "form-container";
  const outputId = options.outputId || "json-output";
  const schemaUrl = options.schemaUrl || "/schema.json";

  const formContainer = document.getElementById(containerId);
  const jsonOutput = document.getElementById(outputId);

  if (!formContainer) {
    if (options.containerId) {
      console.error(`Required DOM element #${containerId} not found.`);
    }
    return;
  }

  try {
    const rootNode = options.schema ? await parseSchema(options.schema) : await parseSchema(schemaUrl);
    console.log("Parsed schema:", rootNode);

    // Register custom renderer for TLS to restore the toggle functionality
    setCustomRenderers(CUSTOM_RENDERERS);

    renderForm(rootNode, formContainer);

    const updateJson = () => {
      const data = readFormData(rootNode);
      
      if (options.onDataChange) {
        options.onDataChange(data);
      }

      if (jsonOutput) {
        const jsonString = JSON.stringify(data, null, 2);
        if (jsonOutput instanceof HTMLInputElement || jsonOutput instanceof HTMLTextAreaElement) {
          jsonOutput.value = jsonString;
        } else {
          jsonOutput.textContent = jsonString;
          jsonOutput.style.whiteSpace = "pre";
        }
      }
    };

    formContainer.addEventListener("input", updateJson);
    formContainer.addEventListener("change", updateJson);

    // Initial population
    updateJson();

    return {
      rootNode,
      getData: () => readFormData(rootNode)
    };
    
  } catch (error) {
    formContainer.innerHTML = templates.renderSchemaError(error);
    console.error(error);
    throw error;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (document.getElementById("form-container")) {
    await init();
  }
});
