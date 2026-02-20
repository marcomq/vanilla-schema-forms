import { FormNode } from "../core/parser";
import { RenderContext, CustomRenderer } from "./types";
import { attachInteractivity } from "./events";
import { domRenderer, rendererConfig } from "./dom-renderer";
import { CONFIG } from "../core/config";
import { h } from "./hyperscript";
import { generateDefaultData } from "../core/form-data-reader";

export const DEFAULT_CUSTOM_RENDERERS: Record<string, CustomRenderer<any>> = {};

/**
 * Renders a form into the container based on the parsed schema tree.
 * @param rootNode - The root FormNode of the schema.
 * @param formContainer - The HTML element to render the form into.
 */
export function renderForm(formContainer: HTMLElement, context: RenderContext) {
  const node = renderNode(context, context.rootNode, "", false, []);
  const form = domRenderer.renderFormWrapper(node);
  
  formContainer.innerHTML = '';
  formContainer.appendChild(form);
  
  attachInteractivity(context, form as HTMLElement);
}

export function findCustomRenderer(context: RenderContext, elementId: string): CustomRenderer<Node> | undefined {
  const fullPathKey = elementId.toLowerCase();
  let maxMatchLen = -1;
  let bestMatch: CustomRenderer<Node> | undefined;

  for (const key in context.customRenderers) {
    const lowerKey = key.toLowerCase();
    if (fullPathKey === lowerKey || fullPathKey.endsWith('.' + lowerKey)) {
      if (lowerKey.length > maxMatchLen) {
        bestMatch = context.customRenderers[key];
        maxMatchLen = lowerKey.length;
      }
    }
  }
  return bestMatch;
}

export function getName(dataPath: (string | number)[]): string {
  if (!dataPath || dataPath.length === 0) return "";

  // If skipping root, and we have more than one part, drop the first one.
  // If there's only one part, it's the root itself, which we may need as the name.
  const finalParts = CONFIG.html?.skipRootFromName && dataPath.length > 1 ? dataPath.slice(1) : dataPath;

  if (finalParts.length === 0) {
    return "";
  }

  const [head, ...tail] = finalParts;
  return head + tail.map(p => `[${p}]`).join('');
}

export function toRegistryKey(path: (string | number)[]): string {
  return '/' + path.map(p => String(p).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
}

/**
 * Recursively renders a FormNode into a DOM node.
 * @param context - The render context providing configuration and registry access.
 * @param node - The FormNode to render.
 * @param path - The path from the root node to the current node, used for custom renderer lookups.
 * @param headless - Whether to render a headless node (i.e., a node without a corresponding DOM element).
 * @param dataPath - The data path from the root node to the current node, used for dataPathRegistry lookups.
 * @returns A DOM node representing the rendered FormNode.
 */
export function renderNode(context: RenderContext, node: FormNode, path: string, headless: boolean = false, dataPath: (string | number)[] = []): Node {
  let segment = node.key;
  if (!segment) {
    // If no key (e.g. root or oneOf variant), use a prefixed title to avoid collision
    // and allow resolvePath to skip it.
    let safeTitle = node.title.replace(/[^a-zA-Z0-9]/g, '');
    if (!safeTitle && node.title) {
      safeTitle = Array.from(node.title).map(c => c.charCodeAt(0).toString(16)).join('');
    }
    segment = path ? `__var_${safeTitle || 'untitled'}` : (safeTitle || 'root');
  }

  const elementId = path ? `${path}.${segment}` : segment;
  
  // Ensure root dataPath includes the root segment so that getName() produces "Root[prop]" instead of "prop"
  if (!path && dataPath.length === 0) {
    dataPath = [segment];
  }
  const name = getName(dataPath);

  if (context.config.visibility.customVisibility && !context.config.visibility.customVisibility(node, elementId)) {
    return domRenderer.renderFragment([]);
  }

  if (context.config.visibility.hiddenPaths.includes(elementId) || context.config.visibility.hiddenKeys.includes(node.title)) {
    return domRenderer.renderFragment([]);
  }
  
  // Register node for potential lookups
  context.nodeRegistry.set(elementId, node);
  // Do not register headless nodes in the dataPathRegistry.
  // Headless nodes (like oneOf variants) share a dataPath with their parent wrapper.
  // If they register, they overwrite the parent's entry, breaking validation message mapping,
  // because the headless node itself has no validation placeholder.
  if (!headless) {
    context.dataPathRegistry.set(toRegistryKey(dataPath), elementId);
  }
  context.elementIdToDataPath.set(elementId, dataPath);

  // 1. Custom Renderers
  const renderer = findCustomRenderer(context, elementId);

  if (renderer?.render) {
    return renderer.render(node, path, elementId, dataPath, context);
  }

  if (node.enum) {
    return domRenderer.renderSelect(node, elementId, node.enum.map(String), name);
  }

  // 3. Standard Types
  switch (node.type) {
    case "string": return domRenderer.renderString(node, elementId, name);
    case "number":
    case "integer": {
      // Prevent "null" string in value attribute for number inputs which causes browser warnings
      const safeNode = node.defaultValue === null ? { ...node, defaultValue: "" } : node;
      return domRenderer.renderNumber(safeNode, elementId, name);
    }
    case "boolean": return domRenderer.renderBoolean(node, elementId, name);
    case "object": return renderObject(context, node, elementId, headless, dataPath);
    case "array": {
      const isFixedSize = !!(node.prefixItems && node.prefixItems.length > 0 && !node.items);
      const arrayWrapper = domRenderer.renderArray(node, elementId, { isFixedSize });
      const itemsContainer = (arrayWrapper as Element).querySelector(`.${rendererConfig.triggers.arrayItems}`);

      // Render prefixItems (Tuple)
      if (node.prefixItems && node.prefixItems.length > 0 && itemsContainer) {
        node.prefixItems.forEach((itemNode, index) => {
          let itemData: any = undefined;
          let hasData = false;
          if (Array.isArray(node.defaultValue) && node.defaultValue.length > index) {
            itemData = node.defaultValue[index];
            hasData = true;
          }
          if (hasData) {
            const hydratedItem = hydrateNodeWithData(itemNode, itemData);
            // Don't force title for prefixItems to allow label-less rendering
            hydratedItem.key = String(index);
            const itemDataPath = [...dataPath, index];
            const renderedItem = renderNode(context, hydratedItem, elementId, false, itemDataPath);
            itemsContainer.appendChild(domRenderer.renderArrayItem(renderedItem, { isRemovable: false }));
          }
        });
      }
      // Render existing items if data is present
      // Note: prefixItems are rendered above. This block handles the variable items part of the array.
      if (Array.isArray(node.defaultValue) && node.items && itemsContainer) {
        const startIndex = node.prefixItems ? node.prefixItems.length : 0;
        node.defaultValue.slice(startIndex).forEach((itemData: any, index: number) => {
          const realIndex = startIndex + index;
          const itemNode = hydrateNodeWithData(node.items!, itemData);
          itemNode.title = itemNode.title || `Item ${realIndex + 1}`;
          itemNode.key = String(realIndex);
          const itemDataPath = [...dataPath, realIndex];
          const renderedItem = renderNode(context, itemNode, elementId, false, itemDataPath);
          itemsContainer.appendChild(domRenderer.renderArrayItem(renderedItem, { isRemovable: true }));
        });
      }
      return arrayWrapper;
    }
    case "null": return domRenderer.renderNull(node);
    default: return domRenderer.renderUnsupported(node);
  }
}

/**
 * Render an object node with its oneOf, properties and additional properties.
 * @param context - The render context
 * @param node - The object node to render
 * @param elementId - The ID of the element to render into
 * @param headless - Whether to render the node as headless (i.e. without a border/container)
 * @param dataPath - The data path of the node
 * @param options - Optional options for rendering additional properties
 * @returns The rendered node
 */
export function renderObject(context: RenderContext, node: FormNode, elementId: string, headless: boolean, dataPath: (string | number)[], options?: { additionalProperties?: { title?: string | null, keyPattern?: string } }): Node {
  const name = getName(dataPath);
  const oneOf = domRenderer.renderOneOf(node, elementId, name);
  const props = node.properties ? renderProperties(context, node.properties, elementId, dataPath) : domRenderer.renderFragment([]);
  const ap = domRenderer.renderAdditionalProperties(node, elementId, options?.additionalProperties);
  
  // Hydrate existing Additional Properties
  if (node.additionalProperties && node.defaultValue && typeof node.defaultValue === 'object') {
    const container = (ap as Element).querySelector(`.${rendererConfig.triggers.additionalPropertyItems}`);
    if (container) {
      const definedProps = new Set(node.properties ? Object.keys(node.properties) : []);
      let apIndex = 0;
      
      Object.keys(node.defaultValue).forEach((key) => {
        if (definedProps.has(key)) return;

        const valueSchema = typeof node.additionalProperties === 'object' ? node.additionalProperties : { type: 'string', title: '' } as FormNode;
        const valueNode = hydrateNodeWithData(valueSchema, node.defaultValue[key]);
        valueNode.title = key; // Use key as title for display
        valueNode.key = key;   // Use key for segment generation

        const apDataPath = [...dataPath, key];

        const apId = `${elementId}.__ap_${apIndex}`; // This is the unique internal ID for the row
        // Render headless to avoid double borders (AP row already has border/container)
        // Pass apId as the path prefix for all children of this AP value.
        const valueNodeRendered = renderNode(context, valueNode, apId, true, apDataPath);
        const uniqueId = `${apId}_key`;
        const renderer = findCustomRenderer(context, elementId);
        
        const rowNode = renderer?.renderAdditionalPropertyRow 
          ? renderer.renderAdditionalPropertyRow(valueNodeRendered, key, uniqueId, dataPath, context)
          : domRenderer.renderAdditionalPropertyRow(valueNodeRendered, key, uniqueId);
          
        container.appendChild(rowNode);
        apIndex++;
      });
    }
  }

  const content = domRenderer.renderFragment([oneOf, props, ap]);

  if (headless) {
    return domRenderer.renderHeadlessObject(elementId, content);
  }
  return domRenderer.renderObject(node, elementId, content);
}

/**
 * Renders a list of properties in a given node.
 * The properties are first grouped according to the given layout configuration.
 * The remaining properties are rendered in alphabetical order.
 * @param context - The render context providing configuration and registry access.
 * @param properties - A map of property keys to their corresponding FormNode objects.
 * @param parentId - The ID of the parent node.
 * @param parentDataPath - The data path from the root node to the parent node.
 * @returns A DOM node representing the rendered properties.
 */
export function renderProperties(context: RenderContext, properties: { [key: string]: FormNode }, parentId: string, parentDataPath: (string | number)[] = []): Node {
  const groups = context.config.layout.groups[parentId] || [];
  const groupedKeys = new Set(groups.flatMap((g: { keys: string[]; title?: string; className?: string; }) => g.keys));
 
  // Render groups
  const groupsHtml = domRenderer.renderFragment(groups.map((group: { keys: string[]; title?: string; className?: string; }) => {
    const groupContent = domRenderer.renderFragment(group.keys
      .map(key => properties[key] ? renderNode(context, properties[key], parentId, false, [...parentDataPath, key]) : domRenderer.renderFragment([]))
    );
    return domRenderer.renderLayoutGroup(group.title, groupContent, group.className);
  }));

  // Filter out grouped keys for the remaining list
  const remainingKeys = Object.keys(properties).filter(k => !groupedKeys.has(k));

  const keys = remainingKeys.sort((a, b) => {
    const nodeA = properties[a];
    const nodeB = properties[b];

    // 0. Render last
    const renderLast = context.config.sorting.defaultRenderLast || [];
    const isALast = renderLast.includes(a.toLowerCase());
    const isBLast = renderLast.includes(b.toLowerCase());
    if (isALast !== isBLast) {
      return isALast ? 1 : -1;
    }
    
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

  const remainingHtml = domRenderer.renderFragment(keys
    .map(key => renderNode(context, properties[key], parentId, false, [...parentDataPath, key]))
  );

  return domRenderer.renderFragment([groupsHtml, remainingHtml]);
}

export function hydrateNodeWithData(node: FormNode, data: any): FormNode {
  if (data === undefined) return node;
  
  const newNode = { ...node };

  if (newNode.type === 'object' && typeof data === 'object' && data !== null) {
    newNode.defaultValue = data;
    if (newNode.properties) {
      newNode.properties = { ...newNode.properties };
      for (const key in newNode.properties) {
        newNode.properties[key] = hydrateNodeWithData(newNode.properties[key], data[key]);
      }
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
  } else if (newNode.type === 'array' && Array.isArray(data)) {
    newNode.defaultValue = data;
  }
  
  return newNode;
}

/**
 * Reusable renderer factory for arrays with oneOf items.
 * It renders a select dropdown to choose the item type when adding a new item.
 */
export const createTypeSelectArrayRenderer = ({
  buttonLabel = "Add Item",
  itemLabel = "Item",
}: { buttonLabel?: string, itemLabel?: string } = {}): CustomRenderer<Node> => ({
  render: (node: FormNode, path: string, elementId: string, dataPath: (string | number)[], context: RenderContext) => {
    const itemsContainerId = `${elementId}-items`;
    const itemsContainer = h("div", {
      className: rendererConfig.classes.arrayItems,
      id: itemsContainerId,
    });

    // Helper to render a single item
    const renderItem = (itemData: any, index: number) => {
      let selectedOption = node.items!.oneOf ? node.items!.oneOf![0] : node.items!;

      if (itemData && typeof itemData === "object" && node.items!.oneOf) {
        const dataKeys = Object.keys(itemData);
        node.items!.oneOf!.forEach((opt) => {
          if (opt.properties) {
            const propKeys = Object.keys(opt.properties);
            if (propKeys.length === 1 && dataKeys.includes(propKeys[0])) {
              selectedOption = opt;
            }
          }
        });
      }

      let itemNodeToRender = selectedOption;
      let itemPath = `${path}.${index}`;
      let itemDataPath = [...dataPath, index];

      // Unwrap single-property objects to reduce nesting
      if (
        selectedOption.properties &&
        Object.keys(selectedOption.properties).length === 1
      ) {
        const propName = Object.keys(selectedOption.properties)[0];
        itemNodeToRender = selectedOption.properties[propName];
        itemPath = `${itemPath}.${propName}`;
        itemDataPath = [...itemDataPath, propName];

        if (!itemNodeToRender.title) {
          itemNodeToRender = {
            ...itemNodeToRender,
            title:
              selectedOption.title ||
              propName.charAt(0).toUpperCase() + propName.slice(1),
          };
        }
      } else {
        itemNodeToRender = {
          ...selectedOption,
          title: selectedOption.title || `${itemLabel} ${index + 1}`,
        };
      }

      const itemEl = renderNode(
        context,
        itemNodeToRender,
        itemPath,
        false,
        itemDataPath,
      );
      return domRenderer.renderArrayItem(itemEl);
    };

    // Render existing items
    if (Array.isArray(node.defaultValue)) {
      node.defaultValue.forEach((itemData: any, index: number) => {
        itemsContainer.appendChild(renderItem(itemData, index));
      });
    }

    const addBtn = h(
      "button",
      {
        type: "button",
        className: rendererConfig.classes.buttonPrimary,
        onclick: (e: any) => {
          e.currentTarget.style.display = "none";
          const select = e.currentTarget.nextElementSibling;
          select.style.display = "inline-block";
          select.focus();
          if (select.showPicker) select.showPicker();
        },
      },
      buttonLabel,
    );

    if (!node.items!.oneOf) {
      // Fall back to a consistent fieldset structure for non-oneOf arrays
      return h(
        "fieldset",
        { className: rendererConfig.classes.fieldset, id: elementId },
        h("legend", { className: rendererConfig.classes.legend }, node.title),
        node.description
          ? h("div", { className: rendererConfig.classes.description }, node.description)
          : "",
        itemsContainer,
      );
    }

    const options = node.items!.oneOf!
      .map((option, index) => {
        if (
          option.type === "null" ||
          (option.title && option.title.toLowerCase() === "null")
        )
          return null;
        return h(
          "option",
          { value: index },
          option.title || `Option ${index + 1}`,
        );
      })
      .filter((o) => o !== null);
    options.unshift(
      h(
        "option",
        { value: "", selected: true, disabled: true },
        "Select type...",
      ),
    );

    const select = h(
      "select",
      {
        className: rendererConfig.classes.select,
        style: "display: none; width: auto; margin-top: 0.5rem;",
        onchange: (e: any) => {
          const selectedIndex = parseInt(e.target.value, 10);
          if (isNaN(selectedIndex)) return;
          e.target.value = "";
          e.target.style.display = "none";
          addBtn.style.display = "inline-block";

          const fullPath = context.elementIdToDataPath.get(elementId);
          if (!fullPath) return;

          // The store path should not include the root segment.
          const storePath = fullPath.length > 1 ? fullPath.slice(1) : [];

          const currentData = context.store.getPath(storePath) || [];
          const newItemIndex = currentData.length;
          const selectedOption = node.items!.oneOf![selectedIndex];
          const newData = generateDefaultData(selectedOption);
          context.store.setPath([...storePath, newItemIndex], newData);

          const wrapper = renderItem(newData, newItemIndex);
          itemsContainer.appendChild(wrapper);
        },
        onblur: (e: any) => {
          e.target.value = "";
          e.target.style.display = "none";
          addBtn.style.display = "inline-block";
        },
      },
      ...options,
    );

    return h(
      "fieldset",
      { className: rendererConfig.classes.fieldset, id: elementId },
      h("legend", { className: rendererConfig.classes.legend }, node.title),
      node.description
        ? h("div", { className: rendererConfig.classes.description }, node.description)
        : "",
      itemsContainer,
      addBtn,
      select,
    );
  },
});

/**
 * Reusable renderer factory for objects with advanced/collapsible options.
 * Properties not in 'alwaysVisible' or 'required' are hidden behind a "Show more" toggle.
 */
export const createAdvancedOptionsRenderer = (alwaysVisibleKeys: string[] = []): CustomRenderer<Node> => ({
  render: (node: FormNode, _path: string, elementId: string, dataPath: (string | number)[], context: RenderContext) => {
    // Fallback for primitives (e.g. "static" endpoint which is a string, not an object)
    if (node.type !== "object") {
      const name = getName(dataPath);
      if (node.type === "string")
        return domRenderer.renderString(node, elementId, name);
      if (node.type === "boolean")
        return domRenderer.renderBoolean(node, elementId, name);
      if (node.type === "number" || node.type === "integer") {
        const safeNode =
          node.defaultValue === null ? { ...node, defaultValue: "" } : node;
        return domRenderer.renderNumber(safeNode, elementId, name);
      }
      return domRenderer.renderUnsupported(node);
    }

    const visibleProps: Record<string, FormNode> = {};
    const advancedProps: Record<string, FormNode> = {};
    const alwaysVisible = new Set(alwaysVisibleKeys);

    if (node.properties) {
      Object.keys(node.properties).forEach((key) => {
        const prop = node.properties![key];
        if (prop.required || alwaysVisible.has(key)) {
          visibleProps[key] = prop;
        } else {
          advancedProps[key] = prop;
        }
      });
    }

    const visibleContent = renderProperties(
      context,
      visibleProps,
      elementId,
      dataPath,
    );

    let advancedContent: Node | null = null;
    let toggleBtn: Node | null = null;

    if (Object.keys(advancedProps).length > 0) {
      const optionsId = `${elementId}-options`;
      advancedContent = h(
        "div",
        {
          id: optionsId,
          style: "display: none;",
          className: "",
        },
        renderProperties(context, advancedProps, elementId, dataPath),
      );

      toggleBtn = h(
        "button",
        {
          type: "button",
          className: "btn btn-sm btn-link p-0 text-decoration-none mt-2",
          onclick: (e: any) => {
            const el = e.currentTarget;
            const elOptions = document.getElementById(optionsId);
            if (elOptions) {
              const isHidden = elOptions.style.display === "none";
              elOptions.style.display = isHidden ? "block" : "none";
              el.textContent = isHidden ? "Hide" : "Show more...";
            }
          },
        },
        "Show more...",
      );
    }

    return h(
      "fieldset",
      { className: `${rendererConfig.classes.fieldset} ${rendererConfig.classes.objectWrapper}`, id: elementId },
      h("legend", { className: rendererConfig.classes.legend }, node.title),
      node.description
        ? h("div", { className: `${rendererConfig.classes.description}` }, node.description)
        : "",
      visibleContent,
      toggleBtn || "",
      advancedContent || "",
    );
  },
});

/**
 * Reusable renderer factory for objects where a boolean property toggles the visibility of other properties.
 * @param toggleKey - The key of the boolean property that controls visibility (default: "required").
 */
export const createOptionalRenderer = (toggleKey: string = "required"): CustomRenderer<Node> => ({
  render: (node: FormNode, _path: string, elementId: string, dataPath: (string | number)[], context: RenderContext) => {
    const toggleProp = node.properties?.[toggleKey];

    // Fallback to standard object rendering if toggle property is missing
    if (!toggleProp) {
      return renderObject(context, node, elementId, false, dataPath);
    }

    const otherProps = { ...node.properties };
    delete otherProps[toggleKey];
    
    const togglePath = [...dataPath, toggleKey];
    const name = getName(togglePath);

    const toggleId = `${elementId}.${toggleKey}`;
    const optionsId = `${elementId}-options`;
    
    const checkbox = domRenderer.renderBoolean(
      toggleProp,
      toggleId,
      name,
      `data-toggle-target="${optionsId}"`
    );
    
    const optionsContent = renderProperties(
      context,
      otherProps,
      elementId,
      dataPath,
    );

    return h(
      "fieldset",
      { className: `${rendererConfig.classes.fieldset} ${rendererConfig.classes.objectWrapper}`, id: elementId },
      h("legend", { className: rendererConfig.classes.legend }, node.title),
      checkbox,
      h(
        "div",
        {
          id: optionsId,
          style: "display: none;",
          className: "mt-3",
        },
        optionsContent,
      ),
    );
  },
});