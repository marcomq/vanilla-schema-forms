import { RenderContext } from "./types";
import { FormNode } from "./parser";
import { renderNode, findCustomRenderer, hydrateNodeWithData } from "./renderer";
import { generateDefaultData } from "./form-data-reader";
import { validateData } from "./validator";
import { domRenderer } from "./dom-renderer";

export function attachInteractivity(context: RenderContext, container: HTMLElement) {
  setupVisibilityHandlers(container);
  setupStoreIntegration(context, container);
  setupOneOfHandlers(context, container);
  setupActionHandlers(context, container);
}

function setupVisibilityHandlers(container: HTMLElement) {
  container.addEventListener('change', (e) => {
    const target = e.target as HTMLElement;
    if (target.hasAttribute('data-toggle-target')) {
      const targetId = target.getAttribute('data-toggle-target');
      const el = document.getElementById(targetId!);
      if (el) {
        // Checkbox or Radio
        const input = target as HTMLInputElement;
        const isChecked = input.checked;
        el.style.display = isChecked ? 'block' : 'none';
      }
    }
  });

  // Initialize toggles
  container.querySelectorAll('[data-toggle-target]').forEach(el => el.dispatchEvent(new Event('change', { bubbles: true })));
}

function setupStoreIntegration(context: RenderContext, container: HTMLElement) {
  // Initialize data-original-key for AP keys to track renames
  container.querySelectorAll('.js_ap-key').forEach(el => {
    const input = el as HTMLInputElement;
    input.setAttribute('data-original-key', input.value);
  });

  container.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    if (!target.id) return;

    // Ignore internal selector inputs (handled by change listener for UI, not data)
    if (target.id.endsWith('__selector')) return;

    // Handle AP Key Rename
    if (target.classList.contains('js_ap-key')) {
      handleApKeyRename(context, target as HTMLInputElement);
    } else {
      // Handle Value Update
      handleValueUpdate(context, target);
    }
    
    validateAndShowErrors(context);
  });
}

function handleApKeyRename(context: RenderContext, target: HTMLInputElement) {
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
}

function handleValueUpdate(context: RenderContext, target: HTMLInputElement | HTMLSelectElement): void {
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

function setupOneOfHandlers(context: RenderContext, container: HTMLElement) {
  container.addEventListener('change', (e) => {
    const target = e.target as HTMLSelectElement;
    if (target.classList.contains('js_oneof-selector')) {
      handleOneOfChange(context, target);
    }
  });
  
  // Initialize OneOfs
  container.querySelectorAll('.js_oneof-selector').forEach(el => el.dispatchEvent(new Event('change', { bubbles: true })));
}

function handleOneOfChange(context: RenderContext, target: HTMLSelectElement) {
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
    contentContainer.innerHTML = '';
    contentContainer.appendChild(renderNode(context, selectedNode, path, true, parentDataPath));

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

function setupActionHandlers(context: RenderContext, container: HTMLElement) {
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    
    if (target.classList.contains('js_btn-add-array-item')) {
      handleArrayAddItem(context, target);
    } else if (target.classList.contains('js_btn-remove-item')) {
      handleArrayRemoveItem(context, target, container);
    } else if (target.classList.contains('js_btn-add-ap')) {
      handleApAddItem(context, target);
    } else if (target.classList.contains('js_btn-remove-ap')) {
      handleApRemoveItem(context, target, container);
    }
  });
}

function handleArrayAddItem(context: RenderContext, target: HTMLElement) {
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
    const innerNode = renderNode(context, itemNode, `${elementId}.${index}`, false, itemDataPath);
    const itemNodeWrapper = domRenderer.renderArrayItem(innerNode);
    container!.appendChild(itemNodeWrapper);

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

function handleArrayRemoveItem(context: RenderContext, target: HTMLElement, container: HTMLElement) {
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

function handleApAddItem(context: RenderContext, target: HTMLElement) {
  const elementId = target.getAttribute('data-id');
  const node = context.nodeRegistry.get(elementId!);
  const container = target.parentElement?.querySelector('.js_ap-items');
  
  if (node && container) {
    const index = container.children.length;
    const valueSchema = typeof node.additionalProperties === 'object' ? node.additionalProperties : { type: 'string', title: 'Value' } as FormNode;
    const valueNode = { ...valueSchema, title: 'Value', key: 'Value' };
    // APs are tricky for data path mapping because key is dynamic. 
    // We use a placeholder or skip validation mapping for now.
    const valueNodeRendered = renderNode(context, valueNode, `${elementId}.__ap_${index}`, false, `${context.elementIdToDataPath.get(elementId!) || ""}/__ap_${index}`);
    
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
    
    const rowNode = renderer?.renderAdditionalPropertyRow 
      ? renderer.renderAdditionalPropertyRow(valueNodeRendered, defaultKey, uniqueId)
      : domRenderer.renderAdditionalPropertyRow(valueNodeRendered, defaultKey, uniqueId);
    container.appendChild(rowNode);

    // Initialize OneOfs in the new row
    const newRow = container.lastElementChild;
    if (newRow) {
      // Initialize data-original-key for the new key input to support immediate renaming
      const newKeyInput = newRow.querySelector('.js_ap-key') as HTMLInputElement;
      if (newKeyInput) {
        newKeyInput.setAttribute('data-original-key', newKeyInput.value);
      }
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

function handleApRemoveItem(context: RenderContext, target: HTMLElement, container: HTMLElement) {
  const row = target.closest('.js_ap-row');
  // Note: Removing APs from store is tricky because we need the Key.
  // The readFormData logic handles this by rescraping, but for pure reactivity we'd need to know the key.
  // For now, we rely on the fact that the DOM removal stops it from being read, 
  // BUT since we are decoupling, we should ideally remove it from store.
  // Implementation: Find the key input in the row.
  const keyInput = row?.querySelector('.js_ap-key') as HTMLInputElement;
  const apElement = target.closest('.js_additional-properties');
  const elementId = apElement?.getAttribute('element-id');

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