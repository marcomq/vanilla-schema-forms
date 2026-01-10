import { FormNode } from "./parser";
import * as templates from "./templates";

// Registry to store nodes for dynamic rendering (Arrays, OneOf)
const NODE_REGISTRY = new Map<string, FormNode>();

// Configuration for specific fields
const UI_CONFIG: Record<string, any> = {
  "tls": {
    render: (node: FormNode, path: string, elementId: string) => {
      const requiredProp = node.properties?.["required"];
      if (!requiredProp) return renderObject(node, path, elementId);

      const otherProps = { ...node.properties };
      delete otherProps["required"];
      
      const requiredId = `${elementId}.required`;
      // Checkbox controls visibility of the options container
      const checkbox = templates.renderBoolean(requiredProp, requiredId, `data-toggle-target="${elementId}-options"`);
      
      const optionsHtml = renderProperties(otherProps, elementId);

      return `
        <fieldset class="border p-3 rounded mb-3 ui_tls" id="${elementId}">
            <legend class="h6">${node.title}</legend>
            ${checkbox}
            <div id="${elementId}-options" style="display: none;" class="mt-3">
                ${optionsHtml}
            </div>
        </fieldset>
      `;
    }
  },
  "consumer mode": {
    widget: "select",
    options: ["consumer", "subscriber"]
  }
};

/**
 * Renders a form into the container based on the parsed schema tree.
 * @param rootNode - The root FormNode of the schema.
 * @param formContainer - The HTML element to render the form into.
 */
export function renderForm(rootNode: FormNode, formContainer: HTMLElement) {
  NODE_REGISTRY.clear();
  const html = renderNode(rootNode);
  formContainer.innerHTML = `<form id="generated-form">${html}</form>`;
  attachInteractivity(formContainer);
}

function renderNode(node: FormNode, path: string = "", headless: boolean = false): string {
  if (node.description?.includes("Consumer only")) {
    return "";
  }

  const elementId = path ? `${path}.${node.title}` : node.title;
  
  // Register node for potential lookups
  NODE_REGISTRY.set(elementId, node);

  // 1. Custom Renderers
  const configKey = node.title.toLowerCase();
  if (UI_CONFIG[configKey]?.render) {
    return UI_CONFIG[configKey].render(node, path, elementId);
  }

  // 2. Widget Overrides
  if (UI_CONFIG[configKey]?.widget === 'select') {
    return templates.renderSelect(node, elementId, UI_CONFIG[configKey].options);
  }

  // 3. Standard Types
  switch (node.type) {
    case "string": return templates.renderString(node, elementId);
    case "number":
    case "integer": return templates.renderNumber(node, elementId);
    case "boolean": return templates.renderBoolean(node, elementId);
    case "object": return renderObject(node, path, elementId, headless);
    case "array": return templates.renderArray(node, elementId);
    case "null": return `<div class="ui_null">${node.type}</div>`;
    default: return `<div class="alert alert-warning">Unsupported type: ${node.type}</div>`;
  }
}

function renderObject(node: FormNode, path: string, elementId: string, headless: boolean = false): string {
  const props = node.properties ? renderProperties(node.properties, elementId) : '';
  const ap = templates.renderAdditionalProperties(node, elementId);
  const oneOf = templates.renderOneOf(node, elementId);
  if (headless) {
    return `<div id="${elementId}" class="headless-object">${props + ap + oneOf}</div>`;
  }
  return templates.renderObject(node, elementId, props + ap + oneOf);
}

function renderProperties(properties: { [key: string]: FormNode }, parentId: string): string {
  const keys = Object.keys(properties).sort((a, b) => {
    const nodeA = properties[a];
    const nodeB = properties[b];
    
    // 1. Priority fields (e.g. name, id, enabled)
    const priority = ['name', 'id', 'title', 'type', 'enabled', 'active', 'url', 'brokers', 'username', 'password', 'topic', 'group', 'key', 'value', 'required'];
    const idxA = priority.indexOf(a.toLowerCase());
    const idxB = priority.indexOf(b.toLowerCase());
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;

    // 2. Primitives before Objects/Arrays
    const isPrimitiveA = ['string', 'number', 'integer', 'boolean'].includes(nodeA.type);
    const isPrimitiveB = ['string', 'number', 'integer', 'boolean'].includes(nodeB.type);
    if (isPrimitiveA !== isPrimitiveB) {
      return isPrimitiveA ? -1 : 1;
    }

    // 3. Alphabetical
    return a.localeCompare(b);
  });

  return keys
    .map(key => renderNode(properties[key], parentId))
    .join('');
}

function attachInteractivity(container: HTMLElement) {
  // 1. Visibility Toggles (TLS)
  container.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    if (target.hasAttribute('data-toggle-target')) {
      const targetId = target.getAttribute('data-toggle-target');
      const el = document.getElementById(targetId!);
      if (el) {
        const isChecked = (target as HTMLInputElement).checked;
        el.style.display = isChecked ? 'block' : 'none';
      }
    }
  });
  
  // Initialize toggles
  container.querySelectorAll('[data-toggle-target]').forEach(el => el.dispatchEvent(new Event('change', { bubbles: true })));

  // 2. OneOf Selector
  container.addEventListener('change', (e) => {
    const target = e.target as HTMLSelectElement;
    if (target.classList.contains('oneof-selector')) {
      const elementId = target.getAttribute('data-id');
      const node = NODE_REGISTRY.get(elementId!);
      const contentContainer = document.getElementById(`${elementId}__oneof_content`);
      
      if (node && node.oneOf && contentContainer) {
        const selectedIdx = parseInt(target.value, 10);
        const selectedNode = node.oneOf[selectedIdx];
        const path = elementId!.substring(0, elementId!.lastIndexOf('.'));
        contentContainer.innerHTML = renderNode(selectedNode, path, true);
      }
    }
  });
  
  // Initialize OneOfs
  container.querySelectorAll('.oneof-selector').forEach(el => el.dispatchEvent(new Event('change', { bubbles: true })));

  // 3. Array Add Item
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('btn-add-array-item')) {
      const elementId = target.getAttribute('data-id');
      const targetContainerId = target.getAttribute('data-target');
      const node = NODE_REGISTRY.get(elementId!);
      
      if (node && node.items) {
        const container = document.getElementById(targetContainerId!);
        const index = container!.children.length;
        const itemTitle = `Item ${index + 1}`;
        const itemNode = { ...node.items, title: itemTitle };
        const innerHtml = renderNode(itemNode, `${elementId}.${index}`);
        const itemHtml = templates.renderArrayItem(innerHtml);
        container!.insertAdjacentHTML('beforeend', itemHtml);
        container?.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    
    // 4. Array Remove Item
    if (target.classList.contains('btn-remove-item')) {
      target.closest('.array-item-row')?.remove();
      container.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 5. Additional Properties Add
    if (target.classList.contains('btn-add-ap')) {
      const elementId = target.getAttribute('data-id');
      const node = NODE_REGISTRY.get(elementId!);
      const container = target.parentElement?.querySelector('.ap-items');
      
      if (node && container) {
        const index = container.children.length;
        const valueSchema = typeof node.additionalProperties === 'object' ? node.additionalProperties : { type: 'string', title: 'Value' } as FormNode;
        const valueNode = { ...valueSchema, title: 'Value' };
        const valueHtml = renderNode(valueNode, `${elementId}.__ap_${index}`);
        const rowHtml = templates.renderAdditionalPropertyRow(valueHtml);
        container.insertAdjacentHTML('beforeend', rowHtml);
        container.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    
    if (target.classList.contains('btn-remove-ap')) {
      target.closest('.ap-row')?.remove();
      container.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}
