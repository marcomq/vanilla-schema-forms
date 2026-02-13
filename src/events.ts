import { RenderContext, ErrorObject } from "./types";
import { FormNode } from "./parser";
import { renderNode, findCustomRenderer, hydrateNodeWithData, getName, toRegistryKey } from "./renderer";
import { generateDefaultData } from "./form-data-reader";
import { validateData } from "./validator";
import { domRenderer } from "./dom-renderer";
import { h } from "./hyperscript";
import { rendererConfig } from "./dom-renderer";

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
  container.querySelectorAll(`.${rendererConfig.triggers.additionalPropertyKey}`).forEach(el => {
    const input = el as HTMLInputElement;
    input.setAttribute('data-original-key', input.value);
  });

  container.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    if (!target.id) return;

    // Ignore internal selector inputs (handled by change listener for UI, not data)
    if (target.id.endsWith('__selector')) return;

    // Handle AP Key Rename
    if (target.classList.contains(rendererConfig.triggers.additionalPropertyKey)) {
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
    const match = target.id.match(/(.*)\.__ap_(\d+)_key$/);
    if (match) { 
      const parentId = match[1];
      const index = match[2];
      const path = resolvePath(context, parentId); // Resolve parent path
      if (path) {
        const rawParentObj = context.store.getPath(path);
        // If the parent object doesn't exist in the store, we can't do anything.
        // This can happen if the parent is part of an uninitialized array item.
        if (rawParentObj !== undefined) {
          const parentObj = { ...rawParentObj };
          let val = parentObj[oldKey!];

          // If val is undefined, it's a new key. We need to generate default data.
          if (val === undefined) {
            let node = context.nodeRegistry.get(parentId);
            // Fallback: if node not found but path resolves to root, use rootNode
            if (!node && path.length === 0) {
              node = context.rootNode;
            }

            if (node && node.additionalProperties) {
              const valueSchema = typeof node.additionalProperties === 'object' 
                ? node.additionalProperties 
                : { type: 'string', title: 'Value' } as FormNode;
              val = generateDefaultData(valueSchema);
            } else {
              // Fallback if node not found. Default to empty object to avoid "required" errors on children.
              val = {};
            }
          }

          if (oldKey && oldKey in parentObj) delete parentObj[oldKey];
          if (newKey) parentObj[newKey] = val;
          context.store.setPath(path, parentObj);
          target.setAttribute('data-original-key', newKey);

          // Update Data Paths and Names for children
          const apId = `${parentId}.__ap_${index}`;
          const oldPath = context.elementIdToDataPath.get(apId);
          if (oldPath) {
             const basePath = oldPath.slice(0, -1);
             const newPath = [...basePath, newKey];
             
             updateDataPaths(context, apId, oldPath, newPath);
             
             const row = target.closest(`.${rendererConfig.triggers.additionalPropertyRow}`);
             if (row) {
                 const valueWrapper = row.querySelector(`.${rendererConfig.triggers.apValueWrapper}`);
                 if (valueWrapper) {
                     updateDomNames(valueWrapper as HTMLElement, oldPath, newPath);
                 }
             }
          }
        }
      }
    }
  }
}

function handleValueUpdate(context: RenderContext, target: HTMLInputElement | HTMLSelectElement): void {
  const path = resolvePath(context, target.id);
  if (!path) return;
  // If a field is cleared, remove it from the data model.
  // - For required fields, this will trigger AJV's `required` validation.
  // - For optional fields, this ensures they are omitted from the output.
  if (target.value === '') {
    context.store.removePath(path);
    return;
  }

  let value: any = target.value;
  if (target.type === 'checkbox') {
    value = (target as HTMLInputElement).checked;
  } else if (target.type === 'number' || target.type === 'range') {
    value = (target as HTMLInputElement).valueAsNumber;
    // An empty number input is handled above. A non-numeric string in a number
    // input also results in NaN. We set it to null to trigger a type error.
    if (isNaN(value)) {
      value = null;
    }
  }
  context.store.setPath(path, value);
}

function setupOneOfHandlers(context: RenderContext, container: HTMLElement) {
  container.addEventListener('change', (e) => {
    const target = e.target as HTMLSelectElement;
    if (target.classList.contains(rendererConfig.triggers.oneOfSelector)) {
      handleOneOfChange(context, target);
    }
  });
  
  // Initialize OneOfs
  container.querySelectorAll(`.${rendererConfig.triggers.oneOfSelector}`).forEach(el => el.dispatchEvent(new Event('change', { bubbles: true })));
}

function handleOneOfChange(context: RenderContext, target: HTMLSelectElement) {
  const elementId = target.getAttribute('data-id');
  const node = context.nodeRegistry.get(elementId!);
  const contentContainer = document.getElementById(`${elementId}__oneof_content`);
  
  if (node && node.oneOf && contentContainer) {
    const selectedIdx = parseInt(target.value, 10);
    let selectedNode = node.oneOf[selectedIdx];

    // Use the current elementId as the base path for the child option to ensure correct nesting
    const path = elementId!;
    const parentDataPath = context.elementIdToDataPath.get(elementId!) || [];
    contentContainer.innerHTML = '';
    contentContainer.appendChild(renderNode(context, selectedNode, path, true, parentDataPath));

    // Update Store: Replace the data for this object with the new oneOf selection's defaults.
    // This approach does not preserve values between oneOf selections, which is the safest default
    // and matches the integration test expectations.
    const storePath = resolvePath(context, elementId!);
    if (storePath) {
      const currentData = context.store.getPath(storePath) || {};
      const newData: any = {};
      
      // 1. Preserve Common Properties (i.e., properties that are siblings of the oneOf)
      if (node.properties) {
        for (const key in node.properties) {
          if (currentData[key] !== undefined) {
            newData[key] = currentData[key];
          }
        }
      }
      
      // 2. Generate and merge the default data for the newly selected option.
      const optionData = generateDefaultData(selectedNode);
      
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
    const button = target.closest('button');

    if (!button) return;
    
    if (button.classList.contains(rendererConfig.triggers.addArrayItem)) {
      handleArrayAddItem(context, button);
    } else if (button.classList.contains(rendererConfig.triggers.removeArrayItem)) {
      handleArrayRemoveItem(context, button, container);
    } else if (button.classList.contains(rendererConfig.triggers.addAdditionalProperty)) {
      handleApAddItem(context, button);
    } else if (button.classList.contains(rendererConfig.triggers.removeAdditionalProperty)) {
      handleApRemoveItem(context, button, container);
    }
  });
}

function handleArrayAddItem(context: RenderContext, target: HTMLElement) {
  const elementId = target.getAttribute('data-id');
  const targetContainerId = target.getAttribute('data-target');
  const node = context.nodeRegistry.get(elementId!);
  
  if (node) {
    const container = document.getElementById(targetContainerId!);
    if (!container) return;
    
    const index = container.children.length;
    let itemSchema: FormNode | undefined;

    if (node.prefixItems && index < node.prefixItems.length) {
      itemSchema = node.prefixItems[index];
    } else if (node.items) {
      itemSchema = node.items;
    }

    if (itemSchema) {
      const itemTitle = `Item ${index + 1}`;
      let itemNode = { ...itemSchema, title: itemTitle };
      
      let defaultValue = generateDefaultData(itemSchema);
      itemNode = hydrateNodeWithData(itemNode, defaultValue);
      itemNode.key = String(index);

      const parentDataPath = context.elementIdToDataPath.get(elementId!) || [];
      const itemDataPath = [...parentDataPath, index];
      const innerNode = renderNode(context, itemNode, elementId!, false, itemDataPath);
      const itemNodeWrapper = domRenderer.renderArrayItem(innerNode, { isRemovable: true });
      container.appendChild(itemNodeWrapper);

      // Update Store: Add default value
      const path = resolvePath(context, elementId!);
      if (path) {
        // The new item is at the index we just calculated
        const itemPath = [...path, index];
        context.store.setPath(itemPath, defaultValue);
      }

      // Initialize OneOfs in the new item
      const newItem = container.lastElementChild;
      if (newItem) {
        newItem.querySelectorAll(`.${rendererConfig.triggers.oneOfSelector}`).forEach(el => {
          el.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }

      container.dispatchEvent(new Event('change', { bubbles: true }));
      validateAndShowErrors(context);
    }
  }
}

function handleArrayRemoveItem(context: RenderContext, target: HTMLElement, container: HTMLElement) {
  const row = target.closest(`.${rendererConfig.triggers.arrayItemRow}`);
  const arrayContainer = row?.parentElement;
  if (row && arrayContainer) {
    const index = Array.from(arrayContainer.children).indexOf(row);
    
    // Derive baseId from the container ID (e.g., "root.users-items" -> "root.users")
    const baseId = arrayContainer.id && arrayContainer.id.endsWith('-items') ? arrayContainer.id.slice(0, -6) : '';

    row.remove();
    
    // Update Store: Remove item at index
    const path = resolvePath(context, baseId);
    if (path) {
      const array = context.store.getPath(path) as any[] | undefined;
      if (Array.isArray(array)) {
        const newArray = [...array.slice(0, index), ...array.slice(index + 1)];
        context.store.setPath(path, newArray);
      }
    }

    if (baseId) updateArrayIndices(context, arrayContainer as HTMLElement, index, baseId);
    container.dispatchEvent(new Event('change', { bubbles: true }));
    validateAndShowErrors(context);
  }
}

function handleApAddItem(context: RenderContext, target: HTMLElement) {
  const elementId = target.getAttribute('data-id');
  const node = context.nodeRegistry.get(elementId!);
  const wrapper = target.closest(`.${rendererConfig.triggers.additionalPropertiesWrapper}`);
  const container = wrapper?.querySelector(`.${rendererConfig.triggers.additionalPropertyItems}`);
  
  if (node && container) {
    const index = container.children.length;
    const valueSchema = typeof node.additionalProperties === 'object' ? node.additionalProperties : { type: 'string', title: 'Value' } as FormNode;
    const valueNode = { ...valueSchema, title: 'Value', key: undefined };
    // APs are tricky for data path mapping because key is dynamic. 
    
    const apId = `${elementId}.__ap_${index}`;
    
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

    // Use defaultKey if available, otherwise fallback to internal ID to ensure unique path
    const pathSegment = defaultKey || `__ap_${index}`;
    const apDataPath = [...(context.elementIdToDataPath.get(elementId!) || []), pathSegment];
    const valueNodeRendered = renderNode(context, valueNode, apId, true, apDataPath);
    context.dataPathRegistry.set(toRegistryKey(apDataPath), apId);
    context.elementIdToDataPath.set(apId, apDataPath);
    
    const uniqueId = `${elementId}.__ap_${index}_key`;
    
    const rowNode = renderer?.renderAdditionalPropertyRow 
      ? renderer.renderAdditionalPropertyRow(valueNodeRendered, defaultKey, uniqueId)
      : domRenderer.renderAdditionalPropertyRow(valueNodeRendered, defaultKey, uniqueId);
    container.appendChild(rowNode);

    // Update Store: Add new property (if key is present, otherwise it waits for input)
    // For APs, the key is dynamic. We usually wait for the user to type the key.
    // However, if we have a defaultKey, we can set it.
    if (defaultKey) {
       const path = resolvePath(context, elementId!);
       if (path) {
         context.store.setPath([...path, defaultKey], generateDefaultData(valueSchema));
       }
    }

    // Initialize OneOfs in the new row
    const newRow = container.lastElementChild;
    if (newRow) {
      // Initialize data-original-key for the new key input to support immediate renaming
      const newKeyInput = newRow.querySelector(`.${rendererConfig.triggers.additionalPropertyKey}`) as HTMLInputElement;
      if (newKeyInput) {
        newKeyInput.setAttribute('data-original-key', newKeyInput.value);
      }
      newRow.querySelectorAll(`.${rendererConfig.triggers.oneOfSelector}`).forEach(el => {
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    
    container.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function handleApRemoveItem(context: RenderContext, target: HTMLElement, container: HTMLElement) {
  const row = target.closest(`.${rendererConfig.triggers.additionalPropertyRow}`);
  // Note: Removing APs from store is tricky because we need the Key.
  // The readFormData logic handles this by rescraping, but for pure reactivity we'd need to know the key.
  // For now, we rely on the fact that the DOM removal stops it from being read, 
  // BUT since we are decoupling, we should ideally remove it from store.
  // Implementation: Find the key input in the row.
  const keyInput = row?.querySelector(`.${rendererConfig.triggers.additionalPropertyKey}`) as HTMLInputElement;
  const apElement = target.closest(`.${rendererConfig.triggers.additionalPropertiesWrapper}`);
  const elementId = apElement?.getAttribute('data-element-id');

  if (keyInput && keyInput.value) {
    if (elementId) {
       const path = resolvePath(context, elementId);
       if (path) {
         context.store.removePath([...path, keyInput.value]);
       }
    }
  }
  
  const apContainer = row?.parentElement;
  const index = apContainer ? Array.from(apContainer.children).indexOf(row!) : -1;

  row?.remove();
  
  if (apContainer && index !== -1 && elementId) {
    updateAPIndices(context, apContainer as HTMLElement, index, elementId);
  }
  container.dispatchEvent(new Event('change', { bubbles: true }));
}

export function resolvePath(contextOrId: RenderContext | string, elementId?: string): (string | number)[] | null {
  if (typeof contextOrId === 'string') {
    return resolvePathLegacy(contextOrId);
  }

  const context = contextOrId as RenderContext;
  const id = elementId;

  if (!id) return null;

  const path = context.elementIdToDataPath.get(id);
  if (!path) return null;
  // Skip root segment for store path
  if (path.length <= 1) return [];
  return path.slice(1);
}

function resolvePathLegacy(elementId: string): (string | number)[] | null {
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
    } else {
      const num = parseInt(part, 10);
      path.push(isNaN(num) ? part : num);
    }
  }
  return path;
}

function updateArrayIndices(context: RenderContext, container: HTMLElement, startIndex: number, baseId: string) {
  const rows = Array.from(container.children) as HTMLElement[];
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    const oldIndex = i + 1;
    const newIndex = i;
    const oldPrefix = `${baseId}.${oldIndex}`;
    const newPrefix = `${baseId}.${newIndex}`;

    // Update visible title (Item 1, Item 2, etc.)
    const contentWrapper = row.querySelector(`.${rendererConfig.triggers.arrayItemContent}`);
    if (contentWrapper && contentWrapper.firstElementChild) {
      const itemRoot = contentWrapper.firstElementChild as HTMLElement;
      
      // 1. Check for Legend (Fieldset)
      const legend = itemRoot.querySelector('legend');
      if (legend && /^Item \d+$/.test(legend.textContent || '')) {
        legend.textContent = `Item ${newIndex + 1}`;
      }

      // 2. Check for Label (FieldWrapper)
      const label = itemRoot.querySelector('label');
      if (label) {
        for (const child of Array.from(label.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE && /^Item \d+$/.test(child.textContent?.trim() || '')) {
            child.textContent = `Item ${newIndex + 1}`;
            break;
          }
        }
      }
    }

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

    updateRegistryEntries(context, oldPrefix, newPrefix, oldIndex, newIndex);
  }
}

function updateAPIndices(context: RenderContext, container: HTMLElement, startIndex: number, baseId: string) {
  const rows = Array.from(container.children) as HTMLElement[];
  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    const keyInput = row.querySelector(`.${rendererConfig.triggers.additionalPropertyKey}`);
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

           updateRegistryEntries(context, oldPrefix, newPrefix, `__ap_${oldIdx}`, `__ap_${newIdx}`);
         }
       }
    }
  }
}

function updateDataPaths(context: RenderContext, rootId: string, oldRootPath: (string|number)[], newRootPath: (string|number)[]) {
  const idsToUpdate: string[] = [];
  for (const id of context.elementIdToDataPath.keys()) {
    if (id === rootId || id.startsWith(rootId + '.')) {
      idsToUpdate.push(id);
    }
  }
  
  for (const id of idsToUpdate) {
    const currentPath = context.elementIdToDataPath.get(id)!;
    if (currentPath.length >= oldRootPath.length && currentPath.slice(0, oldRootPath.length).every((v, i) => v === oldRootPath[i])) {
      const suffix = currentPath.slice(oldRootPath.length);
      const nextPath = [...newRootPath, ...suffix];
      
      context.elementIdToDataPath.set(id, nextPath);
      context.dataPathRegistry.delete(toRegistryKey(currentPath));
      context.dataPathRegistry.set(toRegistryKey(nextPath), id);
    }
  }
}

function updateDomNames(container: HTMLElement, oldPath: (string|number)[], newPath: (string|number)[]) {
  const oldNamePrefix = getName(oldPath);
  const newNamePrefix = getName(newPath);
  
  const elements = container.querySelectorAll('[name]');
  elements.forEach(el => {
    const name = el.getAttribute('name');
    if (name && name.startsWith(oldNamePrefix)) {
      const nextChar = name[oldNamePrefix.length];
      if (!nextChar || nextChar === '[') {
        el.setAttribute('name', newNamePrefix + name.substring(oldNamePrefix.length));
      }
    }
  });
}

function updateRegistryEntries(context: RenderContext, oldPrefix: string, newPrefix: string, oldSegment: string|number, newSegment: string|number) {
  const keysToMove: string[] = [];
  for (const key of context.nodeRegistry.keys()) {
    if (key === oldPrefix || key.startsWith(oldPrefix + '.')) {
      keysToMove.push(key);
    }
  }

  const rootOldPath = context.elementIdToDataPath.get(oldPrefix);
  let rootNewPath: (string|number)[] | undefined;
  
  if (rootOldPath && rootOldPath[rootOldPath.length - 1] === oldSegment) {
    rootNewPath = [...rootOldPath.slice(0, -1), newSegment];
  }

  for (const oldKey of keysToMove) {
    const newKey = oldKey.replace(oldPrefix, newPrefix);
    
    const node = context.nodeRegistry.get(oldKey);
    if (node) {
      context.nodeRegistry.set(newKey, node);
      context.nodeRegistry.delete(oldKey);
    }

    const oldPath = context.elementIdToDataPath.get(oldKey);
    if (oldPath) {
      let newPath = [...oldPath];
      if (rootOldPath && rootNewPath && oldPath.length >= rootOldPath.length && oldPath.slice(0, rootOldPath.length).every((v, i) => v === rootOldPath[i])) {
        newPath = [...rootNewPath, ...oldPath.slice(rootOldPath.length)];
      } else if (oldPath[oldPath.length - 1] === oldSegment) {
         newPath = [...oldPath.slice(0, -1), newSegment];
      }
      
      context.elementIdToDataPath.set(newKey, newPath);
      context.elementIdToDataPath.delete(oldKey);
      
      context.dataPathRegistry.delete(toRegistryKey(oldPath));
      context.dataPathRegistry.set(toRegistryKey(newPath), newKey);
    }
  }
}

function findElementIdForPath(context: RenderContext, ajvPath: string): string | undefined {
  // The dataPathRegistry includes the root element name (e.g. "/Routes/prop"),
  // but AJV paths are relative to the data root (e.g. "/prop").
  // We need to prepend the root segment to the AJV path to match the registry.
  const rootNode = context.rootNode;
  const safeTitle = rootNode.title.replace(/[^a-zA-Z0-9]/g, '');
  const rootSegment = rootNode.key || safeTitle || 'root';
  const rootSegmentEscaped = rootSegment.replace(/~/g, '~0').replace(/\//g, '~1');
  const fullPath = '/' + rootSegmentEscaped + ajvPath;

  // 1. Direct lookup (works for static paths)
  if (context.dataPathRegistry.has(fullPath)) {
    return context.dataPathRegistry.get(fullPath);
  }

  // 2. Fuzzy lookup for Additional Properties (dynamic keys)
  // AJV path uses actual keys (e.g. "/route1/url"), Registry uses internal IDs (e.g. "/__ap_0/url")
  const ajvSegments = fullPath.split('/').filter(s => s);
  
  for (const [regPath, elementId] of context.dataPathRegistry.entries()) {
    const regSegments = regPath.split('/').filter(s => s);
    if (regSegments.length !== ajvSegments.length) continue;

    let match = true;
    
    for (let i = 0; i < regSegments.length; i++) {
      const regSeg = regSegments[i];
      const ajvSeg = ajvSegments[i];

      if (regSeg === ajvSeg) continue;

      // If segment differs, check if it's an AP placeholder (e.g. "__ap_0")
      if (regSeg.startsWith('__ap_')) {
        // Construct path to this AP node to find its DOM element
        const partialPath = '/' + regSegments.slice(0, i + 1).join('/');
        const rowElementId = context.dataPathRegistry.get(partialPath);
        
        if (rowElementId) {
          // The rowElementId is the ID of the value node (e.g. "...__ap_0.Value" or "...__ap_0.DefaultRoute").
          // The corresponding Key Input ID is the base row ID + "_key".
          const rowId = rowElementId.substring(0, rowElementId.lastIndexOf('.'));
          const keyInputId = `${rowId}_key`;
          const keyInput = document.getElementById(keyInputId) as HTMLInputElement;
          
          const unescapedAjvSeg = ajvSeg.replace(/~1/g, '/').replace(/~0/g, '~');
          if (keyInput && keyInput.value === unescapedAjvSeg) {
            continue; // Match found via DOM lookup
          }
        }
      }
      
      match = false;
      break;
    }

    if (match) return elementId;
  }
  
  return undefined;
}

export function validateAndShowErrors(context: RenderContext): ErrorObject[] | null {
  if (!context.rootNode) return null;
  const data = context.store.get();
  const originalErrors = validateData(data);
  const matchedErrors = new Set<ErrorObject>();
  
  // Clear existing errors from placeholders and remove invalid classes
  const formContainer = document.getElementById('generated-form');
  if (formContainer) {
    formContainer.querySelectorAll('[data-validation-for]').forEach(p => {
      p.innerHTML = '';
    });
    formContainer.querySelectorAll(`.${rendererConfig.classes.invalid}`).forEach(el => el.classList.remove(rendererConfig.classes.invalid));
  }

  // Clear global errors
  const globalErrorsContainer = document.getElementById('form-global-errors');
  if (globalErrorsContainer) {
    globalErrorsContainer.innerHTML = '';
    globalErrorsContainer.className = '';
  }

  let errors: ErrorObject[] | null = null;

  if (originalErrors) {
    // Filter out verbose sub-schema errors when a oneOf/anyOf fails.
    // The oneOf/anyOf error is more user-friendly.
    const errorsByPath = new Map<string, ErrorObject[]>();
    originalErrors.forEach(err => {
      const path = err.instancePath;
      if (!errorsByPath.has(path)) {
        errorsByPath.set(path, []);
      }
      errorsByPath.get(path)!.push(err);
    });

    errors = [];
    errorsByPath.forEach((pathErrors) => {
      const oneOfError = pathErrors.find(e => e.keyword === 'oneOf' || e.keyword === 'anyOf');
      if (oneOfError) {
        oneOfError.message = "A valid selection is required";
        errors!.push(oneOfError);

        // Also keep 'required' errors if they point to a field that is currently visible.
        // This ensures that if a user clears a required field inside a oneOf, they see the error on that field.
        pathErrors.forEach(e => {
          if (e !== oneOfError && e.keyword === 'required' && e.params.missingProperty) {
            const targetPath = e.instancePath ? `${e.instancePath}/${e.params.missingProperty}` : `/${e.params.missingProperty}`;
            const elementId = findElementIdForPath(context, targetPath);
            if (elementId) {
              const el = document.getElementById(elementId) || document.querySelector(`[data-element-id="${elementId}"]`);
              if (el) errors!.push(e);
            }
          }
        });
      } else {
        errors!.push(...pathErrors);
      }
    });

    errors.forEach(err => {
      let targetPath = err.instancePath;

      // Map 'required' errors to the specific field instead of the parent object
      if (err.keyword === 'required' && err.params.missingProperty) {
        targetPath = targetPath ? `${targetPath}/${err.params.missingProperty}` : `/${err.params.missingProperty}`;
      }

      const elementId = findElementIdForPath(context, targetPath);
      if (elementId) {
        const elToInvalidate = document.getElementById(elementId) || document.querySelector(`[data-element-id="${elementId}"]`);
        const validationPlaceholder = document.querySelector(`[data-validation-for="${elementId}"]`);

        if (elToInvalidate) {
          elToInvalidate.classList.add(rendererConfig.classes.invalid);
        }

        if (validationPlaceholder) {
          const msg = document.createElement('div');
          msg.className = `${rendererConfig.classes.error} ${rendererConfig.triggers.validationError}`;
          if (err.keyword === 'required') {
            msg.textContent = "This field is required";
          } else {
            msg.textContent = err.message || "Invalid value";
          }
          validationPlaceholder.appendChild(msg);
          // Mark this error as displayed only if we successfully found a place for it
          matchedErrors.add(err);
        }
      }
    });

    // Display errors that couldn't be matched to a specific input
    const unmatchedErrors = errors.filter(err => !matchedErrors.has(err));
    if (globalErrorsContainer) {
      if (unmatchedErrors.length > 0) {
        globalErrorsContainer.className = `${rendererConfig.classes.alertDanger} mb-3`;
        const errorList = h('ul', { className: 'mb-0 ps-3' });
        unmatchedErrors.forEach(err => {
          const errorText = `${err.instancePath || 'Schema'}: ${err.message}`;
          errorList.appendChild(h('li', {}, errorText));
        });
        globalErrorsContainer.appendChild(errorList);
      }
    }
  }

  return errors;
}