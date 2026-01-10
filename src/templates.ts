import { FormNode } from "./parser";
import { getUiText } from "./i18n";

const defaultTemplates = {
  renderString: (node: FormNode, elementId: string): string => {
    const required = node.required ? 'required' : '';
    const pattern = node.pattern ? `pattern="${node.pattern}"` : '';
    const minLength = node.minLength ? `minlength="${node.minLength}"` : '';
    const maxLength = node.maxLength ? `maxlength="${node.maxLength}"` : '';
    
    return `
    <div class="mb-3">
      <label class="form-label">${node.title} ${node.required ? '<span class="text-danger">*</span>' : ''}</label>
      <input type="text" class="form-control" id="${elementId}" value="${node.defaultValue || ''}" ${required} ${pattern} ${minLength} ${maxLength}>
      ${node.description ? `<div class="form-text">${node.description}</div>` : ''}
    </div>
  `;
  },

  renderNumber: (node: FormNode, elementId: string): string => {
    const required = node.required ? 'required' : '';
    const min = node.minimum !== undefined ? `min="${node.minimum}"` : '';
    const max = node.maximum !== undefined ? `max="${node.maximum}"` : '';

    return `
    <div class="mb-3">
      <label class="form-label">${node.title} ${node.required ? '<span class="text-danger">*</span>' : ''}</label>
      <input type="number" class="form-control" id="${elementId}" value="${node.defaultValue || ''}" ${required} ${min} ${max}>
      ${node.description ? `<div class="form-text">${node.description}</div>` : ''}
    </div>
  `;
  },

  renderBoolean: (node: FormNode, elementId: string, attributes: string = ""): string => {
    const required = node.required ? 'required' : '';
    
    return `
    <div class="mb-3 form-check">
      <input type="checkbox" class="form-check-input" id="${elementId}" ${node.defaultValue ? 'checked' : ''} ${attributes} ${required}>
      <label class="form-check-label" for="${elementId}">${node.title} ${node.required ? '<span class="text-danger">*</span>' : ''}</label>
      ${node.description ? `<div class="form-text">${node.description}</div>` : ''}
    </div>
  `;
  },

  renderSelect: (node: FormNode, elementId: string, options: string[] = []): string => {
    const opts = options.map(o => `<option value="${o}">${o}</option>`).join('');
    const required = node.required ? 'required' : '';

    return `
    <div class="mb-3">
      <label class="form-label">${node.title} ${node.required ? '<span class="text-danger">*</span>' : ''}</label>
      <select class="form-select" id="${elementId}" ${required}>
        ${opts}
      </select>
      ${node.description ? `<div class="form-text">${node.description}</div>` : ''}
    </div>
  `;
  },

  renderObject: (node: FormNode, elementId: string, contentHtml: string): string => {
    return `
    <fieldset class="border p-3 rounded mb-3 ui_obj" id="${elementId}">
      <legend class="h6">${node.title}</legend>
      ${node.description ? `<div class="form-text mb-3">${node.description}</div>` : ''}
      ${contentHtml}
    </fieldset>
  `;
  },

  renderAdditionalProperties: (node: FormNode, elementId: string): string => {
    if (!node.additionalProperties) return "";
    return `
    <div class="additional-properties js_additional-properties mt-3 border-top pt-2">
      <h6>${getUiText("additional_properties", "Additional Properties")}</h6>
      <div class="ap-items js_ap-items"></div>
      <button type="button" class="btn btn-sm btn-outline-secondary mt-2 btn-add-ap js_btn-add-ap" data-id="${elementId}">${getUiText("add_property", "Add Property")}</button>
    </div>
  `;
  },

  renderOneOf: (node: FormNode, elementId: string): string => {
    if (!node.oneOf || node.oneOf.length === 0) return "";

    // Try to find a "null" option to select by default
    let selectedIndex = node.oneOf.findIndex(opt => opt.type === 'null');
    if (selectedIndex === -1) {
      selectedIndex = node.oneOf.findIndex(opt => {
        const title = opt.title.toLowerCase();
        return title === 'null' || title === 'none';
      });
    }
    if (selectedIndex === -1) selectedIndex = 0;

    const options = node.oneOf.map((opt, idx) => {
      const selected = idx === selectedIndex ? 'selected' : '';
      return `<option value="${idx}" ${selected}>${opt.title}</option>`;
    }).join('');

    return `
    <div class="mt-3 border-top pt-3">
      <label class="form-label small text-muted">${getUiText("type_variant", "Type / Variant")}</label>
      <select class="form-select mb-2 oneof-selector js_oneof-selector" id="${elementId}__selector" data-id="${elementId}">
        ${options}
      </select>
      <div class="oneof-container ps-3 border-start" id="${elementId}__oneof_content"></div>
    </div>
  `;
  },

  renderArray: (node: FormNode, elementId: string): string => {
    return `
    <fieldset class="border p-3 rounded mb-3 ui_arr" id="${elementId}">
      <legend class="h6">${node.title}</legend>
      ${node.description ? `<div class="form-text mb-3">${node.description}</div>` : ''}
      <div class="array-items js_array-items" id="${elementId}-items"></div>
      ${node.items ? `<button type="button" class="btn btn-sm btn-outline-primary mt-2 btn-add-array-item js_btn-add-array-item" data-id="${elementId}" data-target="${elementId}-items">${getUiText("add_item", "Add Item")}</button>` : ''}
    </fieldset>
  `;
  },

  renderArrayItem: (itemHtml: string): string => {
    return `
    <div class="d-flex gap-2 mb-2 align-items-start array-item-row js_array-item-row">
      <div class="flex-grow-1">
        ${itemHtml}
      </div>
      <button type="button" class="btn btn-sm btn-outline-danger btn-remove-item js_btn-remove-item" style="margin-top: 2rem;">${getUiText("remove", "Remove")}</button>
    </div>
  `;
  },

  renderAdditionalPropertyRow: (valueHtml: string): string => {
    return `
    <div class="d-flex gap-2 mb-2 align-items-end ap-row js_ap-row">
      <div><label class="form-label small">Key</label><input type="text" class="form-control form-control-sm ap-key js_ap-key" placeholder="Key"></div>
      <div class="flex-grow-1">${valueHtml}</div>
      <button type="button" class="btn btn-sm btn-outline-danger btn-remove-ap js_btn-remove-ap">X</button>
    </div>
  `;
  },

  renderLayoutGroup: (title: string | undefined, contentHtml: string, className: string = "d-flex gap-3"): string => {
    return `
    <div class="layout-group mb-3">
        ${title ? `<label class="form-label d-block fw-bold">${title}</label>` : ''}
        <div class="${className}">
            ${contentHtml}
        </div>
    </div>`;
  },

  renderFormWrapper: (html: string): string => {
    return `<form id="generated-form">${html}</form>`;
  },

  renderNull: (node: FormNode): string => {
    return `<div class="ui_null text-muted fst-italic">null</div>`;
  },

  renderUnsupported: (node: FormNode): string => {
    return `<div class="alert alert-warning">${getUiText("unsupported_type", "Unsupported type")}: ${node.type}</div>`;
  },

  renderHeadlessObject: (elementId: string, contentHtml: string): string => {
    return `<div id="${elementId}" class="headless-object">${contentHtml}</div>`;
  },

  renderSchemaError: (error: any): string => {
    return `<div class="alert alert-danger">
    <strong>${getUiText("error_schema_load", "Error: Could not load or parse the schema.")}</strong>
    <br>
    <small>${String(error)}</small>
  </div>`;
  }
};

let currentTemplates = { ...defaultTemplates };

export type Templates = typeof defaultTemplates;

export function setTemplates(templates: Partial<Templates>) {
  currentTemplates = { ...currentTemplates, ...templates };
}

export function renderString(node: FormNode, elementId: string): string { return currentTemplates.renderString(node, elementId); }
export function renderNumber(node: FormNode, elementId: string): string { return currentTemplates.renderNumber(node, elementId); }
export function renderBoolean(node: FormNode, elementId: string, attributes: string = ""): string { return currentTemplates.renderBoolean(node, elementId, attributes); }
export function renderSelect(node: FormNode, elementId: string, options: string[] = []): string { return currentTemplates.renderSelect(node, elementId, options); }
export function renderObject(node: FormNode, elementId: string, contentHtml: string): string { return currentTemplates.renderObject(node, elementId, contentHtml); }
export function renderAdditionalProperties(node: FormNode, elementId: string): string { return currentTemplates.renderAdditionalProperties(node, elementId); }
export function renderOneOf(node: FormNode, elementId: string): string { return currentTemplates.renderOneOf(node, elementId); }
export function renderArray(node: FormNode, elementId: string): string { return currentTemplates.renderArray(node, elementId); }
export function renderArrayItem(itemHtml: string): string { return currentTemplates.renderArrayItem(itemHtml); }
export function renderAdditionalPropertyRow(valueHtml: string): string { return currentTemplates.renderAdditionalPropertyRow(valueHtml); }
export function renderLayoutGroup(title: string | undefined, contentHtml: string, className?: string): string { return currentTemplates.renderLayoutGroup(title, contentHtml, className); }
export function renderFormWrapper(html: string): string { return currentTemplates.renderFormWrapper(html); }
export function renderNull(node: FormNode): string { return currentTemplates.renderNull(node); }
export function renderUnsupported(node: FormNode): string { return currentTemplates.renderUnsupported(node); }
export function renderHeadlessObject(elementId: string, contentHtml: string): string { return currentTemplates.renderHeadlessObject(elementId, contentHtml); }
export function renderSchemaError(error: any): string { return currentTemplates.renderSchemaError(error); }
