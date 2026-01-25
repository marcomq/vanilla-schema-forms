/**
 * Web Components for Vanilla Schema Forms.
 * These components wrap native form elements to provide a custom element interface
 * while maintaining compatibility with standard form events and CSS frameworks.
 */

import { rendererConfig } from "./dom-renderer";

export class VsfInput extends HTMLElement {
  static get observedAttributes() {
    return ['id', 'class', 'type', 'value', 'checked', 'placeholder', 'required', 'disabled', 'readonly', 'min', 'max', 'step', 'minlength', 'maxlength', 'pattern', 'data-toggle-target'];
  }

  private input: HTMLInputElement;

  constructor() {
    super();
    this.input = document.createElement('input');
  }

  get value() { return this.input.value; }
  set value(val) { this.input.value = val; }

  get checked() { return this.input.checked; }
  set checked(val) { this.input.checked = val; }

  get type() { return this.input.type; }

  connectedCallback() {
    // display: contents makes this wrapper invisible to the layout engine,
    // so the inner input behaves as if it were a direct child of the form.
    this.style.display = 'contents';
    if (!this.contains(this.input)) {
      this.appendChild(this.input);
    }
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;

    // Move ID and Class to the inner input to ensure labels and styling work
    if (name === 'id' || name === 'class' || name === 'data-toggle-target') {
      if (newValue !== null) {
        this.input.setAttribute(name, newValue);
        // Remove from host to avoid duplicate IDs and double styling
        this.removeAttribute(name);
      }
    } else if (name === 'checked') {
      this.input.checked = newValue !== null;
    } else if (name === 'value') {
      this.input.value = newValue || '';
    } else {
      if (newValue === null) {
        this.input.removeAttribute(name);
      } else {
        this.input.setAttribute(name, newValue);
      }
    }
  }
}

export class VsfSelect extends HTMLElement {
  static get observedAttributes() {
    return ['id', 'class', 'required', 'disabled', 'multiple', 'data-id'];
  }

  private select: HTMLSelectElement;

  constructor() {
    super();
    this.select = document.createElement('select');
  }

  get value() { return this.select.value; }
  set value(val) { this.select.value = val; }

  connectedCallback() {
    this.style.display = 'contents';
    
    // Move existing children (options) into the select
    Array.from(this.childNodes).forEach(node => {
      if (node !== this.select) {
        this.select.appendChild(node);
      }
    });
    if (!this.contains(this.select)) this.appendChild(this.select);
    
    // Observer for future child additions (e.g. if options are added dynamically)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node !== this.select) {
            this.select.appendChild(node);
          }
        });
      });
    });
    observer.observe(this, { childList: true });
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;

    if (name === 'id' || name === 'class' || name === 'data-id') {
      if (newValue !== null) {
        this.select.setAttribute(name, newValue);
        this.removeAttribute(name);
      }
    } else {
      if (newValue === null) {
        this.select.removeAttribute(name);
      } else {
        this.select.setAttribute(name, newValue);
      }
    }
  }
}

export class VsfLabel extends HTMLElement {
  static get observedAttributes() {
    return ['id', 'class', 'for'];
  }

  private label: HTMLLabelElement;

  constructor() {
    super();
    this.label = document.createElement('label');
  }

  connectedCallback() {
    this.style.display = 'contents';
    this.handleContentChange();
    
    // Observe child changes to ensure content is always wrapped in the internal label
    // This is necessary because VsfFormItem uses innerHTML to set label content,
    // which would otherwise wipe out the internal <label> element.
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (Array.from(mutation.removedNodes).includes(this.label)) {
          this.label.innerHTML = '';
        }
      });
      this.handleContentChange();
    });
    observer.observe(this, { childList: true });
  }

  handleContentChange() {
    Array.from(this.childNodes).forEach(node => {
      if (node !== this.label) {
        this.label.appendChild(node);
      }
    });
    if (!this.contains(this.label)) this.appendChild(this.label);
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;
    if (name === 'id' || name === 'class' || name === 'for') {
      if (newValue !== null) {
        this.label.setAttribute(name, newValue);
        this.removeAttribute(name);
      }
    }
  }
}

export class VsfFieldset extends HTMLElement {
  static get observedAttributes() {
    return ['id', 'class', 'disabled', 'name', 'form'];
  }

  private fieldset: HTMLFieldSetElement;

  constructor() {
    super();
    this.fieldset = document.createElement('fieldset');
  }

  connectedCallback() {
    this.style.display = 'contents';
    Array.from(this.childNodes).forEach(node => {
      if (node !== this.fieldset) {
        this.fieldset.appendChild(node);
      }
    });
    if (!this.contains(this.fieldset)) this.appendChild(this.fieldset);
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;
    if (newValue !== null) {
      this.fieldset.setAttribute(name, newValue);
      this.removeAttribute(name);
    } else {
      this.fieldset.removeAttribute(name);
    }
  }
}

export class VsfLegend extends HTMLElement {
  static get observedAttributes() {
    return ['id', 'class'];
  }

  private legend: HTMLLegendElement;

  constructor() {
    super();
    this.legend = document.createElement('legend');
  }

  connectedCallback() {
    this.style.display = 'contents';
    Array.from(this.childNodes).forEach(node => {
      if (node !== this.legend) {
        this.legend.appendChild(node);
      }
    });
    if (!this.contains(this.legend)) this.appendChild(this.legend);
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;
    if (newValue !== null) {
      this.legend.setAttribute(name, newValue);
      this.removeAttribute(name);
    } else {
      this.legend.removeAttribute(name);
    }
  }
}

export class VsfFormItem extends HTMLElement {
  static get observedAttributes() {
    return ['label', 'element-id', 'required', 'description'];
  }

  private labelEl: HTMLElement;
  private descEl: HTMLElement;

  constructor() {
    super();
    this.labelEl = document.createElement('vsf-label');
    this.descEl = document.createElement('div');
    this.descEl.className = rendererConfig.classes.description;
  }

  connectedCallback() {
    // This component represents the wrapper div, so we keep standard display
    this.style.display = 'block';
    // But we ensure the order of children: Label -> Content -> Description
    this.render();
  }

  attributeChangedCallback() {
    if (this.isConnected) {
      this.render();
    }
  }

  render() {
    const id = this.getAttribute('element-id');
    const label = this.getAttribute('label');
    const required = this.hasAttribute('required');
    const desc = this.getAttribute('description');

    // 1. Setup Label
    if (label) {
      this.labelEl.setAttribute('class', rendererConfig.classes.label);
      if (id) this.labelEl.setAttribute('for', id);
      this.labelEl.innerHTML = `${label}${required ? `<span class="${rendererConfig.classes.textDanger}">*</span>` : ''}`;
      if (!this.contains(this.labelEl)) {
        this.prepend(this.labelEl);
      }
    } else {
      if (this.contains(this.labelEl)) this.removeChild(this.labelEl);
    }

    // 2. Setup Description
    if (desc) {
      this.descEl.textContent = desc;
      if (!this.contains(this.descEl)) {
        this.appendChild(this.descEl);
      }
    } else {
      if (this.contains(this.descEl)) this.removeChild(this.descEl);
    }
  }
}

export class VsfAdditionalProperties extends HTMLElement {
  static get observedAttributes() {
    return ['title', 'element-id', 'add-text', 'key-pattern'];
  }

  connectedCallback() {
    this.style.display = 'block';
    const title = this.getAttribute('title');
    const elementId = this.getAttribute('element-id');
    const addText = this.getAttribute('add-text') || 'Add Property';
    const keyPattern = this.getAttribute('key-pattern');

    // Clear and rebuild to ensure structure
    // Note: In a real app we might want to preserve existing items if they were moved,
    // but for this renderer usage, we are usually building from scratch.
    
    // 1. Title
    if (title) {
      let titleEl = this.querySelector('h6');
      if (!titleEl) {
        titleEl = document.createElement('h6');
        this.prepend(titleEl);
      }
      titleEl.textContent = title;
    }

    // 2. Items Container (The renderer will append items here, so we just ensure it exists)
    let itemsContainer = this.querySelector(`.${rendererConfig.triggers.additionalPropertyItems}`);
    if (!itemsContainer) {
      itemsContainer = document.createElement('div');
      itemsContainer.className = `${rendererConfig.classes.additionalPropertiesItems} ${rendererConfig.triggers.additionalPropertyItems}`;
      this.appendChild(itemsContainer);
    }

    // 3. Add Button
    let btn = this.querySelector(`.${rendererConfig.triggers.addAdditionalProperty}`);
    if (!btn) {
      btn = document.createElement('button');
      btn.className = `${rendererConfig.classes.buttonSecondary} btn-add-ap ${rendererConfig.triggers.addAdditionalProperty}`;
      btn.setAttribute('type', 'button');
      this.appendChild(btn);
    }
    
    if (elementId) btn.setAttribute('data-id', elementId);
    if (keyPattern) btn.setAttribute('data-key-pattern', keyPattern);
    btn.textContent = addText;
  }
}

export class VsfArray extends HTMLElement {
  static get observedAttributes() {
    return ['element-id', 'add-text'];
  }

  connectedCallback() {
    this.style.display = 'block';
    const elementId = this.getAttribute('element-id');
    const addText = this.getAttribute('add-text') || 'Add Item';

    // 1. Items Container
    let itemsContainer = this.querySelector(`.${rendererConfig.triggers.arrayItems}`);
    if (!itemsContainer) {
      itemsContainer = document.createElement('div');
      itemsContainer.className = `${rendererConfig.classes.arrayItems} ${rendererConfig.triggers.arrayItems}`;
      if (elementId) itemsContainer.id = `${elementId}-items`;
      this.prepend(itemsContainer);
    }

    // 2. Add Button
    let btn = this.querySelector(`.${rendererConfig.triggers.addArrayItem}`);
    if (!btn) {
      btn = document.createElement('button');
      btn.className = `${rendererConfig.classes.buttonPrimary} btn-add-array-item ${rendererConfig.triggers.addArrayItem}`;
      btn.setAttribute('type', 'button');
      this.appendChild(btn);
    }
    
    if (elementId) {
      btn.setAttribute('data-id', elementId);
      btn.setAttribute('data-target', `${elementId}-items`);
    }
    btn.textContent = addText;
  }
}

export class VsfArrayItem extends HTMLElement {
  static get observedAttributes() {
    return ['remove-text'];
  }

  connectedCallback() {
    this.style.display = 'flex';
    this.classList.add(...rendererConfig.classes.arrayItemRow.split(' '), rendererConfig.triggers.arrayItemRow);

    // 1. Content Wrapper (for the item itself)
    // We move existing children (the rendered item) into a wrapper if not already there
    let contentWrapper = this.querySelector(`.${rendererConfig.triggers.arrayItemContent}`);
    if (!contentWrapper) {
      contentWrapper = document.createElement('div');
      contentWrapper.className = `${rendererConfig.classes.arrayItemContent} ${rendererConfig.triggers.arrayItemContent}`;
      while (this.firstChild) {
        contentWrapper.appendChild(this.firstChild);
      }
      this.appendChild(contentWrapper);
    }

    // 2. Remove Button
    let btn: HTMLButtonElement | null = this.querySelector(`.${rendererConfig.triggers.removeArrayItem}`);
    if (!btn) {
      btn = document.createElement('button');
      btn.className = `${rendererConfig.classes.buttonDanger} btn-remove-item ${rendererConfig.triggers.removeArrayItem}`;
      btn.setAttribute('type', 'button');
      // Align with input height or label
      btn.style.marginTop = '2rem'; 
      this.appendChild(btn);
    }
    btn.textContent = this.getAttribute('remove-text') || 'Remove';
  }
}

export class VsfOneOf extends HTMLElement {
  static get observedAttributes() {
    return ['element-id'];
  }

  connectedCallback() {
    this.style.display = 'block';
    const elementId = this.getAttribute('element-id');
    
    // 1. Content Container
    let content = this.querySelector('.oneof-container');
    if (!content) {
      content = document.createElement('div');
      content.className = rendererConfig.classes.oneOfContainer;
      if (elementId) content.id = `${elementId}__oneof_content`;
      this.appendChild(content);
    }
  }
}

export class VsfAdditionalPropertyItem extends HTMLElement {
  static get observedAttributes() {
    return ['key-value', 'key-id', 'remove-text'];
  }

  connectedCallback() {
    this.style.display = 'flex';
    this.classList.add(...rendererConfig.classes.additionalPropertyItem.split(' '), rendererConfig.triggers.additionalPropertyRow);

    const keyValue = this.getAttribute('key-value') || '';
    const keyId = this.getAttribute('key-id');
    const removeText = this.getAttribute('remove-text') || 'X';

    // 1. Key Container
    let keyContainer = this.querySelector(`.${rendererConfig.triggers.apKeyContainer}`);
    if (!keyContainer) {
      keyContainer = document.createElement('div');
      keyContainer.className = `${rendererConfig.classes.apKeyContainer} ${rendererConfig.triggers.apKeyContainer}`;
      
      const label = document.createElement('label');
      label.className = rendererConfig.classes.labelSmall;
      label.textContent = 'Key';
      if (keyId) label.htmlFor = keyId;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = `${rendererConfig.classes.inputSmall} ap-key ${rendererConfig.triggers.additionalPropertyKey}`;
      input.placeholder = 'Key';
      input.value = keyValue;
      // Initialize data-original-key for tracking renames (used in events.ts)
      input.setAttribute('data-original-key', keyValue);
      if (keyId) input.id = keyId;

      keyContainer.appendChild(label);
      keyContainer.appendChild(input);
      
      this.prepend(keyContainer);
    }

    // 2. Remove Button
    let btn: HTMLButtonElement | null = this.querySelector(`.${rendererConfig.triggers.removeAdditionalProperty}`);
    if (!btn) {
      btn = document.createElement('button');
      btn.className = `${rendererConfig.classes.buttonDanger} btn-remove-ap ${rendererConfig.triggers.removeAdditionalProperty}`;
      btn.setAttribute('type', 'button');
      this.appendChild(btn);
    }
    btn.textContent = removeText;

    // 3. Value Wrapper
    // Wrap everything that isn't key or button (the value content passed as children)
    let valueWrapper = this.querySelector(`.${rendererConfig.triggers.apValueWrapper}`);
    if (!valueWrapper) {
      valueWrapper = document.createElement('div');
      valueWrapper.className = `${rendererConfig.classes.apValueWrapper} ${rendererConfig.triggers.apValueWrapper}`;
      
      Array.from(this.childNodes).forEach(node => {
        if (node !== keyContainer && node !== btn && node !== valueWrapper) {
          valueWrapper!.appendChild(node);
        }
      });
      
      // Place wrapper between key and button
      this.insertBefore(valueWrapper, btn);
    }
  }
}

// Register components if not already defined
if (!customElements.get('vsf-input')) customElements.define('vsf-input', VsfInput);
if (!customElements.get('vsf-select')) customElements.define('vsf-select', VsfSelect);
if (!customElements.get('vsf-label')) customElements.define('vsf-label', VsfLabel);
if (!customElements.get('vsf-fieldset')) customElements.define('vsf-fieldset', VsfFieldset);
if (!customElements.get('vsf-legend')) customElements.define('vsf-legend', VsfLegend);
if (!customElements.get('vsf-form-item')) customElements.define('vsf-form-item', VsfFormItem);
if (!customElements.get('vsf-additional-properties')) customElements.define('vsf-additional-properties', VsfAdditionalProperties);
if (!customElements.get('vsf-array')) customElements.define('vsf-array', VsfArray);
if (!customElements.get('vsf-array-item')) customElements.define('vsf-array-item', VsfArrayItem);
if (!customElements.get('vsf-oneof')) customElements.define('vsf-oneof', VsfOneOf);
if (!customElements.get('vsf-additional-property-item')) customElements.define('vsf-additional-property-item', VsfAdditionalPropertyItem);