import { CustomRenderer, renderObject, renderProperties } from "./renderer";
import * as templates from "./templates";
import { setI18n } from "./i18n";
import { setConfig } from "./config";

// Apply global I18N overrides
setI18n({
  keys: {
    "Map_of_Route": "Routes"
  }
});

setConfig({
  visibility: {
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

export const tlsRenderer: CustomRenderer = {
  render: (node, path, elementId) => {
    const requiredProp = node.properties?.["required"];
    
    // Fallback to standard object rendering if 'required' property is missing
    if (!requiredProp) {
      return renderObject(node, path, elementId);
    }

    const otherProps = { ...node.properties };
    delete otherProps["required"];
    
    const requiredId = `${elementId}.required`;
    const checkbox = templates.renderBoolean(requiredProp, requiredId, `data-toggle-target="${elementId}-options"`);
    const optionsHtml = renderProperties(otherProps, elementId);

    return `
      <fieldset class="border p-3 rounded mb-3 ui_tls" id="${elementId}">
          <legend class="h6">${node.title}</legend>
          ${checkbox}
          <div id="${elementId}-options" style="display: none;" class="mt-3">
              ${optionsHtml}
          </div>
      </fieldset>`;
  }
};

export const routesRenderer: CustomRenderer = {
  render: (node, _path, elementId) => {
    const props = node.properties ? renderProperties(node.properties, elementId) : '';
    // Hide title (null). Key generation is handled by getDefaultKey below.
    const ap = templates.renderAdditionalProperties(node, elementId, { title: null });
    const oneOf = templates.renderOneOf(node, elementId);
    return templates.renderObject(node, elementId, props + ap + oneOf);
  },
  getDefaultKey: (index) => `Route ${index + 1}`,
  renderAdditionalPropertyRow: (valueHtml, defaultKey, uniqueId) => {
    const idAttr = uniqueId ? `id="${uniqueId}"` : "";
    const forAttr = uniqueId ? `for="${uniqueId}"` : "";
    return `
    <div class="mb-4 border rounded shadow-sm ap-row js_ap-row">
      <div class="d-flex align-items-center justify-content-between p-3 bg-light border-bottom rounded-top">
        <div class="d-flex align-items-center gap-2 flex-grow-1" style="max-width: 70%;">
            <label class="form-label fw-bold mb-0 text-nowrap" ${forAttr}>Route Name:</label>
            <input type="text" class="form-control form-control-sm fw-bold ap-key js_ap-key" placeholder="Route name" value="${defaultKey}" ${idAttr}>
        </div>
        <button type="button" class="btn btn-sm btn-outline-danger btn-remove-ap js_btn-remove-ap">Remove Route</button>
      </div>
      <div class="p-3 flex-grow-1">${valueHtml}</div>
    </div>`;
  }
};

export const CUSTOM_RENDERERS: Record<string, CustomRenderer> = {
  "tls": tlsRenderer,
  "routes": routesRenderer,
  "output.mode": { render: () => "" },
  "value": {
    render: (node, path, elementId) => {
      // Only render "Value" headless if it is part of the Routes list
      if (elementId.startsWith("Routes.")) {
        const props = node.properties ? renderProperties(node.properties, elementId) : '';
        const ap = templates.renderAdditionalProperties(node, elementId);
        const oneOf = templates.renderOneOf(node, elementId);
        return templates.renderHeadlessObject(elementId, props + ap + oneOf);
      }
      // Fallback for other "Value" nodes
      return renderObject(node, path, elementId);
    }
  }
};