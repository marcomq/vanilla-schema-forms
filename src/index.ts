import { parseSchema } from "./parser";
import { renderForm, renderNode, setCustomRenderers } from "./renderer";
import * as templates from "./templates";
import { CUSTOM_RENDERERS } from "./custom-renderers";
import { readFormData } from "./form-data-reader";

export { setConfig } from "./config";
export { setI18n } from "./i18n";
export { setTemplates } from "./templates";
export { setCustomRenderers, renderNode } from "./renderer";
export { readFormData } from "./form-data-reader";
export { adaptUiSchema } from "./ui-schema-adapter";

document.addEventListener("DOMContentLoaded", async () => {
  const formContainer = document.getElementById("form-container");
  const jsonOutput = document.getElementById("json-output");

  if (!formContainer || !jsonOutput) {
    console.error("Required DOM elements not found.");
    return;
  }

  try {
    const rootNode = await parseSchema("/schema.json");
    console.log("Parsed schema:", rootNode);

    // Register custom renderer for TLS to restore the toggle functionality
    setCustomRenderers(CUSTOM_RENDERERS);

    renderForm(rootNode, formContainer);

    const updateJson = () => {
      const data = readFormData(rootNode);
      jsonOutput.textContent = JSON.stringify(data, null, 2);
      jsonOutput.style.whiteSpace = "pre";
    };

    formContainer.addEventListener("input", updateJson);
    formContainer.addEventListener("change", updateJson);

    // Initial population
    updateJson();
    
  } catch (error) {
    formContainer.innerHTML = templates.renderSchemaError(error);
    console.error(error);
  }
});
