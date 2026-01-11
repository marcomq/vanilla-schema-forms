import { FormNode } from "./parser";
import * as templates from "./templates";
import { Store } from "./state";
import { generateDefaultData } from "./form-data-reader";
import { validateData } from "./validator";
import { ErrorObject } from "ajv";

export interface RenderContext {
  store: Store<any>;
  config: any;
  nodeRegistry: Map<string, FormNode>;
  dataPathRegistry: Map<string, string>;
  elementIdToDataPath: Map<string, string>;
  customRenderers: Record<string, CustomRenderer<any>>;
  rootNode: FormNode;
}

export interface CustomRenderer<T = any> {
  render?: (node: FormNode, path: string, elementId: string, dataPath: string, context: RenderContext) => T;
  widget?: string;
  options?: string[];
  getDefaultKey?: (index: number) => string;
  renderAdditionalPropertyRow?: (valueHtml: T, defaultKey: string, uniqueId: string) => T;
}

// Configuration for specific fields
const DEFAULT_CUSTOM_RENDERERS: Record<string, CustomRenderer<any>> = {
  "mode": {
    widget: "select",
    options: ["consumer", "subscriber"]
  }
};

// Global reference to the current rendering context to support legacy calls
let activeContext: RenderContext | null = null;

function isRenderContext(obj: any): obj is RenderContext {
  return obj && typeof obj === 'object' && 'store' in obj && 'config' in obj;
}

/**
 * Renders a form into the container based on the parsed schema tree.
 * @param rootNode - The root FormNode of the schema.
 * @param formContainer - The HTML element to render the form into.
 */
export function renderForm(rootNode: FormNode, formContainer: HTMLElement, store: Store<any>, config: any, customRenderers: Record<string, CustomRenderer<any>> = {}) {
  const context: RenderContext = {
    store,
    config,
    nodeRegistry: new Map(),
    dataPathRegistry: new Map(),
    elementIdToDataPath: new Map(),
    customRenderers: { ...DEFAULT_CUSTOM_RENDERERS, ...customRenderers },
    rootNode
  };

  const html = renderNode(context, rootNode, "", false, "") as unknown as string;
  formContainer.innerHTML = templates.renderFormWrapper(html);
  attachInteractivity(context, formContainer);
}

function findCustomRenderer<T>(context: RenderContext, elementId: string): CustomRenderer<T> | undefined {
  const fullPathKey = elementId.toLowerCase();
  let maxMatchLen = -1;
  let bestMatch: CustomRenderer<T> | undefined;

  for (const key in context.customRenderers) {
    const lowerKey = key.toLowerCase();
    if (fullPathKey === lowerKey || fullPathKey.endsWith('.' + lowerKey)) {
      if (lowerKey.length > maxMatchLen) {
        bestMatch = context.customRenderers[key];
      }
    }
  }
  return bestMatch;
}

export function renderNode<T = any>(contextOrNode: RenderContext | FormNode, nodeOrPath: FormNode | string, pathOrHeadless: string | boolean = "", headlessOrDataPath: boolean | string = false, dataPath: string = ""): T {
  let context: RenderContext;
  let node: FormNode;
  let path: string;
  let headless: boolean;
  let dPath: string;

  if (isRenderContext(contextOrNode)) {
    context = contextOrNode;
    node = nodeOrPath as FormNode;
    path = pathOrHeadless as string;
    headless = headlessOrDataPath as boolean;
    dPath = dataPath;
  } else {
    if (!activeContext) throw new Error("RenderContext missing in renderNode and no active context found.");
    context = activeContext;
    node = contextOrNode as FormNode;
    path = nodeOrPath as string;
    headless = pathOrHeadless as boolean;
    dPath = headlessOrDataPath as string;
  }

  const prevContext = activeContext;
  activeContext = context;

  try {
  let segment = node.key;
  if (!segment) {
    // If no key (e.g. root or oneOf variant), use a prefixed title to avoid collision
    // and allow resolvePath to skip it.
    const safeTitle = node.title.replace(/[^a-zA-Z0-9]/g, '');
    segment = path ? `__var_${safeTitle}` : (safeTitle || 'root');
  }

  const elementId = path ? `${path}.${segment}` : segment;

  if (context.config.visibility.customVisibility && !context.config.visibility.customVisibility(node, elementId)) {
    return templates.renderFragment([]) as T;
  }

  if (context.config.visibility.hiddenPaths.includes(elementId) || context.config.visibility.hiddenKeys.includes(node.title)) {
    return templates.renderFragment([]) as T;
  }
  
  // Register node for potential lookups
  context.nodeRegistry.set(elementId, node);
  context.dataPathRegistry.set(dataPath, elementId);
  context.elementIdToDataPath.set(elementId, dataPath);

  // 1. Custom Renderers
  const renderer = findCustomRenderer<T>(context, elementId);

  if (renderer?.render) {
    return renderer.render(node, path, elementId, dataPath, context);
  }

  // 2. Widget Overrides
  if (renderer?.widget === 'select') {
    return templates.renderSelect(node, elementId, renderer.options || []) as T;
  }

  if (node.enum) {
    return templates.renderSelect(node, elementId, node.enum.map(String)) as T;
  }

  // 3. Standard Types
  switch (node.type) {
    case "string": return templates.renderString(node, elementId) as T;
    case "number":
    case "integer": return templates.renderNumber(node, elementId) as T;
    case "boolean": return templates.renderBoolean(node, elementId) as T;
    case "object": return renderObject(context, node, path, elementId, headless, dataPath) as T;
    case "array": return templates.renderArray(node, elementId) as T;
    case "null": return templates.renderNull(node) as T;
    default: return templates.renderUnsupported(node) as T;
  }
  } finally {
    activeContext = prevContext;
  }
}

export function renderObject<T = any>(contextOrNode: RenderContext | FormNode, nodeOrPath: FormNode | string, pathOrId: string, idOrHeadless: string | boolean, headlessOrDataPath: boolean | string = false, dataPath: string = ""): T {
  let context: RenderContext;
  let node: FormNode;
  let elementId: string;
  let headless: boolean;
  let dPath: string;

  if (isRenderContext(contextOrNode)) {
    context = contextOrNode;
    node = nodeOrPath as FormNode;
    // _path is ignored in implementation but present in signature
    elementId = idOrHeadless as string;
    headless = headlessOrDataPath as boolean;
    dPath = dataPath;
  } else {
    if (!activeContext) throw new Error("RenderContext missing in renderObject");
    context = activeContext;
    node = contextOrNode as FormNode;
    elementId = pathOrId;
    headless = idOrHeadless as boolean;
    dPath = headlessOrDataPath as string;
  }

  const props = node.properties ? renderProperties<T>(context, node.properties, elementId, dataPath) : templates.renderFragment([]);
  const ap = templates.renderAdditionalProperties(node, elementId);
  const oneOf = templates.renderOneOf(node, elementId);
  
  const content = templates.renderFragment([props, ap, oneOf]);

  if (headless) {
    return templates.renderHeadlessObject(elementId, content) as T;
  }
  return templates.renderObject(node, elementId, content) as T;
}

export function renderProperties<T = any>(contextOrProps: RenderContext | { [key: string]: FormNode }, propsOrId: { [key: string]: FormNode } | string, idOrPath: string, path?: string): T {
  let context: RenderContext;
  let properties: { [key: string]: FormNode };
  let parentId: string;
  let parentDataPath: string;

  if (isRenderContext(contextOrProps)) {
    context = contextOrProps;
    properties = propsOrId as { [key: string]: FormNode };
    parentId = idOrPath;
    parentDataPath = path || "";
  } else {
    if (!activeContext) throw new Error("RenderContext missing in renderProperties");
    context = activeContext;
    properties = contextOrProps as { [key: string]: FormNode };
    parentId = propsOrId as string;
    parentDataPath = idOrPath;
  }

  const groups = context.config.layout.groups[parentId] || [];
  const groupedKeys = new Set(groups.flatMap((g: { keys: string[]; title?: string; className?: string; }) => g.keys));
 
  // Render groups
  const groupsHtml = templates.renderFragment(groups.map((group: { keys: string[]; title?: string; className?: string; }) => {
    const groupContent = templates.renderFragment(group.keys
      .map(key => properties[key] ? renderNode(context, properties[key], parentId, false, `${parentDataPath}/${key}`) : templates.renderFragment([]))
    );
    return templates.renderLayoutGroup(group.title, groupContent, group.className);
  }));

  // Filter out grouped keys for the remaining list
  const remainingKeys = Object.keys(properties).filter(k => !groupedKeys.has(k));

  const keys = remainingKeys.sort((a, b) => {
    const nodeA = properties[a];
    const nodeB = properties[b];
    
    // 1. Priority fields (e.g. name, id, enabled)
    const priority = context.config.sorting.perObjectPriority[parentId] || context.config.sorting.defaultPriority;
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

  const remainingHtml = templates.renderFragment(keys
    .map(key => renderNode(context, properties[key], parentId, false, `${parentDataPath}/${key}`))
  );

  return templates.renderFragment([groupsHtml, remainingHtml]) as T;
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

export function hydrateNodeWithData(node: FormNode, data: any): FormNode {
  if (data === undefined) return node;
  
  const newNode = { ...node };

  if (newNode.type === 'object' && newNode.properties && typeof data === 'object' && data !== null) {
    newNode.properties = { ...newNode.properties };
    for (const key in newNode.properties) {
      newNode.properties[key] = hydrateNodeWithData(newNode.properties[key], data[key]);
    }
  } else if (['string', 'number', 'integer', 'boolean'].includes(newNode.type)) {
    let isValid = true;
    if (newNode.enum && newNode.enum.length > 0) {
      if (!newNode.enum.includes(data)) {
        isValid = false;
      }
    }
    if (isValid) {
      newNode.defaultValue = data;
    }
  }
  
  return newNode;
}

function validateAndShowErrors(context: RenderContext) {
  if (!context.rootNode) return;
  const data = context.store.get();
  const errors = validateData(data);
  
  // Clear existing errors
  document.querySelectorAll('.validation-error').forEach(el => el.remove());
  document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

  if (errors) {
    errors.forEach(err => {
      const elementId = context.dataPathRegistry.get(err.instancePath);
      if (elementId) {
        const el = document.getElementById(elementId);
        if (el) {
          el.classList.add('is-invalid');
          const msg = document.createElement('div');
          msg.className = 'validation-error text-red-500 text-sm mt-1';
          msg.textContent = err.message || "Invalid value";
          el.parentElement?.appendChild(msg);
        }
      }
    });
  }
}

function attachInteractivity(context: RenderContext, container: HTMLElement) {
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
            const parentObj = context.store.getPath(path);
            if (parentObj && typeof parentObj === 'object') {
              const val = parentObj[oldKey!] || {}; // Default to empty object if new
              if (oldKey) delete parentObj[oldKey];
              if (newKey) parentObj[newKey] = val;
              context.store.setPath(path, parentObj);
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
      context.store.setPath(path, value);
    }
    
    validateAndShowErrors(context);
  });
  
  // Initialize toggles
  container.querySelectorAll('[data-toggle-target]').forEach(el => el.dispatchEvent(new Event('change', { bubbles: true })));

  // 2. OneOf Selector
  container.addEventListener('change', (e) => {
    const target = e.target as HTMLSelectElement;
    if (target.classList.contains('js_oneof-selector')) {
      const elementId = target.getAttribute('data-id');
      const node = context.nodeRegistry.get(elementId!);
      const contentContainer = document.getElementById(`${elementId}__oneof_content`);
      
      if (node && node.oneOf && contentContainer) {
        const selectedIdx = parseInt(target.value, 10);
        let selectedNode = node.oneOf[selectedIdx];

        // Preserve Data Logic
        const storePath = resolvePath(elementId!);
        if (storePath) {
          const currentData = context.store.getPath(storePath);
           if (currentData) {
             selectedNode = hydrateNodeWithData(selectedNode, currentData);
           }
        }

        // Use the current elementId as the base path for the child option to ensure correct nesting
        const path = elementId!;
        const parentDataPath = context.elementIdToDataPath.get(elementId!) || "";
        contentContainer.innerHTML = renderNode(context, selectedNode, path, true, parentDataPath) as unknown as string;

        // Update Store with new structure (merging common props + new oneOf defaults)
        if (storePath) {
          const currentData = context.store.getPath(storePath) || {};
          const newData: any = {};
          
          // 1. Preserve Common Properties
          if (node.properties) {
            for (const key in node.properties) {
              if (currentData[key] !== undefined) {
                newData[key] = currentData[key];
              }
            }
          }
          
          // 2. Merge New Option Defaults (hydrated with current data to preserve overlaps)
          const hydratedOption = hydrateNodeWithData(selectedNode, currentData);
          const optionData = generateDefaultData(hydratedOption);
          
          if (typeof optionData === 'object' && optionData !== null) {
             Object.assign(newData, optionData);
          }
          
          context.store.setPath(storePath, newData);
        }
        validateAndShowErrors(context);
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
      const node = context.nodeRegistry.get(elementId!);
      
      if (node && node.items) {
        const container = document.getElementById(targetContainerId!);
        const index = container!.children.length;
        const itemTitle = `Item ${index + 1}`;
        const itemNode = { ...node.items, title: itemTitle };
        const parentDataPath = context.elementIdToDataPath.get(elementId!) || "";
        const itemDataPath = `${parentDataPath}/${index}`;
        const innerHtml = renderNode(context, itemNode, `${elementId}.${index}`, false, itemDataPath) as unknown as string;
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
        const defaultValue = generateDefaultData(node.items);
        context.store.setPath(itemPath, defaultValue);
        validateAndShowErrors(context);
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
        context.store.removePath(path);

        if (baseId) updateArrayIndices(arrayContainer as HTMLElement, index, baseId);
        container.dispatchEvent(new Event('change', { bubbles: true }));
        validateAndShowErrors(context);
      }
    }

    // 5. Additional Properties Add
    if (target.classList.contains('js_btn-add-ap')) {
      const elementId = target.getAttribute('data-id');
      const node = context.nodeRegistry.get(elementId!);
      const container = target.parentElement?.querySelector('.js_ap-items');
      
      if (node && container) {
        const index = container.children.length;
        const valueSchema = typeof node.additionalProperties === 'object' ? node.additionalProperties : { type: 'string', title: 'Value' } as FormNode;
        const valueNode = { ...valueSchema, title: 'Value', key: 'Value' };
        // APs are tricky for data path mapping because key is dynamic. 
        // We use a placeholder or skip validation mapping for now.
        const valueHtml = renderNode(context, valueNode, `${elementId}.__ap_${index}`, false, `${context.elementIdToDataPath.get(elementId!) || ""}/__ap_${index}`) as unknown as string;
        
        let defaultKey = "";
        const renderer = findCustomRenderer(context, elementId || "");
        
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
          context.store.setPath([...path, defaultKey], generateDefaultData(valueSchema));
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
           context.store.removePath([...path, keyInput.value]);
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
