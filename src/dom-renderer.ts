import { FormNode } from "./parser";
import { getUiText } from "./i18n";
import { h } from "./hyperscript";
import { TemplateRenderer } from "./types";

export const rendererConfig = {
  elements: {
    input: 'vsf-input',
    select: 'vsf-select',
    label: 'vsf-label',
    fieldset: 'vsf-fieldset',
    legend: 'legend',
    formItem: 'vsf-form-item',
    additionalProperties: 'vsf-additional-properties',
    array: 'vsf-array',
    arrayItem: 'vsf-array-item',
    oneOf: 'vsf-oneof',
    additionalPropertyItem: 'vsf-additional-property-item'
  },
  triggers: {
    oneOfSelector: 'js_oneof-selector',
    addArrayItem: 'js_btn-add-array-item',
    removeArrayItem: 'js_btn-remove-item',
    addAdditionalProperty: 'js_btn-add-ap',
    removeAdditionalProperty: 'js_btn-remove-ap',
    additionalPropertyKey: 'js_ap-key',
    additionalPropertyItems: 'js_ap-items',
    additionalPropertyRow: 'js_ap-row',
    additionalPropertiesWrapper: 'js_additional-properties',
    arrayItems: 'js_array-items',
    arrayItemRow: 'js_array-item-row',
    arrayItemContent: 'js_array-item-content',
    apKeyContainer: 'js_ap-key-container',
    apValueWrapper: 'js_ap-value-wrapper',
    validationError: 'js_validation-error'
  },
  classes: {
    input: 'form-control',
    inputSmall: 'form-control form-control-sm',
    select: 'form-select',
    label: 'form-label',
    labelSmall: 'form-label small',
    invalid: 'is-invalid',
    fieldWrapper: 'mb-3',
    fieldset: 'border p-3 rounded mb-3',
    legend: 'h6',
    description: 'form-text',
    checkboxWrapper: 'mb-3 form-check',
    checkboxInput: 'form-check-input',
    checkboxLabel: 'form-check-label',
    buttonPrimary: 'btn btn-sm btn-outline-primary mt-2',
    buttonSecondary: 'btn btn-sm btn-outline-secondary mt-2',
    buttonDanger: 'btn btn-sm btn-outline-danger',
    textDanger: 'text-danger',
    textMuted: 'text-muted fst-italic',
    alertDanger: 'alert alert-danger',
    alertWarning: 'alert alert-warning',
    oneOfSelector: 'form-select mb-2 oneof-selector',
    oneOfWrapper: 'mt-3 border-top pt-3',
    oneOfContainer: 'oneof-container ps-3 border-start',
    additionalProperties: 'additional-properties mt-3 border-top pt-2',
    additionalPropertiesItems: 'ap-items',
    additionalPropertyItem: 'ap-row gap-2 mb-2 align-items-end',
    arrayItems: 'array-items',
    arrayItemRow: 'array-item-row gap-2 mb-2 align-items-start',
    arrayItemContent: 'flex-grow-1',
    error: 'invalid-feedback d-block', // Bootstrap friendly default
    layoutGroup: 'layout-group mb-3',
    layoutGroupLabel: 'd-block fw-bold',
    layoutGroupContent: 'd-flex gap-3',
    headless: 'headless-object',
    apKeyContainer: 'ap-key-container',
    apValueWrapper: 'flex-grow-1 ap-value-wrapper',
    objectWrapper: 'ui_obj',
    arrayWrapper: 'ui_arr',
    nullWrapper: 'ui_null'
  }
};

export const domRenderer: TemplateRenderer<Node> = {
  renderFieldWrapper: (node: FormNode, elementId: string, input: Node, className?: string): Node => {
    const attrs: any = {
      className: className || rendererConfig.classes.fieldWrapper,
      'element-id': elementId,
      label: node.title
    };
    if (node.required) attrs.required = true;
    if (node.description) attrs.description = node.description;

    return h(rendererConfig.elements.formItem, attrs, input);
  },

  renderString: (node: FormNode, elementId: string): Node => {
    const attrs: { [key: string]: any } = {
      type: 'text',
      className: rendererConfig.classes.input,
      id: elementId,
      value: node.defaultValue || ''
    };

    if (node.required) attrs.required = true;
    if (node.pattern) attrs.pattern = node.pattern;
    if (node.minLength) attrs.minlength = node.minLength;
    if (node.maxLength) attrs.maxlength = node.maxLength;
    if (node.readOnly) attrs.disabled = true;

    if (node.format) {
      switch (node.format) {
        case 'email': attrs.type = 'email'; break;
        case 'uri': attrs.type = 'url'; break;
        case 'date': attrs.type = 'date'; break;
        case 'time': attrs.type = 'time'; break;
        case 'date-time': attrs.type = 'datetime-local'; break;
      }
    }

    const inputEl = h(rendererConfig.elements.input, attrs);
    return domRenderer.renderFieldWrapper(node, elementId, inputEl);
  },

  // The rest of the functions will be implemented later.
  // For now, they will throw an error.
  renderFieldsetWrapper: (node: FormNode, elementId: string, content: Node, className: string = ""): Node => {
    const children: Node[] = [
      h(rendererConfig.elements.legend, { className: rendererConfig.classes.legend }, node.title)
    ];
    if (node.description) {
      children.push(h('div', { className: rendererConfig.classes.description }, node.description));
    }
    children.push(content);

    return h(rendererConfig.elements.fieldset, { className: `${rendererConfig.classes.fieldset} ${className}`, id: elementId }, ...children);
  },
  renderNumber: (node: FormNode, elementId: string): Node => {
    const attrs: { [key: string]: any } = {
      type: 'number',
      className: rendererConfig.classes.input,
      id: elementId,
      value: node.defaultValue !== undefined ? node.defaultValue : ''
    };

    if (node.required) attrs.required = true;
    if (node.minimum !== undefined) attrs.min = node.minimum;
    if (node.maximum !== undefined) attrs.max = node.maximum;
    if (node.readOnly) attrs.disabled = true;

    const inputEl = h(rendererConfig.elements.input, attrs);
    return domRenderer.renderFieldWrapper(node, elementId, inputEl);
  },
  renderBoolean: (node: FormNode, elementId: string, _attributes: string = ""): Node => {
    const attrs: { [key: string]: any } = {
      type: 'checkbox',
      className: rendererConfig.classes.checkboxInput,
      id: elementId
    };

    if (node.defaultValue) attrs.checked = true;
    if (node.required) attrs.required = true;
    if (node.readOnly) attrs.disabled = true;

    // The old implementation had an `attributes` parameter which is not used in the new hyperscript implementation.
    // I am not sure what it was for, but I am keeping the signature for now.
    if (_attributes) {
      const match = _attributes.match(/data-toggle-target="([^"]+)"/);
      if (match) {
        attrs['data-toggle-target'] = match[1];
      }
    }
    
    const children = [
      h(rendererConfig.elements.input, attrs),
      h(rendererConfig.elements.label, { className: rendererConfig.classes.checkboxLabel, for: elementId }, node.title, node.required ? h('span', { className: rendererConfig.classes.textDanger }, '*') : ''),
    ];

    if (node.description) {
      children.push(h('div', { className: rendererConfig.classes.description }, node.description));
    }

    return h('div', { className: rendererConfig.classes.checkboxWrapper }, ...children);
  },
  renderSelect: (node: FormNode, elementId: string, options: string[] = []): Node => {
    const optionElements = options.map(o => {
      const attrs: { [key:string]: any } = { value: o };
      if (String(node.defaultValue) === o) {
        attrs.selected = true;
      }
      return h('option', attrs, o);
    });

    const attrs: { [key: string]: any } = {
      className: rendererConfig.classes.select,
      id: elementId
    };
    if (node.required) attrs.required = true;
    if (node.readOnly) attrs.disabled = true;

    const selectEl = h(rendererConfig.elements.select, attrs, ...optionElements);
    return domRenderer.renderFieldWrapper(node, elementId, selectEl);
  },
  renderObject: (node: FormNode, elementId: string, content: Node): Node => {
    return domRenderer.renderFieldsetWrapper(node, elementId, content, rendererConfig.classes.objectWrapper);
  },
  renderAdditionalProperties: (node: FormNode, elementId: string, options?: { title?: string | null, keyPattern?: string }): Node => {
    if (!node.additionalProperties) return document.createTextNode('');

    const attrs: any = {
      className: `${rendererConfig.classes.additionalProperties} ${rendererConfig.triggers.additionalPropertiesWrapper}`,
      'element-id': elementId,
      'add-text': getUiText("add_property", "Add Property")
    };

    if (options?.title !== null) {
      attrs.title = options?.title ?? getUiText("additional_properties", "Additional Properties");
    }
    if (options?.keyPattern) {
      attrs['key-pattern'] = options.keyPattern;
    }
    
    return h(rendererConfig.elements.additionalProperties, attrs);
  },
  renderOneOf: (node: FormNode, elementId: string): Node => {
    if (!node.oneOf || node.oneOf.length === 0) return document.createTextNode('');

    let selectedIndex = node.oneOf.findIndex(opt => opt.type === 'null');
    if (selectedIndex === -1) {
      selectedIndex = node.oneOf.findIndex(opt => {
        const title = opt.title.toLowerCase();
        return title === 'null' || title === 'none';
      });
    }
    if (selectedIndex === -1) selectedIndex = 0;

    const optionElements = node.oneOf.map((opt, idx) => {
      const attrs: { [key: string]: any } = { value: idx };
      if (idx === selectedIndex) {
        attrs.selected = true;
      }
      return h('option', attrs, opt.title);
    });

    const selectEl = h('select', {
      className: `${rendererConfig.classes.oneOfSelector} ${rendererConfig.triggers.oneOfSelector}`,
      id: `${elementId}__selector`,
      'data-id': elementId
    }, ...optionElements);

    const selectContainer = h(rendererConfig.elements.oneOf, { 'element-id': elementId }, selectEl);
    
    const wrapperNode = { ...node, title: getUiText("type_variant", "Type / Variant"), description: undefined, required: false };
    return domRenderer.renderFieldWrapper(wrapperNode, `${elementId}__selector`, selectContainer, rendererConfig.classes.oneOfWrapper);
  },
  renderArray: (node: FormNode, elementId: string): Node => {
    const content = h(rendererConfig.elements.array, {
      'element-id': elementId,
      'add-text': getUiText("add_item", "Add Item")
    });
    return domRenderer.renderFieldsetWrapper(node, elementId, content, rendererConfig.classes.arrayWrapper);
  },
  renderArrayItem: (item: Node): Node => {
    return h(rendererConfig.elements.arrayItem, {
      className: `${rendererConfig.classes.arrayItemRow} ${rendererConfig.triggers.arrayItemRow}`, // Class needed for events.ts to find the row
      'remove-text': getUiText("remove", "Remove")
    }, item);
  },
  renderAdditionalPropertyRow: (value: Node, defaultKey: string = "", uniqueId: string = ""): Node => {
    const attrs: any = {
      className: `${rendererConfig.classes.additionalPropertyItem} ${rendererConfig.triggers.additionalPropertyRow}`, // Needed for events.ts to find the row
      'key-value': defaultKey,
      'remove-text': 'X'
    };
    if (uniqueId) attrs['key-id'] = uniqueId;

    return h(rendererConfig.elements.additionalPropertyItem, attrs, value);
  },
  renderLayoutGroup: (title: string | undefined, content: Node, className: string = rendererConfig.classes.layoutGroupContent): Node => {
    const children = [];
    if (title) {
      children.push(h('label', { className: `${rendererConfig.classes.label} ${rendererConfig.classes.layoutGroupLabel}` }, title));
    }
    children.push(h('div', { className }, content));
    return h('div', { className: rendererConfig.classes.layoutGroup }, ...children);
  },
  renderFormWrapper: (content: Node): Node => {
    return h('form', { id: 'generated-form' }, content);
  },
  renderNull: (_node: FormNode): Node => {
    return h('div', { className: `${rendererConfig.classes.nullWrapper} ${rendererConfig.classes.textMuted}` }, 'null');
  },
  renderUnsupported: (node: FormNode): Node => {
    return h('div', { className: rendererConfig.classes.alertWarning }, `${getUiText("unsupported_type", "Unsupported type")}: ${node.type}`);
  },
  renderHeadlessObject: (elementId: string, content: Node): Node => {
    return h('div', { id: elementId, className: rendererConfig.classes.headless }, content);
  },
  renderSchemaError: (error: any): Node => {
    return h('div', { className: rendererConfig.classes.alertDanger },
      h('strong', {}, getUiText("error_schema_load", "Error: Could not load or parse the schema.")),
      h('br', {}),
      h('small', {}, String(error))
    );
  },
  renderFragment: (nodes: Node[]): Node => {
    const fragment = document.createDocumentFragment();
    for (const node of nodes) {
      fragment.appendChild(node);
    }
    return fragment;
  }
};
