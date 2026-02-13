import { FormNode } from "./parser";
import { getUiText } from "./i18n";
import { h } from "./hyperscript";
import { TemplateRenderer } from "./types";

export const rendererConfig = {
  elements: {
    input: 'input',
    select: 'select',
    label: 'label',
    fieldset: 'fieldset',
    legend: 'legend',
    formItem: 'div',
    additionalProperties: 'div',
    array: 'div',
    arrayItem: 'div',
    oneOf: 'div',
    additionalPropertyItem: 'div'
  },
  triggers: {
    oneOfSelector: 'js-oneof-selector',
    addArrayItem: 'js-btn-add-array-item',
    removeArrayItem: 'js-btn-remove-item',
    addAdditionalProperty: 'js-btn-add-ap',
    removeAdditionalProperty: 'js-btn-remove-ap',
    additionalPropertyKey: 'js-ap-key',
    additionalPropertyItems: 'js-ap-items',
    additionalPropertyRow: 'js-ap-row',
    additionalPropertiesWrapper: 'js-additional-properties',
    arrayItems: 'js-array-items',
    arrayItemRow: 'js-array-item-row',
    arrayItemContent: 'js-array-item-content',
    apKeyContainer: 'js-ap-key-container',
    apValueWrapper: 'js-ap-value-wrapper',
    validationError: 'js-validation-error'
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
    const children: Node[] = [];
    const forId = (node as any)._inputId || elementId;

    if (node.title) {
      children.push(h(rendererConfig.elements.label, { className: rendererConfig.classes.label, for: forId }, node.title, node.required ? h('span', { className: rendererConfig.classes.textDanger }, '*') : ''));
    }

    children.push(input);

    if (node.description) {
      children.push(h('div', { className: rendererConfig.classes.description }, node.description));
    }

    // Add a placeholder for validation errors.
    children.push(h('div', { 'data-validation-for': elementId }));

    return h(rendererConfig.elements.formItem, {
      className: className || rendererConfig.classes.fieldWrapper,
      'data-element-id': elementId
    }, ...children);
  },
  renderString: (node: FormNode, elementId: string, name: string): Node => {
    const attrs: { [key: string]: any } = {
      type: 'text',
      className: rendererConfig.classes.input,
      id: elementId,
      name: name,
    };

    if (node.defaultValue !== undefined) attrs.value = node.defaultValue;

    if (node.required) attrs.required = true;
    if (node.pattern) attrs.pattern = node.pattern;
    if (node.minLength !== undefined) attrs.minlength = node.minLength;
    if (node.maxLength !== undefined) attrs.maxlength = node.maxLength;
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

  renderFieldsetWrapper: (node: FormNode, elementId: string, content: Node, className: string = ""): Node => {
    const children: Node[] = [
      h(rendererConfig.elements.legend, { className: rendererConfig.classes.legend }, node.title)
    ];
    if (node.description) {
      children.push(h('div', { className: rendererConfig.classes.description }, node.description));
    }
    children.push(content);

    // Add placeholder for fieldset-level errors
    children.push(h('div', { 'data-validation-for': elementId }));

    return h(rendererConfig.elements.fieldset, { className: `${rendererConfig.classes.fieldset} ${className}`, id: elementId }, ...children);
  },
  renderNumber: (node: FormNode, elementId: string, name: string): Node => {
    const attrs: { [key: string]: any } = {
      type: 'number',
      className: rendererConfig.classes.input,
      id: elementId,
      name: name,
    };

    if (node.defaultValue !== undefined) {
      attrs.value = node.defaultValue;
    }

    if (node.required) attrs.required = true;
    if (node.minimum !== undefined) attrs.min = node.minimum;
    if (node.maximum !== undefined) attrs.max = node.maximum;
    if (node.readOnly) attrs.disabled = true;

    const inputEl = h(rendererConfig.elements.input, attrs);
    return domRenderer.renderFieldWrapper(node, elementId, inputEl);
  },
  renderBoolean: (node: FormNode, elementId: string, name: string, _attributes: string = ""): Node => {
    const attrs: { [key: string]: any } = {
      type: 'checkbox',
      className: rendererConfig.classes.checkboxInput,
      id: elementId,
      name: name,
    };

    if (node.defaultValue) attrs.checked = true;
    if (node.required) attrs.required = true;
    if (node.readOnly) attrs.disabled = true;

    // The `_attributes` string is a legacy way to pass `data-toggle-target` for custom renderers.
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

    // Add a placeholder for validation errors.
    children.push(h('div', { 'data-validation-for': elementId }));

    return h('div', { className: rendererConfig.classes.checkboxWrapper }, ...children);
  },
  renderSelect: (node: FormNode, elementId: string, options: string[] = [], name: string): Node => {
    const optionElements = options.map(o => {
      const attrs: { [key:string]: any } = { value: o };
      if (String(node.defaultValue) === o) {
        attrs.selected = true;
      }
      return h('option', attrs, o);
    });

    const attrs: { [key: string]: any } = {
      className: rendererConfig.classes.select,
      id: elementId,
      name: name,
    };
    if (node.required) attrs.required = true;
    if (node.readOnly) attrs.disabled = true;

    const selectEl = h(rendererConfig.elements.select, attrs, ...optionElements);
    return domRenderer.renderFieldWrapper(node, elementId, selectEl);
  },
  renderObject: (node: FormNode, elementId: string, content: Node): Node => {
    if (node.oneOf && node.oneOf.length > 0) {
      return domRenderer.renderFieldsetWrapper(node, elementId, content, rendererConfig.classes.objectWrapper);
    }

    const children: Node[] = [];
    if (node.title) {
      children.push(h('h6', { className: 'fw-bold' }, node.title));
    }
    if (node.description) {
      children.push(h('div', { className: rendererConfig.classes.description }, node.description));
    }
    children.push(content);
    // Add placeholder for object-level errors
    children.push(h('div', { 'data-validation-for': elementId }));

    return h('div', { className: `${rendererConfig.classes.objectWrapper}`, id: elementId, 'data-element-id': elementId }, ...children);
  },
  renderAdditionalProperties: (node: FormNode, elementId: string, options?: { title?: string | null, keyPattern?: string }): Node => {
    if (!node.additionalProperties) return document.createTextNode('');

    const children: Node[] = [];

    const titleText = options?.title ?? getUiText("additional_properties", "Additional Properties");
    if (options?.title !== null && titleText) {
      children.push(h('h6', {}, titleText));
    }

    children.push(h('div', { className: `${rendererConfig.classes.additionalPropertiesItems} ${rendererConfig.triggers.additionalPropertyItems}` }));

    const btnAttrs: any = {
      className: `${rendererConfig.classes.buttonSecondary} ${rendererConfig.triggers.addAdditionalProperty}`,
      type: 'button',
      'data-id': elementId
    };
    if (options?.keyPattern) {
      btnAttrs['data-key-pattern'] = options.keyPattern;
    }
    children.push(h('button', btnAttrs, getUiText("add_property", "Add Property")));

    return h(rendererConfig.elements.additionalProperties, {
      className: `${rendererConfig.classes.additionalProperties} ${rendererConfig.triggers.additionalPropertiesWrapper}`,
      'data-element-id': elementId
    }, ...children);
  },
  renderOneOf: (node: FormNode, elementId: string, name: string): Node => {
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
      'data-id': elementId,
      name: name
    }, ...optionElements);

    const contentContainer = h('div', {
      className: rendererConfig.classes.oneOfContainer,
      id: `${elementId}__oneof_content`
    });

    const selectContainer = h(rendererConfig.elements.oneOf, { 'data-element-id': elementId }, selectEl, contentContainer);
    
    const wrapperNode = { ...node, title: getUiText("type_variant", "Type / Variant"), description: undefined, required: false, _inputId: `${elementId}__selector` };
    return domRenderer.renderFieldWrapper(wrapperNode, elementId, selectContainer, rendererConfig.classes.oneOfWrapper);
  },
  renderArray: (node: FormNode, elementId: string, options?: { isFixedSize?: boolean }): Node => {
    const itemsContainer = h('div', {
      className: `${rendererConfig.classes.arrayItems} ${rendererConfig.triggers.arrayItems}`,
      id: `${elementId}-items`
    });

    const children = [itemsContainer];

    if (!options?.isFixedSize) {
      const addButton = h('button', {
        className: `${rendererConfig.classes.buttonPrimary} ${rendererConfig.triggers.addArrayItem}`,
        type: 'button',
        'data-id': elementId,
        'data-target': `${elementId}-items`
      }, getUiText("add_item", "Add Item"));
      children.push(addButton);
    }

    const content = h(rendererConfig.elements.array, { 'data-element-id': elementId }, ...children);
    return domRenderer.renderFieldsetWrapper(node, elementId, content, rendererConfig.classes.arrayWrapper);
  },
  renderArrayItem: (item: Node, options?: { isRemovable?: boolean }): Node => {
    const isRemovable = options?.isRemovable !== false;
    const contentWrapper = h('div', {
      className: `${rendererConfig.classes.arrayItemContent} ${rendererConfig.triggers.arrayItemContent}`
    }, item);

    const children = [contentWrapper];

    if (isRemovable) {
      const removeButton = h('button', {
        className: `${rendererConfig.classes.buttonDanger} ${rendererConfig.triggers.removeArrayItem}`,
        type: 'button',
      }, getUiText("remove", "Remove"));
      children.push(removeButton);
    }

    return h(rendererConfig.elements.arrayItem, {
      className: `${rendererConfig.classes.arrayItemRow} ${rendererConfig.triggers.arrayItemRow}`
    }, ...children);
  },
  renderAdditionalPropertyRow: (value: Node, defaultKey: string = "", uniqueId: string = ""): Node => {
    const keyLabel = h('label', { className: rendererConfig.classes.labelSmall, for: uniqueId }, 'Key');
    const keyInput = h('input', {
      type: 'text',
      className: `${rendererConfig.classes.inputSmall} ${rendererConfig.triggers.additionalPropertyKey}`,
      placeholder: 'Key',
      value: defaultKey,
      'data-original-key': defaultKey,
      id: uniqueId
    });
    const keyContainer = h('div', { className: `${rendererConfig.classes.apKeyContainer} ${rendererConfig.triggers.apKeyContainer}` }, keyLabel, keyInput);

    const valueWrapper = h('div', { className: `${rendererConfig.classes.apValueWrapper} ${rendererConfig.triggers.apValueWrapper}` }, value);

    const removeButton = h('button', {
      className: `${rendererConfig.classes.buttonDanger} ${rendererConfig.triggers.removeAdditionalProperty}`,
      type: 'button'
    }, getUiText("remove_property", "X"));

    return h(rendererConfig.elements.additionalPropertyItem, {
      className: `${rendererConfig.classes.additionalPropertyItem} ${rendererConfig.triggers.additionalPropertyRow}`
    }, keyContainer, valueWrapper, removeButton);
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
    const globalErrors = h('div', {
      id: 'form-global-errors',
      'aria-live': 'polite'
    });
    return h('form', { id: 'generated-form' }, globalErrors, content);
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
