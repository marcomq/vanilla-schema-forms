import {
  h,
  renderObject,
  renderProperties,
  domRenderer,
  setI18n,
  setConfig,
  setCustomRenderers,
  generateDefaultData,
  renderNode,
  resolvePath,
  getName,
  createTypeSelectArrayRenderer,
  createAdvancedOptionsRenderer,
  createOptionalRenderer,
  renderCompactFieldWrapper,
} from "../src/index";

// Apply global I18N overrides
setI18n({
  keys: {
    Map_of_Route: "Routes", // Rename "Map of Route" to "Routes" in the UI
  },
});

// Configure global visibility rules
setConfig({
  visibility: {
    // Custom visibility logic based on node description and path
    customVisibility: (node, path) => {
      const description = node.description || "";
      const lowerPath = path.toLowerCase();

      if (
        lowerPath.includes(".input") &&
        description.includes("Publisher only")
      ) {
        return false;
      }
      if (
        lowerPath.includes(".output") &&
        description.includes("Consumer only")
      ) {
        return false;
      }
      return true;
    },
  },
  sorting: {
    defaultRenderLast: ["middlewares"],
    defaultPriority: [
      "input",
      "output",
      "name",
      "id",
      "title",
      "type",
      "enabled",
      "active",
      "url",
      "brokers",
      "username",
      "password",
      "topic",
      "group",
      "key",
      "value",
      "required",
    ],
  },
});

// Override renderFieldWrapper for compact layout
const originalRenderFieldWrapper = domRenderer.renderFieldWrapper;
domRenderer.renderFieldWrapper = (node, elementId, inputElement, wrapperClass) => {
  if (["string", "number", "integer", "boolean"].includes(node.type) || node.enum) {
    return renderCompactFieldWrapper(node, elementId, inputElement);
  }
  return originalRenderFieldWrapper(node, elementId, inputElement, wrapperClass);
};

/**
 * Custom renderer for TLS configuration.
 * It renders a checkbox for the 'required' property and toggles the visibility of other properties.
 */
const tlsBaseRenderer = createOptionalRenderer("required");
export const tlsRenderer = {
  render: (node, path, elementId, dataPath, context) => {
    const element = tlsBaseRenderer.render(node, path, elementId, dataPath, context);
    if (element && element.classList) element.classList.add("ui_tls");
    return element;
  },
};

/**
 * Custom renderer for Routes (Map/Dictionary).
 * It handles dynamic keys for additional properties and provides a custom UI for adding/removing routes.
 */
let routesCurrentDataPath = null;
export const routesRenderer = {
  render: (node, path, elementId, dataPath, context) => {
    routesCurrentDataPath = dataPath;
    const result = renderObject(context, node, elementId, false, dataPath, {
      additionalProperties: { title: null },
    });
    routesCurrentDataPath = null;
    return result;
  },
  getDefaultKey: (index) => `Route ${index + 1}`,
  renderAdditionalPropertyRow: (valueHtml, defaultKey, uniqueId) => {
    // Construct a name based on the path to the property this key represents.
    const effectivePath = routesCurrentDataPath;
    const keyInputName = effectivePath ? getName(effectivePath.concat(defaultKey)) : (uniqueId || "");

    const keyInputAttrs = {
      type: "text",
      className: "form-control form-control-sm fw-bold ap-key js-ap-key",
      placeholder: "Route name",
      value: defaultKey,
      name: keyInputName,
    };
    if (uniqueId) keyInputAttrs.id = uniqueId;

    const labelAttrs = { className: "form-label fw-bold mb-0 text-nowrap" };
    if (uniqueId) labelAttrs.for = uniqueId;

    return h(
      "div",
      { className: "mb-4 border rounded shadow-sm ap-row js-ap-row" },
      h(
        "div",
        {
          className:
            "d-flex align-items-center justify-content-between p-3 bg-light border-bottom rounded-top",
        },
        h(
          "div",
          {
            className: "d-flex align-items-center gap-2 flex-grow-1",
            style: "max-width: 70%;",
          },
          h("label", labelAttrs, "Route Name:"),
          h("input", keyInputAttrs),
        ),
        h(
          "button",
          {
            type: "button",
            className:
              "btn btn-sm btn-outline-danger btn-remove-ap js-btn-remove-ap",
          },
          "Remove Route",
        ),
      ),
      h("div", { className: "p-3 flex-grow-1" }, valueHtml),
    );
  },
};

// Advanced Options Renderer (Collapse)
const advancedOptionsRenderer = createAdvancedOptionsRenderer([
  "queue",
  "group_id",
  "topic",
  "stream",
  "subject",
  "topic_arn",
  "collection",
  "queue_url",
  "endpoint_url",
]);

/**
 * Custom renderer for Middlewares array.
 * Replaces the standard "Add Item" button with an "Add Middleware" button that opens a select.
 */
const middlewaresRenderer = createTypeSelectArrayRenderer({
  buttonLabel: "Add Middleware",
  itemLabel: "Middleware",
});

/**
 * Registry of custom renderers.
 */
export const CUSTOM_RENDERERS = {
  tls: tlsRenderer,
  routes: routesRenderer,
  middlewares: middlewaresRenderer,
  "output.mode": { render: () => document.createDocumentFragment() },
  value: {
    render: (node, path, elementId, dataPath, context) => {
      // Only render "Value" headless if it is part of the Routes list
      if (elementId.startsWith("Routes.")) {
        const props = node.properties
          ? renderProperties(context, node.properties, elementId, dataPath)
          : domRenderer.renderFragment([]);
        const ap = domRenderer.renderAdditionalProperties(node, elementId);
        const oneOf = domRenderer.renderOneOf(node, elementId);
        const content = domRenderer.renderFragment([props, ap, oneOf]);
        return domRenderer.renderHeadlessObject(elementId, content);
      }
      // Fallback for other "Value" nodes
      return renderObject(context, node, elementId, false, dataPath);
    },
  },
};

// Add endpoint renderers
const endpointTypes = [
  "aws",
  "kafka",
  "nats",
  "file",
  "static",
  "memory",
  "amqp",
  "mongodb",
  "mqtt",
  "http",
  "ibmmq",
  "zeromq",
  "switch",
  "response",
  "custom",
];
endpointTypes.forEach((type) => {
  CUSTOM_RENDERERS[type] = advancedOptionsRenderer;
});

// 4. Apply the renderers
setCustomRenderers(CUSTOM_RENDERERS);
