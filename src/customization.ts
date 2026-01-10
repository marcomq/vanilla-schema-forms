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
  renderAdditionalPropertyRow: (valueHtml, defaultKey) => {
    return `
    <div class="mb-3 border p-3 rounded ap-row js_ap-row">
      <div class="mb-2">
        <label class="form-label fw-bold">Route name</label>
        <div class="d-flex gap-2">
            <input type="text" class="form-control ap-key js_ap-key" placeholder="Route name" value="${defaultKey}">
            <button type="button" class="btn btn-outline-danger btn-remove-ap js_btn-remove-ap">Remove</button>
        </div>
      </div>
      <div class="flex-grow-1">${valueHtml}</div>
    </div>`;
  }
};

export const CUSTOM_RENDERERS: Record<string, CustomRenderer> = {
  "tls": tlsRenderer,
  "routes": routesRenderer,
  "output.mode": { render: () => "" }
};