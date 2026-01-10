import { FormNode } from "./parser";

export function renderString(node: FormNode, elementId: string): string {
  return `
    <div class="mb-3">
      <label class="form-label">${node.title}</label>
      <input type="text" class="form-control" id="${elementId}" value="${node.defaultValue || ''}">
      ${node.description ? `<div class="form-text">${node.description}</div>` : ''}
    </div>
  `;
}

export function renderNumber(node: FormNode, elementId: string): string {
  return `
    <div class="mb-3">
      <label class="form-label">${node.title}</label>
      <input type="number" class="form-control" id="${elementId}" value="${node.defaultValue || ''}">
      ${node.description ? `<div class="form-text">${node.description}</div>` : ''}
    </div>
  `;
}

export function renderBoolean(node: FormNode, elementId: string, attributes: string = ""): string {
  return `
    <div class="mb-3 form-check">
      <input type="checkbox" class="form-check-input" id="${elementId}" ${node.defaultValue ? 'checked' : ''} ${attributes}>
      <label class="form-check-label" for="${elementId}">${node.title}</label>
      ${node.description ? `<div class="form-text">${node.description}</div>` : ''}
    </div>
  `;
}

export function renderSelect(node: FormNode, elementId: string, options: string[] = []): string {
  const opts = options.map(o => `<option value="${o}">${o}</option>`).join('');
  return `
    <div class="mb-3">
      <label class="form-label">${node.title}</label>
      <select class="form-select" id="${elementId}">
        ${opts}
      </select>
      ${node.description ? `<div class="form-text">${node.description}</div>` : ''}
    </div>
  `;
}

export function renderObject(node: FormNode, elementId: string, contentHtml: string): string {
  return `
    <fieldset class="border p-3 rounded mb-3 ui_obj" id="${elementId}">
      <legend class="h6">${node.title}</legend>
      ${node.description ? `<div class="form-text mb-3">${node.description}</div>` : ''}
      ${contentHtml}
    </fieldset>
  `;
}

export function renderAdditionalProperties(node: FormNode, elementId: string): string {
  if (!node.additionalProperties) return "";
  return `
    <div class="additional-properties mt-3">
      <h6>Additional Properties</h6>
      <div class="ap-items"></div>
      <button type="button" class="btn btn-sm btn-outline-secondary mt-2 btn-add-ap" data-id="${elementId}">Add Property</button>
    </div>
  `;
}

export function renderOneOf(node: FormNode, elementId: string): string {
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
      <label class="form-label small text-muted">Type / Variant</label>
      <select class="form-select mb-2 oneof-selector" id="${elementId}__selector" data-id="${elementId}">
        ${options}
      </select>
      <div class="oneof-container ps-3 border-start" id="${elementId}__oneof_content"></div>
    </div>
  `;
}

export function renderArray(node: FormNode, elementId: string): string {
  return `
    <fieldset class="border p-3 rounded mb-3 ui_arr" id="${elementId}">
      <legend class="h6">${node.title}</legend>
      ${node.description ? `<div class="form-text mb-3">${node.description}</div>` : ''}
      <div class="array-items" id="${elementId}-items"></div>
      ${node.items ? `<button type="button" class="btn btn-sm btn-outline-primary mt-2 btn-add-array-item" data-id="${elementId}" data-target="${elementId}-items">Add Item</button>` : ''}
    </fieldset>
  `;
}

export function renderArrayItem(itemHtml: string): string {
  return `
    <div class="d-flex gap-2 mb-2 align-items-start array-item-row">
      <div class="flex-grow-1">
        ${itemHtml}
      </div>
      <button type="button" class="btn btn-sm btn-outline-danger btn-remove-item" style="margin-top: 2rem;">Remove</button>
    </div>
  `;
}

export function renderAdditionalPropertyRow(valueHtml: string): string {
  return `
    <div class="d-flex gap-2 mb-2 align-items-end ap-row">
      <div><label class="form-label small">Key</label><input type="text" class="form-control form-control-sm ap-key" placeholder="Key"></div>
      <div class="flex-grow-1">${valueHtml}</div>
      <button type="button" class="btn btn-sm btn-outline-danger btn-remove-ap">X</button>
    </div>
  `;
}
