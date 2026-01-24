/**
 * Web Components for Vanilla Schema Forms.
 * These components wrap native form elements to provide a custom element interface
 * while maintaining compatibility with standard form events and CSS frameworks.
 */

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

// Register components if not already defined
if (!customElements.get('vsf-input')) customElements.define('vsf-input', VsfInput);
if (!customElements.get('vsf-select')) customElements.define('vsf-select', VsfSelect);
if (!customElements.get('vsf-label')) customElements.define('vsf-label', VsfLabel);
if (!customElements.get('vsf-fieldset')) customElements.define('vsf-fieldset', VsfFieldset);