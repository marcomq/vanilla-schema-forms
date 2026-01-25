import { FormNode } from "./parser";
import { Store } from "./state";
import { RenderContext, CustomRenderer } from "./types";
import { attachInteractivity } from "./events";
import { domRenderer } from "./dom-renderer";

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

  const node = renderNode(context, rootNode, "", false, "");
  const form = domRenderer.renderFormWrapper(node);
  
  formContainer.innerHTML = '';
  formContainer.appendChild(form);
  
  attachInteractivity(context, formContainer);
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
      }
    }
  }
  return bestMatch;
}

export function renderNode(context: RenderContext, node: FormNode, path?: string, headless?: boolean, dataPath?: string): Node;
export function renderNode(
  arg1: RenderContext | FormNode,
  arg2: FormNode | string,
  arg3: string | boolean = "",
  arg4: boolean | string = false,
  arg5: string = ""
): Node {
  let context: RenderContext;
  let node: FormNode;
  let path: string;
  let headless: boolean;
  let dataPath: string;

  if (isRenderContext(arg1)) {
    context = arg1;
    node = arg2 as FormNode;
    path = arg3 as string;
    headless = arg4 as boolean;
    dataPath = arg5;
  } else {
    if (!activeContext) throw new Error("RenderContext missing in renderNode and no active context found.");
    context = activeContext;
    node = arg1 as FormNode;
    path = arg2 as string;
    
    // Handle legacy signature variations: renderNode(node, path, headless?, dataPath?)
    if (typeof arg3 === 'string') {
      headless = false;
      dataPath = arg3;
    } else if (typeof arg3 === 'boolean') {
      headless = arg3;
      dataPath = typeof arg4 === 'string' ? arg4 : "";
    } else {
      headless = false;
      dataPath = typeof arg4 === 'string' ? arg4 : "";
    }
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
    return domRenderer.renderFragment([]);
  }

  if (context.config.visibility.hiddenPaths.includes(elementId) || context.config.visibility.hiddenKeys.includes(node.title)) {
    return domRenderer.renderFragment([]);
  }
  
  // Register node for potential lookups
  context.nodeRegistry.set(elementId, node);
  context.dataPathRegistry.set(dataPath, elementId);
  context.elementIdToDataPath.set(elementId, dataPath);

  // 1. Custom Renderers
  const renderer = findCustomRenderer(context, elementId);

  if (renderer?.render) {
    return renderer.render(node, path, elementId, dataPath, context);
  }

  // 2. Widget Overrides
  if (renderer?.widget === 'select') {
    return domRenderer.renderSelect(node, elementId, renderer.options || []);
  }

  if (node.enum) {
    return domRenderer.renderSelect(node, elementId, node.enum.map(String));
  }

  // 3. Standard Types
  switch (node.type) {
    case "string": return domRenderer.renderString(node, elementId);
    case "number":
    case "integer": {
      // Prevent "null" string in value attribute for number inputs which causes browser warnings
      const safeNode = node.defaultValue === null ? { ...node, defaultValue: "" } : node;
      return domRenderer.renderNumber(safeNode, elementId);
    }
    case "boolean": return domRenderer.renderBoolean(node, elementId);
    case "object": return renderObject(context, node, path, elementId, headless, dataPath);
    case "array": {
      const arrayWrapper = domRenderer.renderArray(node, elementId);
      // Render existing items if data is present
      if (Array.isArray(node.defaultValue) && node.items) {
        node.defaultValue.forEach((itemData: any, index: number) => {
          const itemNode = hydrateNodeWithData(node.items!, itemData);
          itemNode.title = itemNode.title || `Item ${index + 1}`;
          const itemPath = `${elementId}.${index}`;
          const itemDataPath = `${dataPath}/${index}`;
          const renderedItem = renderNode(context, itemNode, itemPath, false, itemDataPath);
          arrayWrapper.appendChild(domRenderer.renderArrayItem(renderedItem));
        });
      }
      return arrayWrapper;
    }
    case "null": return domRenderer.renderNull(node);
    default: return domRenderer.renderUnsupported(node);
  }
  } finally {
    activeContext = prevContext;
  }
}

export function renderObject(context: RenderContext, node: FormNode, path: string, elementId: string, headless: boolean, dataPath: string): Node;
export function renderObject(node: FormNode, elementId: string, headless: boolean, dataPath: string): Node;
export function renderObject(
  arg1: RenderContext | FormNode,
  arg2: FormNode | string,
  arg3: string | boolean,
  arg4: string | boolean,
  arg5: boolean | string = false,
  arg6: string = ""
): Node {
  let context: RenderContext;
  let node: FormNode;
  let elementId: string;
  let headless: boolean;
  let dataPath: string;

  if (isRenderContext(arg1)) {
    context = arg1;
    node = arg2 as FormNode;
    // arg3 is 'path', currently unused in renderObject logic but kept for signature compatibility
    elementId = arg4 as string;
    headless = arg5 as boolean;
    dataPath = arg6;
  } else {
    if (!activeContext) throw new Error("RenderContext missing in renderObject");
    context = activeContext;
    node = arg1 as FormNode;
    elementId = arg2 as string;
    
    if (typeof arg3 === 'string') {
      headless = false;
      dataPath = arg3;
    } else if (typeof arg3 === 'boolean') {
      headless = arg3;
      dataPath = typeof arg4 === 'string' ? arg4 : "";
    } else {
      headless = false;
      dataPath = typeof arg4 === 'string' ? arg4 : "";
    }
  }

  const props = node.properties ? renderProperties(context, node.properties, elementId, dataPath) : domRenderer.renderFragment([]);
  const ap = domRenderer.renderAdditionalProperties(node, elementId);
  const oneOf = domRenderer.renderOneOf(node, elementId);
  
  const content = domRenderer.renderFragment([props, ap, oneOf]);

  if (headless) {
    return domRenderer.renderHeadlessObject(elementId, content);
  }
  return domRenderer.renderObject(node, elementId, content);
}

export function renderProperties(context: RenderContext, properties: { [key: string]: FormNode }, parentId: string, parentDataPath?: string): Node;
export function renderProperties(arg1: any, arg2: any, arg3: string, arg4?: string): Node {
  let context: RenderContext;
  let properties: { [key: string]: FormNode };
  let parentId: string;
  let parentDataPath: string;

  if (isRenderContext(arg1)) {
    context = arg1;
    properties = arg2 as { [key: string]: FormNode };
    parentId = arg3;
    parentDataPath = arg4 || "";
  } else {
    if (!activeContext) throw new Error("RenderContext missing in renderProperties");
    context = activeContext;
    properties = arg1 as { [key: string]: FormNode };
    parentId = arg2 as string;
    parentDataPath = arg3;
  }

  const groups = context.config.layout.groups[parentId] || [];
  const groupedKeys = new Set(groups.flatMap((g: { keys: string[]; title?: string; className?: string; }) => g.keys));
 
  // Render groups
  const groupsHtml = domRenderer.renderFragment(groups.map((group: { keys: string[]; title?: string; className?: string; }) => {
    const groupContent = domRenderer.renderFragment(group.keys
      .map(key => properties[key] ? renderNode(context, properties[key], parentId, false, `${parentDataPath}/${key}`) : domRenderer.renderFragment([]))
    );
    return domRenderer.renderLayoutGroup(group.title, groupContent, group.className);
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

  const remainingHtml = domRenderer.renderFragment(keys
    .map(key => renderNode(context, properties[key], parentId, false, `${parentDataPath}/${key}`))
  );

  return domRenderer.renderFragment([groupsHtml, remainingHtml]);
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
  } else if (newNode.type === 'array' && Array.isArray(data)) {
    newNode.defaultValue = data;
  }
  
  return newNode;
}
