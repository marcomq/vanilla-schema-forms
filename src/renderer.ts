import { FormNode } from "./parser";
import * as templates from "./templates";
import { CONFIG } from "./config";
import { formStore } from "./state";
import { readFormData } from "./form-data-reader";

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
  "mode": {
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
  let segment = node.key;
  if (!segment) {
    // If no key (e.g. root or oneOf variant), use a prefixed title to avoid collision
    // and allow resolvePath to skip it.
    const safeTitle = node.title.replace(/[^a-zA-Z0-9]/g, '');
    segment = path ? `__var_${safeTitle}` : safeTitle;
  }

  const elementId = path ? `${path}.${segment}` : segment;

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

function resolvePath(elementId: string): (string | number)[] | null {
  const fullParts = elementId.split('.');
  if (fullParts.length === 0) return [];
  
  // The first part is the Root title, which we don't include in the data path.
  const path: (string | number)[] = [];
  let currentIdParts = [fullParts[0]]; // Start with Root
  
  for (let i = 1; i < fullParts.length; i++) {
    const part = fullParts[i];
    currentIdParts.push(part);

    // Skip variant segments (oneOf options) to flatten the data structure
    if (part.startsWith('__var_')) continue;
    
    if (part.startsWith('__ap_')) {
      const keyInputId = `${currentIdParts.join('.')}_key`;
      const keyInput = document.getElementById(keyInputId) as HTMLInputElement;
      
      if (keyInput) {
        const key = keyInput.value;
        if (!key) return null; // Cannot store value without a key
        path.push(key);
      } else {
        return null;
      }
      
      // Skip 'Value' if next
      if (i + 1 < fullParts.length && fullParts[i+1] === 'Value') {
        i++;
        currentIdParts.push('Value');
      }
    } else {
      const num = parseInt(part, 10);
      path.push(isNaN(num) ? part : num);
    }
  }
  return path;
}

function updateArrayIndices(container: HTMLElement, startIndex: number, baseId: string) {
  const rows = Array.from(container.children) as HTMLElement[];
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    const oldIndex = i + 1;
    const newIndex = i;
    const oldPrefix = `${baseId}.${oldIndex}`;
    const newPrefix = `${baseId}.${newIndex}`;

    // Update IDs and attributes for the row and all its children
    const elements = [row, ...row.querySelectorAll('*')];
    elements.forEach(el => {
      if (el.id && el.id.startsWith(oldPrefix)) {
        el.id = el.id.replace(oldPrefix, newPrefix);
      }
      ['name', 'for', 'data-target', 'data-id', 'data-toggle-target'].forEach(attr => {
        if (el.hasAttribute(attr)) {
          const val = el.getAttribute(attr)!;
          if (val.startsWith(oldPrefix)) {
            el.setAttribute(attr, val.replace(oldPrefix, newPrefix));
          }
        }
      });
    });
  }
}

function updateAPIndices(container: HTMLElement, startIndex: number, baseId: string) {
  const rows = Array.from(container.children) as HTMLElement[];
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    const keyInput = row.querySelector('.js_ap-key');
    if (keyInput && keyInput.id) {
       const match = keyInput.id.match(/__ap_(\d+)_key$/);
       if (match) {
         const oldIdx = parseInt(match[1], 10);
         const newIdx = i;
         if (oldIdx !== newIdx) {
           const oldPrefix = `${baseId}.__ap_${oldIdx}`;
           const newPrefix = `${baseId}.__ap_${newIdx}`;
           
           const elements = [row, ...row.querySelectorAll('*')];
           elements.forEach(el => {
             if (el.id && el.id.startsWith(oldPrefix)) el.id = el.id.replace(oldPrefix, newPrefix);
             ['name', 'for', 'data-target', 'data-id', 'data-toggle-target'].forEach(attr => {
                if (el.hasAttribute(attr) && el.getAttribute(attr)!.startsWith(oldPrefix)) {
                  el.setAttribute(attr, el.getAttribute(attr)!.replace(oldPrefix, newPrefix));
                }
             });
           });
         }
       }
    }
  }
}

function getDefaultValueForNode(node: FormNode): any {
  if (node.default !== undefined) return node.default;

  let defaults: any = (node.type === 'object' || node.properties) ? {} : undefined;

  // 1. Populate required properties
  if (node.properties) {
    for (const key in node.properties) {
      if (node.properties[key].required) {
        defaults[key] = getDefaultValueForNode(node.properties[key]);
      }
    }
  }

  // 2. Handle oneOf defaults (merge if object, replace if primitive)
  if (node.oneOf && node.oneOf.length > 0) {
    // Match logic in renderOneOf to find default selection
    let selectedIndex = node.oneOf.findIndex(opt => opt.type === 'null');
    if (selectedIndex === -1) {
      selectedIndex = node.oneOf.findIndex(opt => {
        const title = opt.title ? opt.title.toLowerCase() : "";
        return title === 'null' || title === 'none';
      });
    }
    if (selectedIndex === -1) selectedIndex = 0;

    const oneOfDefault = getDefaultValueForNode(node.oneOf[selectedIndex]);
    
    if (defaults !== undefined && typeof oneOfDefault === 'object' && oneOfDefault !== null) {
      defaults = { ...defaults, ...oneOfDefault };
    } else if (defaults === undefined) {
      defaults = oneOfDefault;
    }
  }
  
  if (defaults !== undefined) return defaults;

  if (node.enum && node.enum.length > 0) {
    return node.enum[0];
  }

  switch (node.type) {
    case 'string': return "";
    case 'number': 
    case 'integer': return 0;
    case 'boolean': return false;
    case 'array': return [];
    case 'null': return null;
    default: return "";
  }
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

  // Initialize data-original-key for AP keys to track renames
  container.querySelectorAll('.js_ap-key').forEach(el => {
    const input = el as HTMLInputElement;
    input.setAttribute('data-original-key', input.value);
  });

  // Global Input Listener for Store Updates
  container.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    if (!target.id) return;

    // Ignore internal selector inputs (handled by change listener for UI, not data)
    if (target.id.endsWith('__selector')) return;

    // Handle AP Key Rename
    if (target.classList.contains('js_ap-key')) {
      const oldKey = target.getAttribute('data-original-key');
      const newKey = target.value;
      
      if (oldKey !== newKey) {
        const match = target.id.match(/(.*)\.__ap_\d+_key$/);
        if (match) {
          const parentId = match[1];
          const path = resolvePath(parentId + ".dummy"); // Resolve parent path
          if (path) {
            path.pop(); // Remove 'dummy'
            const parentObj = formStore.getPath(path);
            if (parentObj && typeof parentObj === 'object') {
              const val = parentObj[oldKey!] || {}; // Default to empty object if new
              if (oldKey) delete parentObj[oldKey];
              if (newKey) parentObj[newKey] = val;
              formStore.setPath(path, parentObj);
              target.setAttribute('data-original-key', newKey);
            }
          }
        }
      }
    } else {
      // Handle Value Update
      const path = resolvePath(target.id);
      if (!path) return;

      let value: any = target.value;
      if (target.type === 'checkbox') {
        value = (target as HTMLInputElement).checked;
      } else if (target.type === 'number') {
        value = (target as HTMLInputElement).valueAsNumber;
      }
      formStore.setPath(path, value);
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
        // Use the current elementId as the base path for the child option to ensure correct nesting
        const path = elementId!;
        contentContainer.innerHTML = renderNode(selectedNode, path, true);

        // Update Store with new structure (merging common props + new oneOf defaults)
        const storePath = resolvePath(elementId!);
        if (storePath) {
          const parentPath = elementId!.substring(0, elementId!.lastIndexOf('.'));
          const newData = readFormData(node, parentPath);
          formStore.setPath(storePath, newData);
        }
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

          // Initialize OneOfs in the new item
          const newItem = container!.lastElementChild;
          if (newItem) {
            newItem.querySelectorAll('.js_oneof-selector').forEach(el => {
              el.dispatchEvent(new Event('change', { bubbles: true }));
            });
          }

        container?.dispatchEvent(new Event('change', { bubbles: true }));

        // Update Store: Add default value
        const path = resolvePath(elementId!) || [];
        // The new item is at the index we just calculated
        const itemPath = [...path, index];
        const defaultValue = getDefaultValueForNode(node.items);
        formStore.setPath(itemPath, defaultValue);
      }
    }
    
    // 4. Array Remove Item
    if (target.classList.contains('js_btn-remove-item')) {
      const row = target.closest('.js_array-item-row');
      const arrayContainer = row?.parentElement;
      if (row && arrayContainer) {
        const index = Array.from(arrayContainer.children).indexOf(row);
        
        // Attempt to find the array ID prefix from the row's content
        // The first child of the row usually contains the rendered node with the ID
        const contentEl = row.querySelector('[id]');
        const contentId = contentEl?.id;
        const baseId = contentId ? contentId.substring(0, contentId.lastIndexOf('.')) : '';

        row.remove();
        
        // Update Store: Remove item at index
        const path = resolvePath(baseId) || [];
        formStore.removePath(path);

        if (baseId) updateArrayIndices(arrayContainer as HTMLElement, index, baseId);
        container.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // 5. Additional Properties Add
    if (target.classList.contains('js_btn-add-ap')) {
      const elementId = target.getAttribute('data-id');
      const node = NODE_REGISTRY.get(elementId!);
      const container = target.parentElement?.querySelector('.js_ap-items');
      
      if (node && container) {
        const index = container.children.length;
        const valueSchema = typeof node.additionalProperties === 'object' ? node.additionalProperties : { type: 'string', title: 'Value' } as FormNode;
        const valueNode = { ...valueSchema, title: 'Value', key: 'Value' };
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

        // Initialize OneOfs in the new row
        const newRow = container.lastElementChild;
        if (newRow) {
          newRow.querySelectorAll('.js_oneof-selector').forEach(el => {
            el.dispatchEvent(new Event('change', { bubbles: true }));
          });
        }
        
        // Update Store: Add new property (if key is present, otherwise it waits for input)
        // For APs, the key is dynamic. We usually wait for the user to type the key.
        // However, if we have a defaultKey, we can set it.
        if (defaultKey) {
           const path = resolvePath(elementId!) || [];
           formStore.setPath([...path, defaultKey], getDefaultValueForNode(valueSchema));
        }
        
        container.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    
    if (target.classList.contains('js_btn-remove-ap')) {
      const row = target.closest('.js_ap-row');
      // Note: Removing APs from store is tricky because we need the Key.
      // The readFormData logic handles this by rescraping, but for pure reactivity we'd need to know the key.
      // For now, we rely on the fact that the DOM removal stops it from being read, 
      // BUT since we are decoupling, we should ideally remove it from store.
      // Implementation: Find the key input in the row.
      const keyInput = row?.querySelector('.js_ap-key') as HTMLInputElement;
      const elementId = target.closest('.js_additional-properties')?.parentElement?.id; // Parent object ID

      if (keyInput && keyInput.value) {
        if (elementId) {
           const path = resolvePath(elementId) || [];
           formStore.removePath([...path, keyInput.value]);
        }
      }
      
      const apContainer = row?.parentElement;
      const index = apContainer ? Array.from(apContainer.children).indexOf(row!) : -1;

      row?.remove();
      
      if (apContainer && index !== -1 && elementId) {
        updateAPIndices(apContainer as HTMLElement, index, elementId);
      }
      container.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}
