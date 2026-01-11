import { FormNode } from "./parser";
import * as templates from "./templates";
import { CONFIG } from "./config";

// Registry to store nodes for dynamic rendering (Arrays, OneOf)
const NODE_REGISTRY = new Map<string, FormNode>();

export interface CustomRenderer {
  render?: (node: FormNode, path: string, elementId: string) => string;
  widget?: string;
  options?: string[];
  getDefaultKey?: (index: number) => string;
  renderAdditionalPropertyRow?: (valueHtml: string, defaultKey: string, uniqueId: string) => string;
}

// Configuration for specific fields
let customRenderers: Record<string, CustomRenderer> = {
  "consumer mode": {
    widget: "select",
    options: ["consumer", "subscriber"]
  }
};

export function setCustomRenderers(renderers: Record<string, CustomRenderer>) {
  customRenderers = { ...customRenderers, ...renderers };
}

/**
 * Renders a form into the container based on the parsed schema tree.
 * @param rootNode - The root FormNode of the schema.
 * @param formContainer - The HTML element to render the form into.
 */
export function renderForm(rootNode: FormNode, formContainer: HTMLElement) {
  NODE_REGISTRY.clear();
  const html = renderNode(rootNode);
  formContainer.innerHTML = templates.renderFormWrapper(html);
  attachInteractivity(formContainer);
}

function findCustomRenderer(elementId: string): CustomRenderer | undefined {
  const fullPathKey = elementId.toLowerCase();
  let maxMatchLen = -1;
  let bestMatch: CustomRenderer | undefined;

  for (const key in customRenderers) {
    const lowerKey = key.toLowerCase();
    if (fullPathKey === lowerKey || fullPathKey.endsWith('.' + lowerKey)) {
      if (lowerKey.length > maxMatchLen) {
        maxMatchLen = lowerKey.length;
        bestMatch = customRenderers[key];
      }
    }
  }
  return bestMatch;
}

export function renderNode(node: FormNode, path: string = "", headless: boolean = false): string {
  const elementId = path ? `${path}.${node.title}` : node.title;

  if (CONFIG.visibility.customVisibility && !CONFIG.visibility.customVisibility(node, elementId)) {
    return "";
  }

  if (CONFIG.visibility.hiddenPaths.includes(elementId) || CONFIG.visibility.hiddenKeys.includes(node.title)) {
    return "";
  }
  
  // Register node for potential lookups
  NODE_REGISTRY.set(elementId, node);

  // 1. Custom Renderers
  const renderer = findCustomRenderer(elementId);

  if (renderer?.render) {
    return renderer.render(node, path, elementId);
  }

  // 2. Widget Overrides
  if (renderer?.widget === 'select') {
    return templates.renderSelect(node, elementId, renderer.options);
  }

  if (node.enum) {
    return templates.renderSelect(node, elementId, node.enum.map(String));
  }

  // 3. Standard Types
  switch (node.type) {
    case "string": return templates.renderString(node, elementId);
    case "number":
    case "integer": return templates.renderNumber(node, elementId);
    case "boolean": return templates.renderBoolean(node, elementId);
    case "object": return renderObject(node, path, elementId, headless);
    case "array": return templates.renderArray(node, elementId);
    case "null": return templates.renderNull(node);
    default: return templates.renderUnsupported(node);
  }
}

export function renderObject(node: FormNode, _path: string, elementId: string, headless: boolean = false): string {
  const props = node.properties ? renderProperties(node.properties, elementId) : '';
  const ap = templates.renderAdditionalProperties(node, elementId);
  const oneOf = templates.renderOneOf(node, elementId);
  if (headless) {
    return templates.renderHeadlessObject(elementId, props + ap + oneOf);
  }
  return templates.renderObject(node, elementId, props + ap + oneOf);
}

export function renderProperties(properties: { [key: string]: FormNode }, parentId: string): string {
  const groups = CONFIG.layout.groups[parentId] || [];
  const groupedKeys = new Set(groups.flatMap((g: { keys: string[]; title?: string; className?: string; }) => g.keys));
 
  // Render groups
  const groupsHtml = groups.map((group: { keys: string[]; title?: string; className?: string; }) => {
    const groupContent = group.keys
      .map(key => properties[key] ? renderNode(properties[key], parentId) : '')
      .join('');
    return templates.renderLayoutGroup(group.title, groupContent, group.className);
  }).join('');

  // Filter out grouped keys for the remaining list
  const remainingKeys = Object.keys(properties).filter(k => !groupedKeys.has(k));

  const keys = remainingKeys.sort((a, b) => {
    const nodeA = properties[a];
    const nodeB = properties[b];
    
    // 1. Priority fields (e.g. name, id, enabled)
    const priority = CONFIG.sorting.perObjectPriority[parentId] || CONFIG.sorting.defaultPriority;
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

  const remainingHtml = keys
    .map(key => renderNode(properties[key], parentId))
    .join('');

  return groupsHtml + remainingHtml;
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
    if (target.classList.contains('js_oneof-selector')) {
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
  container.querySelectorAll('.js_oneof-selector').forEach(el => el.dispatchEvent(new Event('change', { bubbles: true })));

  // 3. Array Add Item
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('js_btn-add-array-item')) {
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
    if (target.classList.contains('js_btn-remove-item')) {
      target.closest('.js_array-item-row')?.remove();
      container.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 5. Additional Properties Add
    if (target.classList.contains('js_btn-add-ap')) {
      const elementId = target.getAttribute('data-id');
      const node = NODE_REGISTRY.get(elementId!);
      const container = target.parentElement?.querySelector('.js_ap-items');
      
      if (node && container) {
        const index = container.children.length;
        const valueSchema = typeof node.additionalProperties === 'object' ? node.additionalProperties : { type: 'string', title: 'Value' } as FormNode;
        const valueNode = { ...valueSchema, title: 'Value' };
        const valueHtml = renderNode(valueNode, `${elementId}.__ap_${index}`);
        
        let defaultKey = "";
        const renderer = findCustomRenderer(elementId || "");
        
        if (renderer?.getDefaultKey) {
          defaultKey = renderer.getDefaultKey(index);
        } else {
          const keyPattern = target.getAttribute('data-key-pattern');
          if (keyPattern) {
            defaultKey = keyPattern.replace('{i}', (index + 1).toString());
          }
        }
        
        const uniqueId = `${elementId}.__ap_${index}_key`;
        
        const rowHtml = renderer?.renderAdditionalPropertyRow 
          ? renderer.renderAdditionalPropertyRow(valueHtml, defaultKey, uniqueId)
          : templates.renderAdditionalPropertyRow(valueHtml, defaultKey, uniqueId);
        container.insertAdjacentHTML('beforeend', rowHtml);
        container.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    
    if (target.classList.contains('js_btn-remove-ap')) {
      target.closest('.js_ap-row')?.remove();
      container.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}
