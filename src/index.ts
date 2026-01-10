import { FormNode, parseSchema } from "./parser";
import { renderForm } from "./renderer";

function readFormData(node: FormNode, path: string = ""): any {
  const elementId = path ? `${path}.${node.title}` : node.title;

  switch (node.type) {
    case "object":
      const obj: { [key: string]: any } = {};
      
      // Read defined properties
      if (node.properties) {
        for (const key in node.properties) {
          obj[key] = readFormData(node.properties[key], elementId);
        }
      }

      // Read additional properties
      if (node.additionalProperties) {
        // Find the container for this object using the ID we assigned in renderer
        const objectContainer = document.getElementById(elementId);
        if (objectContainer) {
          const rows = objectContainer.querySelectorAll(":scope > .additional-properties > .ap-items > .ap-row");
          rows.forEach((row, index) => {
            const keyInput = row.querySelector(".ap-key") as HTMLInputElement | null;
            const key = keyInput ? keyInput.value.trim() : "";
            
            if (key) {
              // Reconstruct the ID used in renderer for the value
              const valueIdPath = `${elementId}.__ap_${index}`;
              const valueSchema = typeof node.additionalProperties === 'boolean' 
                ? { type: 'string', title: 'Value' } as FormNode 
                : node.additionalProperties;
              
              obj[key] = readFormData(valueSchema as FormNode, valueIdPath.replace(".Value", ""));
            }
          });
        }
      }

      // Read oneOf selection
      if (node.oneOf) {
        const selector = document.getElementById(`${elementId}__selector`) as HTMLSelectElement | null;
        if (selector) {
          const index = parseInt(selector.value, 10);
          const selectedNode = node.oneOf[index];
          const oneOfData = readFormData(selectedNode, path); // Use parent path
          Object.assign(obj, oneOfData);
        }
      }
      
      return obj;

    case "array":
      const arrayResult: any[] = [];
      const arrayContainer = document.getElementById(elementId);
      
      if (arrayContainer && node.items) {
        const items = node.items;
        const rows = arrayContainer.querySelectorAll(":scope > .array-items > .array-item-row");
        rows.forEach((row, index) => {
          const itemTitle = `Item ${index + 1}`;
          const itemNode = { ...items, title: itemTitle };
          const itemPath = `${elementId}.${index}`;
          
          arrayResult.push(readFormData(itemNode, itemPath));
        });
      }
      return arrayResult;

    case "number":
    case "integer":
      const numElement = document.getElementById(elementId) as HTMLInputElement | null;
      return numElement ? numElement.valueAsNumber : 0;

    case "boolean":
      const boolElement = document.getElementById(elementId) as HTMLInputElement | null;
      return boolElement ? boolElement.checked : false;

    case "string":
    default:
      const strElement = document.getElementById(elementId) as HTMLInputElement | null;
      return strElement ? strElement.value : "";
  }
}

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
    renderForm(rootNode, formContainer);

    formContainer.addEventListener("input", () => {
      const data = readFormData(rootNode);
      jsonOutput.textContent = JSON.stringify(data, null, 2);
    });

    // Initial population
    const initialData = readFormData(rootNode);
    jsonOutput.textContent = JSON.stringify(initialData, null, 2);
    
  } catch (error) {
    formContainer.innerHTML = `<div class="alert alert-danger">
        <strong>Error:</strong> Could not load or parse the schema. See console for details.
      </div>`;
    console.error(error);
  }
});
