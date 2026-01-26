import {
  h,
  renderObject,
  renderProperties,
  domRenderer,
  setI18n,
  setConfig,
  setCustomRenderers,
} from "../src/index";

// Apply global I18N overrides
setI18n({
  keys: {
    "Map_of_Route": "Routes" // Rename "Map of Route" to "Routes" in the UI
  }
});

// Configure global visibility rules
setConfig({
  visibility: {
    // Custom visibility logic based on node description and path
    customVisibility: (node, path) => {
      const description = node.description || "";
      const lowerPath = path.toLowerCase();
      
      if (lowerPath.includes(".input") && description.includes("Publisher only")) {
        return false;
      }
      if (lowerPath.includes(".output") && description.includes("Consumer only")) {
        return false;
      }
      return true;
    }
  }
});

/**
 * Custom renderer for TLS configuration.
 * It renders a checkbox for the 'required' property and toggles the visibility of other properties.
 */
export const tlsRenderer = {
  render: (node, path, elementId, dataPath, context) => {
    const requiredProp = node.properties?.["required"];
    
    // Fallback to standard object rendering if 'required' property is missing
    if (!requiredProp) {
      return renderObject(context, node, path, elementId, false, dataPath);
    }

    const otherProps = { ...node.properties };
    delete otherProps["required"];
    
    const requiredId = `${elementId}.required`;
    const checkbox = domRenderer.renderBoolean(requiredProp, requiredId, `data-toggle-target="${elementId}-options"`);
    const optionsContent = renderProperties(context, otherProps, elementId, dataPath);

    return h('fieldset', { className: 'border p-3 rounded mb-3 ui_tls', id: elementId },
      h('legend', { className: 'h6' }, node.title),
      checkbox,
      h('div', { id: `${elementId}-options`, style: 'display: none;', className: 'mt-3' }, optionsContent)
    );
  }
};

/**
 * Custom renderer for Routes (Map/Dictionary).
 * It handles dynamic keys for additional properties and provides a custom UI for adding/removing routes.
 */
export const routesRenderer = {
  render: (node, path, elementId, dataPath, context) => {
    return renderObject(context, node, path, elementId, false, dataPath, {
      additionalProperties: { title: null }
    });
  },
  getDefaultKey: (index) => `Route ${index + 1}`,
  renderAdditionalPropertyRow: (valueHtml, defaultKey, uniqueId) => {
    const keyInputAttrs = {
      type: 'text',
      className: 'form-control form-control-sm fw-bold ap-key js_ap-key',
      placeholder: 'Route name',
      value: defaultKey,
    };
    if (uniqueId) keyInputAttrs.id = uniqueId;
    
    const labelAttrs = { className: 'form-label fw-bold mb-0 text-nowrap' };
    if (uniqueId) labelAttrs.for = uniqueId;

    return h('div', { className: 'mb-4 border rounded shadow-sm ap-row js_ap-row' },
      h('div', { className: 'd-flex align-items-center justify-content-between p-3 bg-light border-bottom rounded-top' },
        h('div', { className: 'd-flex align-items-center gap-2 flex-grow-1', style: 'max-width: 70%;' },
          h('label', labelAttrs, 'Route Name:'),
          h('input', keyInputAttrs)
        ),
        h('button', { type: 'button', className: 'btn btn-sm btn-outline-danger btn-remove-ap js_btn-remove-ap' }, 'Remove Route')
      ),
      h('div', { className: 'p-3 flex-grow-1' }, valueHtml)
    );
  }
};

/**
 * Registry of custom renderers.
 */
export const CUSTOM_RENDERERS = {
  "tls": tlsRenderer,
  "routes": routesRenderer,
  "output.mode": { render: () => document.createDocumentFragment() },
  "value": {
    render: (node, path, elementId, dataPath, context) => {
      // Only render "Value" headless if it is part of the Routes list
      if (elementId.startsWith("Routes.")) {
        const props = node.properties ? renderProperties(context, node.properties, elementId, dataPath) : domRenderer.renderFragment([]);
        const ap = domRenderer.renderAdditionalProperties(node, elementId);
        const oneOf = domRenderer.renderOneOf(node, elementId);
        const content = domRenderer.renderFragment([props, ap, oneOf]);
        return domRenderer.renderHeadlessObject(elementId, content);
      }
      // Fallback for other "Value" nodes
      return renderObject(context, node, path, elementId, false, dataPath);
    }
  }
};

// 4. Apply the renderers
setCustomRenderers(CUSTOM_RENDERERS);