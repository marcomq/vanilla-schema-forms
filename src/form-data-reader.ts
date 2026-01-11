import { FormNode } from "./parser";

export function readFormData(node: FormNode, path: string = ""): any {
  let segment = node.key;
  if (!segment) {
    // Match logic in renderer.ts
    const safeTitle = node.title.replace(/[^a-zA-Z0-9]/g, '');
    segment = path ? `__var_${safeTitle}` : safeTitle;
  }

  const elementId = path ? `${path}.${segment}` : segment;

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
          const rows = objectContainer.querySelectorAll(":scope > .js_additional-properties > .js_ap-items > .js_ap-row");
          rows.forEach((row, index) => {
            const keyInput = row.querySelector(".js_ap-key") as HTMLInputElement | null;
            const key = keyInput ? keyInput.value.trim() : "";
            
            if (key) {
              // Reconstruct the ID used in renderer for the value
              const valueIdPath = `${elementId}.__ap_${index}`;
              const valueSchema = typeof node.additionalProperties === 'boolean' 
                ? { type: 'string', title: 'Value' } as FormNode 
                : node.additionalProperties;
              
              // Force title/key to 'Value' to match renderer
              const valueNode = { ...valueSchema as FormNode, title: 'Value', key: 'Value' };
              obj[key] = readFormData(valueNode, valueIdPath);
            }
          });
        }
      }

      // Read oneOf selection
      if (node.oneOf) {
        const selector = document.getElementById(`${elementId}__selector`) as HTMLSelectElement | null;
        if (selector) {
          const index = parseInt(selector.value, 10);
          if (!isNaN(index) && node.oneOf[index]) {
            const selectedNode = node.oneOf[index];
            const oneOfData = readFormData(selectedNode, elementId); // Use current node ID as path
            Object.assign(obj, oneOfData);
          }
        }
      }
      
      return obj;

    case "array":
      const arrayResult: any[] = [];
      const arrayContainer = document.getElementById(elementId);
      
      if (arrayContainer && node.items) {
        const items = node.items;
        const rows = arrayContainer.querySelectorAll(":scope > .js_array-items > .js_array-item-row");
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
      return numElement ? (isNaN(numElement.valueAsNumber) ? undefined : numElement.valueAsNumber) : undefined;

    case "boolean":
      const boolElement = document.getElementById(elementId) as HTMLInputElement | null;
      return boolElement ? boolElement.checked : undefined;

    case "null":
      return null;

    case "string":
    default:
      const strElement = document.getElementById(elementId) as HTMLInputElement | HTMLSelectElement | null;
      if (!strElement) return undefined;
      return strElement.value === "" ? undefined : strElement.value;
  }
}