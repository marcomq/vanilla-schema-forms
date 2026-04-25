import { FormNode } from "../core/parser";
import { h } from "../vanilla-renderer/hyperscript";
import { domRenderer, rendererConfig } from "../vanilla-renderer/dom-renderer";

export interface WebAwesomeThemeHandle {
  restore: () => void;
}

export function formatWebAwesomeLabel(node: FormNode, elementId: string): string {
  if (node.title) {
    return node.title;
  }

  const segments = String(elementId || "").split(".");
  const fieldKey = segments[segments.length - 1] || "";

  if (/^\d+$/.test(fieldKey)) {
    return `Item ${Number(fieldKey) + 1}`;
  }

  return (
    fieldKey
      .replace(/^__var_/, "")
      .replace(/_/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (char) => char.toUpperCase()) || "Value"
  );
}

export function applyWebAwesomeTheme(): WebAwesomeThemeHandle {
  const originalClasses = { ...rendererConfig.classes };
  const originalRenderFieldWrapper = domRenderer.renderFieldWrapper;
  const originalRenderObject = domRenderer.renderObject;
  const originalRenderArrayItem = domRenderer.renderArrayItem;
  const originalRenderAdditionalPropertyRow =
    domRenderer.renderAdditionalPropertyRow;

  Object.assign(rendererConfig.classes, {
    input: "wa-filled",
    inputSmall: "wa-filled wa-size-s",
    select: "wa-filled",
    label: "vsf-wa-label",
    labelSmall: "vsf-wa-label-small",
    fieldWrapper: "vsf-wa-field",
    fieldset: "vsf-wa-fieldset wa-stack",
    legend: "vsf-wa-legend",
    description: "vsf-wa-description",
    checkboxWrapper: "vsf-wa-checkbox-field",
    checkboxInput: "vsf-wa-checkbox",
    checkboxLabel: "vsf-wa-checkbox-label",
    buttonPrimary: "wa-filled wa-brand wa-size-s",
    buttonSecondary: "wa-outlined wa-neutral wa-size-s",
    buttonLink: "wa-plain wa-brand wa-size-s vsf-wa-link-button",
    buttonDanger: "wa-filled wa-danger wa-size-s",
    textDanger: "vsf-wa-required",
    textMuted: "vsf-wa-muted",
    alertDanger: "vsf-wa-alert vsf-wa-alert-danger",
    alertWarning: "vsf-wa-alert vsf-wa-alert-warning",
    oneOfSelector: "wa-filled vsf-wa-oneof-selector",
    oneOfWrapper: "vsf-wa-oneof-wrapper",
    oneOfContainer: "vsf-wa-oneof-container wa-stack",
    additionalProperties: "vsf-wa-additional-properties wa-stack",
    additionalPropertiesItems: "vsf-wa-additional-properties-items wa-stack",
    additionalPropertyItem: "vsf-wa-additional-property-row",
    arrayItems: "vsf-wa-array-items wa-stack",
    arrayItemRow: "vsf-wa-array-item-row",
    arrayItemContent: "vsf-wa-array-item-content",
    error: "vsf-wa-error",
    layoutGroup: "vsf-wa-layout-group",
    layoutGroupLabel: "vsf-wa-layout-group-label",
    layoutGroupContent: "vsf-wa-layout-group-content",
    apKeyContainer: "vsf-wa-ap-key-container",
    apValueWrapper: "vsf-wa-ap-value-wrapper",
    objectWrapper: "vsf-wa-object wa-stack",
    compactRow: "vsf-wa-compact-row",
    compactLabel: "vsf-wa-compact-label",
    compactContent: "vsf-wa-compact-content",
    compactDescriptionWrapper: "vsf-wa-compact-description",
    compactErrorPlaceholder: "vsf-wa-compact-error",
    disclosureContent: "vsf-wa-disclosure-content",
    sectionSpacing: "vsf-wa-section",
  });

  domRenderer.renderFieldWrapper = (
    node: FormNode,
    elementId: string,
    inputElement: Node,
    wrapperClass?: string,
  ): Node => {
    const input =
      (inputElement as Element)?.querySelector?.("input, select, textarea") ||
      (inputElement as Element | null);
    const isCheckbox =
      input instanceof HTMLInputElement && input.type === "checkbox";

    if (
      input instanceof HTMLInputElement ||
      input instanceof HTMLSelectElement ||
      input instanceof HTMLTextAreaElement
    ) {
      if (!isCheckbox) {
        input.classList.add("vsf-wa-control");
      }
    }

    if (node.type === "object" || node.type === "array") {
      return h(
        "div",
        { className: [wrapperClass, "vsf-wa-composite"].filter(Boolean).join(" ") },
        inputElement,
      );
    }

    if (isCheckbox) {
      return originalRenderFieldWrapper(node, elementId, inputElement, wrapperClass);
    }

    return renderWebAwesomeCompactFieldWrapper(
      node,
      elementId,
      inputElement,
      wrapperClass,
    );
  };

  domRenderer.renderObject = (
    node: FormNode,
    elementId: string,
    content: Node,
  ): Node => {
    const children: Array<Node | string> = [];
    if (node.title) {
      children.push(
        h("legend", { className: rendererConfig.classes.legend }, node.title),
      );
    }
    if (node.description) {
      children.push(
        h("div", { className: rendererConfig.classes.description }, node.description),
      );
    }
    children.push(content);
    children.push(h("div", { "data-validation-for": elementId }));

    return h(
      "fieldset",
      {
        className: `${rendererConfig.classes.fieldset} ${rendererConfig.classes.objectWrapper}`,
        id: elementId,
        "data-element-id": elementId,
      },
      ...children,
    );
  };

  domRenderer.renderArrayItem = (
    item: Node,
    options?: { isRemovable?: boolean },
  ): Node => {
    const isRemovable = options?.isRemovable !== false;
    const contentWrapper = h(
      "div",
      {
        className: `${rendererConfig.classes.arrayItemContent} ${rendererConfig.triggers.arrayItemContent}`,
      },
      item,
    );

    const children: Node[] = [contentWrapper];

    if (isRemovable) {
      children.push(
        h(
          "button",
          {
            className: `${rendererConfig.classes.buttonDanger} ${rendererConfig.triggers.removeArrayItem}`,
            type: "button",
          },
          "Remove",
        ),
      );
    }

    return h(
      "div",
      {
        className: `${rendererConfig.classes.arrayItemRow} ${rendererConfig.triggers.arrayItemRow}`,
      },
      ...children,
    );
  };

  domRenderer.renderAdditionalPropertyRow = (
    value: Node,
    defaultKey: string = "",
    uniqueId: string = "",
  ): Node => {
    const keyInput = h("input", {
      type: "text",
      className: `${rendererConfig.classes.inputSmall} ${rendererConfig.triggers.additionalPropertyKey}`,
      placeholder: "Key",
      value: defaultKey,
      "data-original-key": defaultKey,
      id: uniqueId,
    });

    const keyContainer = h(
      "div",
      {
        className: `${rendererConfig.classes.apKeyContainer} ${rendererConfig.triggers.apKeyContainer}`,
      },
      h(
        "div",
        {
          className: `${rendererConfig.classes.compactRow} vsf-wa-ap-key-row`,
          "data-element-id": uniqueId,
        },
        h(
          "label",
          { className: rendererConfig.classes.compactLabel, for: uniqueId },
          "Key",
        ),
        h(
          "div",
          { className: rendererConfig.classes.compactContent },
          keyInput,
        ),
        h("div", { className: rendererConfig.classes.compactErrorPlaceholder }),
      ),
    );

    const valueWrapper = h(
      "div",
      {
        className: `${rendererConfig.classes.apValueWrapper} ${rendererConfig.triggers.apValueWrapper}`,
      },
      value,
    );

    return h(
      "div",
      {
        className: `${rendererConfig.classes.additionalPropertyItem} ${rendererConfig.triggers.additionalPropertyRow}`,
      },
      keyContainer,
      valueWrapper,
      h(
        "button",
        {
          className: `${rendererConfig.classes.buttonDanger} ${rendererConfig.triggers.removeAdditionalProperty}`,
          type: "button",
        },
        "Remove",
      ),
    );
  };

  return {
    restore: () => {
      Object.assign(rendererConfig.classes, originalClasses);
      domRenderer.renderFieldWrapper = originalRenderFieldWrapper;
      domRenderer.renderObject = originalRenderObject;
      domRenderer.renderArrayItem = originalRenderArrayItem;
      domRenderer.renderAdditionalPropertyRow = originalRenderAdditionalPropertyRow;
    },
  };
}

function renderWebAwesomeCompactFieldWrapper(
  node: FormNode,
  elementId: string,
  inputElement: Node,
  className?: string,
): Node {
  const input =
    (inputElement as Element)?.querySelector?.("input, select, textarea") ||
    (inputElement as Element | null);
  const forId = (node as any)._inputId || (input as HTMLInputElement)?.id || elementId;
  const description = node.description
    ? h(
        "div",
        { className: rendererConfig.classes.compactDescriptionWrapper },
        node.description,
      )
    : "";

  return h(
    "div",
    {
      className: [className || rendererConfig.classes.compactRow, "vsf-wa-field"]
        .filter(Boolean)
        .join(" "),
      "data-element-id": elementId,
    },
    h(
      "label",
      { className: rendererConfig.classes.compactLabel, for: forId },
      formatWebAwesomeLabel(node, elementId),
      node.required
        ? h("span", { className: rendererConfig.classes.textDanger }, "*")
        : "",
    ),
    h(
      "div",
      { className: rendererConfig.classes.compactContent },
      inputElement,
      description,
    ),
    h(
      "div",
      { className: rendererConfig.classes.compactErrorPlaceholder },
      h("div", { "data-validation-for": elementId }),
    ),
  );
}
