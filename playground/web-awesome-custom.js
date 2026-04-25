import {
  applyWebAwesomeTheme,
  createAdvancedOptionsRenderer,
  createOptionalRenderer,
  createTypeSelectArrayRenderer,
  domRenderer,
  formatWebAwesomeLabel,
  h,
  hydrateNodeWithData,
  renderNode,
  renderObject,
  renderProperties,
  rendererConfig,
  setConfig,
  setCustomRenderers,
  setI18n,
} from "../src/index";

function ensureWebAwesomeAssets() {
  if (!document.querySelector('link[data-web-awesome-playground="true"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/@awesome.me/webawesome@3.2.1/dist-cdn/styles/webawesome.css";
    link.setAttribute("data-web-awesome-playground", "true");
    document.head.appendChild(link);
  }

  if (!document.querySelector('script[data-web-awesome-playground="true"]')) {
    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://cdn.jsdelivr.net/npm/@awesome.me/webawesome@3.2.1/dist-cdn/webawesome.loader.js";
    script.setAttribute("data-web-awesome-playground", "true");
    document.head.appendChild(script);
  }

  document.documentElement.classList.add("wa-theme-default");
}

function ensureWebAwesomePlaygroundStyles() {
  if (document.getElementById("vsf-wa-playground-styles")) return;

  const style = document.createElement("style");
  style.id = "vsf-wa-playground-styles";
  style.textContent = `
    #form-container .vsf-wa-route-row,
    #form-container .vsf-wa-field,
    #form-container .vsf-wa-array-item-row,
    #form-container .vsf-wa-additional-property-row,
    #form-container .vsf-wa-fieldset,
    #form-container .vsf-wa-object {
      border-radius: var(--wa-border-radius-m);
    }

    #form-container .vsf-wa-route-row {
      display: grid;
      gap: 0.9rem;
      padding: 1rem;
      border: 1px solid var(--wa-color-neutral-border-normal);
      background: color-mix(in srgb, white 88%, var(--wa-color-neutral-fill-normal));
    }

    #form-container .vsf-wa-route-row-header,
    #form-container .vsf-wa-route-row-title,
    #form-container .vsf-wa-route-row-body {
      display: grid;
      gap: 0.75rem;
    }

    #form-container .vsf-wa-control-wrap,
    #form-container .vsf-wa-array-items,
    #form-container .vsf-wa-additional-properties-items,
    #form-container .vsf-wa-oneof-container,
    #form-container .vsf-wa-layout-group-content {
      display: grid;
      gap: 0.75rem;
    }

    #form-container .vsf-wa-compact-row {
      display: grid;
      grid-template-columns: minmax(120px, 180px) minmax(0, 1fr);
      gap: 0.35rem 1rem;
      align-items: start;
    }

    #form-container .vsf-wa-compact-label {
      padding-top: 0.55rem;
      font-size: var(--wa-font-size-s);
      font-weight: var(--wa-font-weight-action);
      letter-spacing: 0.01em;
    }

    #form-container .vsf-wa-compact-content {
      display: grid;
      gap: 0.35rem;
      min-width: 0;
    }

    #form-container .vsf-wa-compact-error {
      grid-column: 2;
    }

    #form-container .vsf-wa-technical {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    @media (max-width: 900px) {
      #form-container .vsf-wa-compact-row {
        grid-template-columns: 1fr;
      }

      #form-container .vsf-wa-compact-label,
      #form-container .vsf-wa-compact-error {
        grid-column: auto;
      }

      #form-container .vsf-wa-compact-label {
        padding-top: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

ensureWebAwesomeAssets();
ensureWebAwesomePlaygroundStyles();
applyWebAwesomeTheme();

setI18n({
  keys: {
    Map_of_Route: "Routes",
    type_variant: "Endpoint type",
  },
});

setConfig({
  visibility: {
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
      "path",
      "mode",
      "region",
      "brokers",
      "queue_url",
      "endpoint_url",
      "username",
      "password",
      "token",
      "basic_auth",
      "tls",
      "headers",
      "topic",
      "group",
      "key",
      "value",
      "required",
    ],
  },
});

const TECHNICAL_FIELD_MATCHERS = [
  "url",
  "brokers",
  "topic",
  "group",
  "key",
  "path",
];

function matchesTechnicalField(elementId, matchers = TECHNICAL_FIELD_MATCHERS) {
  const lowerElementId = String(elementId || "").toLowerCase();
  return matchers.some((matcher) => lowerElementId.includes(String(matcher).toLowerCase()));
}

function formatCustomLabel(node, elementId) {
  if (node.title) {
    return node.title;
  }

  const segments = String(elementId || "").split(".");
  const fieldKey = segments[segments.length - 1] || "";
  const parentKey = segments[segments.length - 2] || "";
  const indexedFieldLabels = {
    basic_auth: ["Username", "Password"],
  };

  if (/^\d+$/.test(fieldKey)) {
    const explicitLabel = indexedFieldLabels[parentKey]?.[Number(fieldKey)];
    if (explicitLabel) {
      return explicitLabel;
    }
  }

  return formatWebAwesomeLabel(node, elementId);
}

const originalRenderFieldWrapper = domRenderer.renderFieldWrapper;
domRenderer.renderFieldWrapper = (node, elementId, inputElement, wrapperClass) => {
  const input =
    inputElement.querySelector?.("input, select, textarea") || inputElement;
  const isCheckbox = input?.tagName === "INPUT" && input.type === "checkbox";

  if (input?.classList && !isCheckbox && matchesTechnicalField(elementId)) {
    input.classList.add("vsf-wa-technical");
  }

  if (node.oneOf) {
    const select = inputElement.querySelector?.("select");
    const content = inputElement.querySelector?.(
      `.${rendererConfig.classes.oneOfContainer.split(" ")[0]}`,
    );

    if (select && content) {
      return h(
        "div",
        {
          className: ["vsf-wa-field", "vsf-wa-field--oneof", wrapperClass]
            .filter(Boolean)
            .join(" "),
          "data-element-id": elementId,
        },
        h(
          "label",
          { className: "vsf-wa-label", for: select.id || elementId },
          formatCustomLabel(node, elementId),
        ),
        h("div", { className: "vsf-wa-control-wrap" }, select),
        content,
        node.description
          ? h("div", { className: "vsf-wa-description" }, node.description)
          : "",
        h("div", { "data-validation-for": elementId }),
      );
    }
  }

  return originalRenderFieldWrapper(node, elementId, inputElement, wrapperClass);
};

function getArrayItemNameField(container) {
  return container?.querySelector?.(
    'input[id$=".name"], input[name$="[name]"], input[name="name"]',
  ) || null;
}

function updateArrayItemLabel(arrayItem) {
  if (!arrayItem) return;

  const legend = arrayItem.querySelector("legend");
  const nameField = getArrayItemNameField(arrayItem);
  if (!legend || !nameField) return;

  const fallbackLabel =
    arrayItem.getAttribute("data-default-label") || legend.textContent || "Item";
  const nextLabel = String(nameField.value || "").trim() || fallbackLabel;
  legend.textContent = nextLabel;
}

if (!window.__vsfWebAwesomePlaygroundSyncInstalled) {
  window.__vsfWebAwesomePlaygroundSyncInstalled = true;

  document.addEventListener("input", (event) => {
    const target = event.target.closest?.(
      'input[id$=".name"], input[name$="[name]"], input[name="name"]',
    );
    if (!target) return;
    updateArrayItemLabel(target.closest(`.${rendererConfig.triggers.arrayItemRow}`));
  });

  document.addEventListener("change", (event) => {
    const target = event.target.closest?.(
      'input[id$=".name"], input[name$="[name]"], input[name="name"]',
    );
    if (!target) return;
    updateArrayItemLabel(target.closest(`.${rendererConfig.triggers.arrayItemRow}`));
  });
}

const tlsBaseRenderer = createOptionalRenderer("required");
const tlsRenderer = {
  render: (node, path, elementId, dataPath, context) => {
    const element = tlsBaseRenderer.render(node, path, elementId, dataPath, context);
    if (element && element.classList) {
      element.classList.add("ui_tls");
    }
    return element;
  },
};

const routeObjectRenderer = createAdvancedOptionsRenderer(["input", "output"]);

const routesRenderer = {
  render: (node, path, elementId, dataPath, context) => {
    const nodeForButton = { ...node, defaultValue: {} };
    const wrapper = domRenderer.renderAdditionalProperties(nodeForButton, elementId, { title: null });
    const itemsContainer = wrapper.querySelector(`.${rendererConfig.triggers.additionalPropertyItems}`);

    if (itemsContainer && node.additionalProperties && node.defaultValue && typeof node.defaultValue === "object") {
      const definedProps = new Set(node.properties ? Object.keys(node.properties) : []);
      let apIndex = 0;

      Object.keys(node.defaultValue).forEach((key) => {
        if (definedProps.has(key)) return;

        const valueSchema = node.additionalProperties;
        const valueNode = hydrateNodeWithData(valueSchema, node.defaultValue[key]);
        const routePath = `${elementId}.__ap_${apIndex}`;
        const routeDataPath = [...dataPath, key];
        const valueHtml = renderNode(context, valueNode, routePath, true, routeDataPath);
        const keyInputId = `${routePath}_key`;
        const rowNode = routesRenderer.renderAdditionalPropertyRow(
          valueHtml,
          key,
          keyInputId,
          routeDataPath,
          context,
        );

        itemsContainer.appendChild(rowNode);
        apIndex++;
      });
    }

    return domRenderer.renderObject(node, elementId, wrapper);
  },
  getDefaultKey: (index) => `Route ${index + 1}`,
  renderAdditionalPropertyRow: (valueHtml, defaultKey, uniqueId) => {
    const keyInputAttrs = {
      type: "text",
      className: "wa-filled wa-size-s js-ap-key vsf-wa-route-key",
      placeholder: "Route name",
      value: defaultKey,
      "data-original-key": defaultKey,
    };
    if (uniqueId) keyInputAttrs.id = uniqueId;

    const labelAttrs = { className: "vsf-wa-label-small", for: uniqueId };

    return h(
      "div",
      { className: `vsf-wa-route-row ${rendererConfig.triggers.additionalPropertyRow}` },
      h(
        "div",
        { className: "vsf-wa-route-row-header" },
        h(
          "div",
          { className: "vsf-wa-route-row-title" },
          h("label", labelAttrs, "Route Name"),
          h("input", keyInputAttrs),
        ),
        h(
          "button",
          {
            type: "button",
            className: `${rendererConfig.classes.buttonDanger} ${rendererConfig.triggers.removeAdditionalProperty}`,
          },
          "Remove Route",
        ),
      ),
      h("div", { className: "vsf-wa-route-row-body" }, valueHtml),
    );
  },
};

const advancedOptionsRenderer = createAdvancedOptionsRenderer([
  "url",
  "path",
  "mode",
  "brokers",
  "queue",
  "queue_url",
  "group_id",
  "topic",
  "stream",
  "subject",
  "topic_arn",
  "collection",
  "endpoint_url",
  "default",
  "headers",
  "basic_auth",
  "tls",
]);

const middlewaresRenderer = createTypeSelectArrayRenderer({
  buttonLabel: "Add Middleware",
  itemLabel: "Middleware",
});

const CUSTOM_RENDERERS = {
  Route: routeObjectRenderer,
  tls: tlsRenderer,
  routes: routesRenderer,
  middlewares: middlewaresRenderer,
  "output.mode": { render: () => document.createDocumentFragment() },
  value: {
    render: (node, path, elementId, dataPath, context) => {
      if (elementId.startsWith("Routes.")) {
        const props = node.properties
          ? renderProperties(context, node.properties, elementId, dataPath)
          : domRenderer.renderFragment([]);
        const ap = domRenderer.renderAdditionalProperties(node, elementId);
        const oneOf = domRenderer.renderOneOf(node, elementId);
        const content = domRenderer.renderFragment([props, ap, oneOf]);
        return domRenderer.renderHeadlessObject(elementId, content);
      }
      return renderObject(context, node, elementId, false, dataPath);
    },
  },
};

[
  "aws",
  "kafka",
  "nats",
  "file",
  "static",
  "ref",
  "memory",
  "sled",
  "amqp",
  "mongodb",
  "mqtt",
  "http",
  "ibmmq",
  "zeromq",
  "grpc",
  "fanout",
  "switch",
  "response",
  "reader",
  "custom",
].forEach((type) => {
  CUSTOM_RENDERERS[type] = advancedOptionsRenderer;
});

setCustomRenderers(CUSTOM_RENDERERS);
