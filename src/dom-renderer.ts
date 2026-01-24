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
    oneOf: 'vsf-oneof'
  },
  classes: {
    input: 'form-control',
    select: 'form-select',
    label: 'form-label',
    invalid: 'is-invalid'
  }
};

export const domRenderer: TemplateRenderer<Node> = {
  renderFieldWrapper: (node: FormNode, elementId: string, input: Node, className: string = "mb-3"): Node => {
    const attrs: any = {
      className,
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
      h(rendererConfig.elements.legend, { className: 'h6' }, node.title)
    ];
    if (node.description) {
      children.push(h('div', { className: 'form-text mb-3' }, node.description));
    }
    children.push(content);

    return h(rendererConfig.elements.fieldset, { className: `border p-3 rounded mb-3 ${className}`, id: elementId }, ...children);
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

    const inputEl = h(rendererConfig.elements.input, attrs);
    return domRenderer.renderFieldWrapper(node, elementId, inputEl);
  },
  renderBoolean: (node: FormNode, elementId: string, _attributes: string = ""): Node => {
    const attrs: { [key: string]: any } = {
      type: 'checkbox',
      className: 'form-check-input',
      id: elementId
    };

    if (node.defaultValue) attrs.checked = true;
    if (node.required) attrs.required = true;

    // The old implementation had an `attributes` parameter which is not used in the new hyperscript implementation.
    // I am not sure what it was for, but I am keeping the signature for now.
    
    const children = [
      h(rendererConfig.elements.input, attrs),
      h(rendererConfig.elements.label, { className: 'form-check-label', for: elementId }, node.title, node.required ? h('span', { className: 'text-danger' }, '*') : ''),
    ];

    if (node.description) {
      children.push(h('div', { className: 'form-text' }, node.description));
    }

    return h('div', { className: 'mb-3 form-check' }, ...children);
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

    const selectEl = h(rendererConfig.elements.select, attrs, ...optionElements);
    return domRenderer.renderFieldWrapper(node, elementId, selectEl);
  },
  renderObject: (node: FormNode, elementId: string, content: Node): Node => {
    return domRenderer.renderFieldsetWrapper(node, elementId, content, "ui_obj");
  },
  renderAdditionalProperties: (node: FormNode, elementId: string, options?: { title?: string | null, keyPattern?: string }): Node => {
    if (!node.additionalProperties) return document.createTextNode('');

    const attrs: any = {
      className: 'additional-properties js_additional-properties mt-3 border-top pt-2',
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
      className: 'form-select mb-2 oneof-selector js_oneof-selector',
      id: `${elementId}__selector`,
      'data-id': elementId
    }, ...optionElements);

    const selectContainer = h(rendererConfig.elements.oneOf, { 'element-id': elementId }, selectEl);
    
    const wrapperNode = { ...node, title: getUiText("type_variant", "Type / Variant"), description: undefined, required: false };
    return domRenderer.renderFieldWrapper(wrapperNode, `${elementId}__selector`, selectContainer, "mt-3 border-top pt-3");
  },
  renderArray: (node: FormNode, elementId: string): Node => {
    const content = h(rendererConfig.elements.array, {
      'element-id': elementId,
      'add-text': getUiText("add_item", "Add Item")
    });
    return domRenderer.renderFieldsetWrapper(node, elementId, content, "ui_arr");
  },
  renderArrayItem: (item: Node): Node => {
    return h(rendererConfig.elements.arrayItem, {
      className: 'array-item-row js_array-item-row', // Class needed for events.ts to find the row
      'remove-text': getUiText("remove", "Remove")
    }, item);
  },
  renderAdditionalPropertyRow: (value: Node, defaultKey: string = "", uniqueId: string = ""): Node => {
    const keyAttrs: { [key: string]: any } = {
      type: 'text',
      className: 'form-control form-control-sm ap-key js_ap-key',
      placeholder: 'Key',
      value: defaultKey
    };
    if (uniqueId) keyAttrs.id = uniqueId;
    
    const labelAttrs: { [key: string]: any } = { className: 'form-label small' };
    if (uniqueId) labelAttrs.for = uniqueId;

    const keyEl = h('div', {},
      h('label', labelAttrs, 'Key'),
      h('input', keyAttrs)
    );

    return h('div', { className: 'd-flex gap-2 mb-2 align-items-end ap-row js_ap-row' },
      keyEl,
      h('div', { className: 'flex-grow-1' }, value),
      h('button', { type: 'button', className: 'btn btn-sm btn-outline-danger btn-remove-ap js_btn-remove-ap' }, 'X')
    );
  },
  renderLayoutGroup: (title: string | undefined, content: Node, className: string = "d-flex gap-3"): Node => {
    const children = [];
    if (title) {
      children.push(h('label', { className: 'form-label d-block fw-bold' }, title));
    }
    children.push(h('div', { className }, content));
    return h('div', { className: 'layout-group mb-3' }, ...children);
  },
  renderFormWrapper: (content: Node): Node => {
    return h('form', { id: 'generated-form' }, content);
  },
  renderNull: (_node: FormNode): Node => {
    return h('div', { className: 'ui_null text-muted fst-italic' }, 'null');
  },
  renderUnsupported: (node: FormNode): Node => {
    return h('div', { className: 'alert alert-warning' }, `${getUiText("unsupported_type", "Unsupported type")}: ${node.type}`);
  },
  renderHeadlessObject: (elementId: string, content: Node): Node => {
    return h('div', { id: elementId, className: 'headless-object' }, content);
  },
  renderSchemaError: (error: any): Node => {
    return h('div', {
      className: 'alert alert-danger',
      dangerouslySetInnerHTML: `<strong>${getUiText("error_schema_load", "Error: Could not load or parse the schema.")}</strong><br><small>${String(error)}</small>`
    });
  },
  renderFragment: (nodes: Node[]): Node => {
    const fragment = document.createDocumentFragment();
    for (const node of nodes) {
      fragment.appendChild(node);
    }
    return fragment;
  }
};
