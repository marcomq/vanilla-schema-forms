import { FormNode } from "./parser";

/**
 * Renders a form into the container based on the parsed schema tree.
 * @param rootNode - The root FormNode of the schema.
 * @param formContainer - The HTML element to render the form into.
 */
export function renderForm(rootNode: FormNode, formContainer: HTMLElement) {
  // Clear any existing content
  formContainer.innerHTML = "";
  
  const form = document.createElement("form");

  // Start rendering from the root
  const formElement = createFormElement(rootNode);
  if (formElement) {
    form.appendChild(formElement);
  }

  formContainer.appendChild(form);
}

/**
 * Creates an HTML element for a given FormNode.
 * This function will be called recursively for nested objects.
 * @param node - The FormNode to render.
 * @returns An HTMLElement representing the form field or group.
 */
function createFormElement(node: FormNode, path: string = ""): HTMLElement | null {
  if (!node.type) {
    return null;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "mb-3";

  const label = document.createElement("label");
  label.className = "form-label";
  label.textContent = node.title;

  const elementId = path ? `${path}.${node.title}` : node.title;
  let element: HTMLElement;

  switch (node.type) {
    case "string":
      element = document.createElement("input");
      (element as HTMLInputElement).type = "text";
      element.className = "form-control";
      element.id = elementId;
      if (node.defaultValue) {
        (element as HTMLInputElement).value = String(node.defaultValue);
      }
      if (node.description) {
        const desc = document.createElement("div");
        desc.className = "form-text";
        desc.textContent = node.description;
        wrapper.appendChild(desc);
      }
      wrapper.appendChild(label);
      wrapper.appendChild(element);
      break;

    case "number":
    case "integer":
      element = document.createElement("input");
      (element as HTMLInputElement).type = "number";
      element.className = "form-control";
      element.id = elementId;
      if (node.defaultValue) {
        (element as HTMLInputElement).value = String(node.defaultValue);
      }
      wrapper.appendChild(label);
      wrapper.appendChild(element);
      break;

    case "boolean":
      wrapper.className = "mb-3 form-check";
      element = document.createElement("input");
      (element as HTMLInputElement).type = "checkbox";
      element.className = "form-check-input";
      element.id = elementId;
      if (node.defaultValue) {
        (element as HTMLInputElement).checked = node.defaultValue;
      }
      label.className = "form-check-label";
      wrapper.appendChild(element);
      wrapper.appendChild(label);
      break;

    case "object":
      const fieldset = document.createElement("fieldset");
      fieldset.className = "border p-3 rounded mb-3";
      fieldset.id = elementId; // Assign ID to container for easier lookup
      const legend = document.createElement("legend");
      legend.className = "h6";
      legend.textContent = node.title;
      fieldset.appendChild(legend);

      if (node.properties) {
        for (const key in node.properties) {
          const childElement = createFormElement(node.properties[key], elementId);
          if (childElement) {
            fieldset.appendChild(childElement);
          }
        }
      }

      // Handle additionalProperties
      if (node.additionalProperties) {
        const apContainer = document.createElement("div");
        apContainer.className = "additional-properties mt-3";
        
        const apHeader = document.createElement("h6");
        apHeader.textContent = "Additional Properties";
        apContainer.appendChild(apHeader);

        const itemsContainer = document.createElement("div");
        itemsContainer.className = "ap-items";
        apContainer.appendChild(itemsContainer);

        const addButton = document.createElement("button");
        addButton.type = "button";
        addButton.className = "btn btn-sm btn-outline-secondary mt-2";
        addButton.textContent = "Add Property";
        
        // Determine the schema for the value
        const valueSchema = typeof node.additionalProperties === 'boolean' 
          ? { type: 'string', title: 'Value' } as FormNode 
          : node.additionalProperties;

        addButton.onclick = (e) => {
          e.preventDefault();
          const index = itemsContainer.children.length;
          const row = document.createElement("div");
          row.className = "d-flex gap-2 mb-2 align-items-end ap-row";
          
          // Key Input
          const keyWrapper = document.createElement("div");
          keyWrapper.innerHTML = `<label class="form-label small">Key</label><input type="text" class="form-control form-control-sm ap-key" placeholder="Key">`;
          
          // Value Input (Recursive render)
          // We generate a temporary unique ID for the value input
          const valueWrapper = document.createElement("div");
          valueWrapper.className = "flex-grow-1";
          const valueNode = { ...valueSchema, title: "Value" };
          const valueElement = createFormElement(valueNode, `${elementId}.__ap_${index}`);
          if (valueElement) valueWrapper.appendChild(valueElement);

          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "btn btn-sm btn-outline-danger";
          removeBtn.textContent = "X";
          removeBtn.onclick = () => row.remove();

          row.appendChild(keyWrapper);
          row.appendChild(valueWrapper);
          row.appendChild(removeBtn);
          itemsContainer.appendChild(row);
        };

        apContainer.appendChild(addButton);
        fieldset.appendChild(apContainer);
      }

      // Handle oneOf (Render selector inside the object fieldset)
      if (node.oneOf && node.oneOf.length > 0) {
        const oneOfContainer = document.createElement("div");
        oneOfContainer.className = "mt-3 border-top pt-3";
        
        const oneOfLabel = document.createElement("label");
        oneOfLabel.className = "form-label small text-muted";
        oneOfLabel.textContent = "Type / Variant";
        oneOfContainer.appendChild(oneOfLabel);

        const select = document.createElement("select");
        select.className = "form-select mb-2";
        select.id = `${elementId}__selector`;

        const container = document.createElement("div");
        container.className = "oneof-container ps-3 border-start";
        container.id = `${elementId}__oneof_content`;

        // Populate options
        node.oneOf.forEach((opt, idx) => {
          const option = document.createElement("option");
          option.value = idx.toString();
          option.textContent = opt.title;
          select.appendChild(option);
        });

        select.onchange = () => {
          container.innerHTML = "";
          const selectedIdx = parseInt(select.value, 10);
          const selectedNode = node.oneOf?.[selectedIdx];
          if (selectedNode) {
            const child = createFormElement(selectedNode, path); // Use parent path to merge data
            if (child) {
              // If the child is a fieldset, remove styling to blend it in
              if (child.tagName === "FIELDSET") {
                child.className = "mt-2"; // Remove border/padding
                const legend = child.querySelector("legend");
                if (legend) legend.remove(); // Remove redundant title
              }
              container.appendChild(child);
            }
          }
        };

        // Initial render
        select.value = "0";
        select.dispatchEvent(new Event("change"));

        oneOfContainer.appendChild(select);
        oneOfContainer.appendChild(container);
        fieldset.appendChild(oneOfContainer);
      }

      return fieldset;

    case "array":
      const arrayFieldset = document.createElement("fieldset");
      arrayFieldset.className = "border p-3 rounded mb-3";
      arrayFieldset.id = elementId;

      const arrayLegend = document.createElement("legend");
      arrayLegend.className = "h6";
      arrayLegend.textContent = node.title;
      arrayFieldset.appendChild(arrayLegend);

      const arrayItemsContainer = document.createElement("div");
      arrayItemsContainer.className = "array-items";
      arrayFieldset.appendChild(arrayItemsContainer);

      if (node.items) {
        const items = node.items; // Capture items for the closure
        const addItemBtn = document.createElement("button");
        addItemBtn.type = "button";
        addItemBtn.className = "btn btn-sm btn-outline-primary mt-2";
        addItemBtn.textContent = "Add Item";
        
        addItemBtn.onclick = () => {
          const index = arrayItemsContainer.children.length;
          const itemRow = document.createElement("div");
          itemRow.className = "d-flex gap-2 mb-2 align-items-start array-item-row";
          
          const itemWrapper = document.createElement("div");
          itemWrapper.className = "flex-grow-1";
          
          // Create a temporary node for the item with a unique title based on index
          const itemNode = { ...items, title: `Item ${index + 1}` };
          const itemElement = createFormElement(itemNode, `${elementId}.${index}`);
          
          if (itemElement) {
            itemWrapper.appendChild(itemElement);
          }

          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "btn btn-sm btn-outline-danger";
          removeBtn.style.marginTop = "2rem"; // Align with input field
          removeBtn.textContent = "Remove";
          removeBtn.onclick = () => itemRow.remove();

          itemRow.appendChild(itemWrapper);
          itemRow.appendChild(removeBtn);
          arrayItemsContainer.appendChild(itemRow);
        };
        arrayFieldset.appendChild(addItemBtn);
      }
      return arrayFieldset;

    default:
      wrapper.innerHTML = `<label class="form-label">${node.title}</label>
        <div class="alert alert-warning">Unsupported type: ${node.type}</div>`;
      break;
  }

  return wrapper;
}
