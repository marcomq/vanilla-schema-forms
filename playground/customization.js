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
if (!domRenderer.renderFieldWrapper.isCompact) {
  const originalRenderFieldWrapper = domRenderer.renderFieldWrapper;
  domRenderer.renderFieldWrapper = (
    node,
    elementId,
    inputElement,
    wrapperClass,
  ) => {
    // Apply compact style only for simple types
    if (
      ["string", "number", "integer", "boolean"].includes(node.type) ||
      node.enum
    ) {
      const label = node.title
        ? h(
            "label",
            { className: "col-sm-3 col-form-label small", for: elementId },
            node.title,
            node.required ? h("span", { className: "text-danger" }, "*") : "",
          )
        : null;
      const desc = node.description
        ? h("span", { className: "form-text" }, node.description)
        : null;
      const errorPlaceholder = h("div", { "data-validation-for": elementId });

      return h(
        "div",
        { className: "row mb-2", "data-element-id": elementId },
        label,
        h(
          "div",
          { className: "col-sm-9" },
          inputElement,
          h("div", { className: "small text-muted" }, desc || ""),
        ),
        h("div", { className: "col-12" }, errorPlaceholder),
      );
    }
    return originalRenderFieldWrapper(
      node,
      elementId,
      inputElement,
      wrapperClass,
    );
  };
  domRenderer.renderFieldWrapper.isCompact = true;
}

/**
 * Custom renderer for TLS configuration.
 * It renders a checkbox for the 'required' property and toggles the visibility of other properties.
 */
export const tlsRenderer = {
  render: (node, path, elementId, dataPath, context) => {
    const requiredProp = node.properties?.["required"];

    // Fallback to standard object rendering if 'required' property is missing
    if (!requiredProp) {
      return renderObject(context, node, elementId, false, dataPath);
    }

    const otherProps = { ...node.properties };
    delete otherProps["required"];
    const name = getName([...dataPath, "required"]);

    const requiredId = `${elementId}.required`;
    const checkbox = domRenderer.renderBoolean(
      requiredProp,
      requiredId,
      name,
      `data-toggle-target="${elementId}-options"`
    );
    const optionsContent = renderProperties(
      context,
      otherProps,
      elementId,
      dataPath,
    );

    return h(
      "fieldset",
      { className: "border p-3 rounded mb-3 ui_tls", id: elementId },
      h("legend", { className: "h6" }, node.title),
      checkbox,
      h(
        "div",
        {
          id: `${elementId}-options`,
          style: "display: none;",
          className: "mt-3",
        },
        optionsContent,
      ),
    );
  },
};

/**
 * Custom renderer for Routes (Map/Dictionary).
 * It handles dynamic keys for additional properties and provides a custom UI for adding/removing routes.
 */
export const routesRenderer = {
  render: (node, path, elementId, dataPath, context) => {
    return renderObject(context, node, elementId, false, dataPath, {
      additionalProperties: { title: null },
    });
  },
  getDefaultKey: (index) => `Route ${index + 1}`,
  renderAdditionalPropertyRow: (valueHtml, defaultKey, uniqueId) => {
    const keyInputAttrs = {
      type: "text",
      className: "form-control form-control-sm fw-bold ap-key js-ap-key",
      placeholder: "Route name",
      value: defaultKey,
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
const advancedOptionsRenderer = {
  render: (node, path, elementId, dataPath, context) => {
    // Fallback for primitives (e.g. "static" endpoint which is a string, not an object)
    if (node.type !== "object") {
      if (node.type === "string")
        return domRenderer.renderString(node, elementId, dataPath);
      if (node.type === "boolean")
        return domRenderer.renderBoolean(node, elementId, dataPath);
      if (node.type === "number" || node.type === "integer") {
        const safeNode =
          node.defaultValue === null ? { ...node, defaultValue: "" } : node;
        return domRenderer.renderNumber(safeNode, elementId, dataPath);
      }
      return domRenderer.renderUnsupported(node);
    }

    const visibleProps = {};
    const advancedProps = {};
    const alwaysVisible = new Set([
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

    if (node.properties) {
      Object.keys(node.properties).forEach((key) => {
        const prop = node.properties[key];
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

    let advancedContent = null;
    let toggleBtn = null;

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
          onclick: (e) => {
            const el = document.getElementById(optionsId);
            if (el) {
              const isHidden = el.style.display === "none";
              el.style.display = isHidden ? "block" : "none";
              e.target.textContent = isHidden ? "Hide" : "Show more...";
            }
          },
        },
        "Show more...",
      );
    }

    return h(
      "fieldset",
      { className: "border p-3 rounded mb-3 ui_obj", id: elementId },
      h("legend", { className: "h6" }, node.title),
      node.description
        ? h("div", { className: "form-text mb-3" }, node.description)
        : null,
      visibleContent,
      toggleBtn,
      advancedContent,
    );
  },
};

/**
 * Custom renderer for Middlewares array.
 * Replaces the standard "Add Item" button with an "Add Middleware" button that opens a select.
 */
const middlewaresRenderer = {
  render: (node, path, elementId, dataPath, context) => {
    const itemsContainerId = `${elementId}-items`;
    const itemsContainer = h("div", {
      className: "array-items",
      id: itemsContainerId,
    });

    // Helper to render a single item
    const renderItem = (itemData, index) => {
      let selectedOption = node.items.oneOf[0];
      let selectedIndex = 0;

      if (itemData && typeof itemData === "object") {
        const dataKeys = Object.keys(itemData);
        node.items.oneOf.forEach((opt, idx) => {
          if (opt.properties) {
            const propKeys = Object.keys(opt.properties);
            if (propKeys.length === 1 && dataKeys.includes(propKeys[0])) {
              selectedOption = opt;
              selectedIndex = idx;
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
          title: selectedOption.title || `Middleware ${index + 1}`,
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
      node.defaultValue.forEach((itemData, index) => {
        itemsContainer.appendChild(renderItem(itemData, index));
      });
    }

    // Check if parent is "null" type (Endpoint type is null)
    // dataPath is an array including root. Store path excludes root.
    const parentStorePath = dataPath.length > 1 ? dataPath.slice(1, -1) : [];
    const parentData = context.store.getPath(parentStorePath);
    const isNullType =
      parentData && typeof parentData === "object" && "null" in parentData;

    if (isNullType) {
      return h(
        "fieldset",
        { className: "border p-3 rounded mb-3 ui_arr", id: elementId },
        h("legend", { className: "h6" }, node.title),
        node.description
          ? h("div", { className: "form-text mb-3" }, node.description)
          : null,
        itemsContainer,
      );
    }

    const addBtn = h(
      "button",
      {
        type: "button",
        className: "btn btn-sm btn-outline-primary mt-2",
        onclick: (e) => {
          e.target.style.display = "none";
          const select = e.target.nextElementSibling;
          select.style.display = "inline-block";
          select.focus();
          if (select.showPicker) select.showPicker();
        },
      },
      "Add Middleware",
    );

    const options = node.items.oneOf
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
        className: "form-select form-select-sm mt-2",
        style: "display: none; width: auto;",
        onchange: (e) => {
          const selectedIndex = parseInt(e.target.value, 10);
          if (isNaN(selectedIndex)) return;
          e.target.value = "";
          e.target.style.display = "none";
          addBtn.style.display = "inline-block";

          const currentPath = resolvePath(context, elementId);
          if (!currentPath) return;

          if (
            currentPath[currentPath.length - 1] !== "middlewares" &&
            (node.key === "middlewares" || elementId.endsWith(".middlewares"))
          ) {
            currentPath.push("middlewares");
          }

          const currentData = context.store.getPath(currentPath) || [];
          const newItemIndex = currentData.length;
          const selectedOption = node.items.oneOf[selectedIndex];
          const newData = generateDefaultData(selectedOption);
          context.store.setPath([...currentPath, newItemIndex], newData);

          const wrapper = renderItem(newData, newItemIndex);
          itemsContainer.appendChild(wrapper);
        },
        onblur: (e) => {
          e.target.value = "";
          e.target.style.display = "none";
          addBtn.style.display = "inline-block";
        },
      },
      ...options,
    );

    return h(
      "fieldset",
      { className: "border p-3 rounded mb-3 ui_arr", id: elementId },
      h("legend", { className: "h6" }, node.title),
      node.description
        ? h("div", { className: "form-text mb-3" }, node.description)
        : null,
      itemsContainer,
      addBtn,
      select,
    );
  },
};

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
