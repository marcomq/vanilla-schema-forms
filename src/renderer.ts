import { FormNode } from "./parser";
import { RenderContext, CustomRenderer } from "./types";
import { attachInteractivity } from "./events";
import { domRenderer, rendererConfig } from "./dom-renderer";

export const DEFAULT_CUSTOM_RENDERERS: Record<string, CustomRenderer<any>> = {
  "mode": {
    widget: "select",
    options: ["consumer", "subscriber"]
  }
};

/**
 * Renders a form into the container based on the parsed schema tree.
 * @param rootNode - The root FormNode of the schema.
 * @param formContainer - The HTML element to render the form into.
 */
export function renderForm(formContainer: HTMLElement, context: RenderContext) {
  const node = renderNode(context, context.rootNode, "", false, "");
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
      }
    }
  }
  return bestMatch;
}

export function renderNode(context: RenderContext, node: FormNode, path: string, headless: boolean = false, dataPath: string = ""): Node {
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
  // Do not register headless nodes in the dataPathRegistry.
  // Headless nodes (like oneOf variants) share a dataPath with their parent wrapper.
  // If they register, they overwrite the parent's entry, breaking validation message mapping,
  // because the headless node itself has no validation placeholder.
  if (!headless) {
    context.dataPathRegistry.set(dataPath, elementId);
  }
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
}

export function renderObject(context: RenderContext, node: FormNode, _path: string, elementId: string, headless: boolean, dataPath: string, options?: { additionalProperties?: { title?: string | null, keyPattern?: string } }): Node {
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

        const valueSchema = typeof node.additionalProperties === 'object' ? node.additionalProperties : { type: 'string' } as FormNode;
        const valueNode = hydrateNodeWithData(valueSchema, node.defaultValue[key]);
        valueNode.title = key;
        valueNode.key = undefined;

        const apId = `${elementId}.__ap_${apIndex}`;
        const apDataPath = `${dataPath}/__ap_${apIndex}`;

        const valueNodeRendered = renderNode(context, valueNode, apId, false, apDataPath);
        
        const uniqueId = `${apId}_key`;
        const renderer = findCustomRenderer(context, elementId);
        
        const rowNode = renderer?.renderAdditionalPropertyRow 
          ? renderer.renderAdditionalPropertyRow(valueNodeRendered, key, uniqueId)
          : domRenderer.renderAdditionalPropertyRow(valueNodeRendered, key, uniqueId);
          
        container.appendChild(rowNode);
        apIndex++;
      });
    }
  }

  const oneOf = domRenderer.renderOneOf(node, elementId);
  
  const content = domRenderer.renderFragment([props, ap, oneOf]);

  if (headless) {
    return domRenderer.renderHeadlessObject(elementId, content);
  }
  return domRenderer.renderObject(node, elementId, content);
}

export function renderProperties(context: RenderContext, properties: { [key: string]: FormNode }, parentId: string, parentDataPath: string = ""): Node {
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
