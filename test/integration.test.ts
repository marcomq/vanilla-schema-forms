// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../src/web-components';
import { parseSchema } from '../src/parser';
import { renderForm } from '../src/renderer';
import { Store } from '../src/state';
import { generateDefaultData } from '../src/form-data-reader';
import { CONFIG } from '../src/config';

describe('Integration Tests', () => {
  let container: HTMLElement;
  let store: Store<any>;

  beforeEach(() => {
    // Setup DOM environment
    container = document.createElement('div');
    container.id = 'form-container';
    document.body.appendChild(container);
    store = new Store({});
  });

  afterEach(() => {
    // Cleanup
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  });

  it('should parse, render, and generate JSON for a schema with definitions', async () => {
    const schema = {
      "definitions": {
        "address": {
          "type": "object",
          "title": "Address",
          "properties": {
            "street": { "type": "string", "default": "Main St" },
            "city": { "type": "string" }
          },
          "required": ["street"]
        }
      },
      "type": "object",
      "properties": {
        "billing": { "$ref": "#/definitions/address" }
      }
    };

    // 1. Parse
    const rootNode = await parseSchema(schema as any);
    expect(rootNode).toBeDefined();

    // 2. Render
    renderForm(rootNode, container, store, CONFIG);
    
    // Verify HTML structure
    const streetInput = document.getElementById('root.billing.street') as HTMLInputElement;
    expect(streetInput).not.toBeNull();
    expect(streetInput.value).toBe('Main St');

    // 3. Initialize Store & Verify JSON
    const initialData = generateDefaultData(rootNode);
    store.reset(initialData);
    
    const data = store.get();
    expect(data).toEqual({
      billing: {
        street: "Main St",
        city: undefined
      }
    });
  });

  it('should handle oneOf polymorphism correctly in form and JSON', async () => {
    const schema = {
      "type": "object",
      "properties": {
        "payment": {
          "oneOf": [
            {
              "title": "Credit Card",
              "type": "object",
              "properties": {
                "cc_number": { "type": "string", "default": "1234" }
              }
            },
            {
              "title": "Cash",
              "type": "object",
              "properties": {
                "receipt": { "type": "boolean", "default": true }
              }
            }
          ]
        }
      }
    };

    const rootNode = await parseSchema(schema as any);
    renderForm(rootNode, container, store, CONFIG);

    // Verify default selection (Credit Card)
    const selector = document.getElementById('root.payment__selector') as HTMLSelectElement;
    expect(selector).not.toBeNull();
    expect(selector.value).toBe('0'); // First option

    // Verify content rendered
    const ccInput = document.getElementById('root.payment.__var_CreditCard.cc_number') as HTMLInputElement;
    expect(ccInput).not.toBeNull();
    expect(ccInput.value).toBe('1234');

    // Verify JSON
    const initialData = generateDefaultData(rootNode);
    store.reset(initialData);
    expect(store.get()).toEqual({
      payment: {
        cc_number: "1234"
      }
    });

    // Switch to Cash
    selector.value = '1';
    selector.dispatchEvent(new Event('change', { bubbles: true }));

    // Verify content updated
    const receiptInput = document.getElementById('root.payment.__var_Cash.receipt') as HTMLInputElement;
    expect(receiptInput).not.toBeNull();
    expect(receiptInput.checked).toBe(true);

    // Verify JSON updated
    expect(store.get()).toEqual({
      payment: {
        receipt: true
      }
    });
  });

  it('should handle arrays of objects', async () => {
    const schema = {
      "type": "object",
      "properties": {
        "users": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" }
            }
          }
        }
      }
    };

    const rootNode = await parseSchema(schema as any);
    renderForm(rootNode, container, store, CONFIG);

    // Initial state: empty array
    const initialData = generateDefaultData(rootNode);
    store.reset(initialData);
    expect(store.get()).toEqual({ users: [] });

    // Add item
    const addButton = container.querySelector('.js_btn-add-array-item') as HTMLButtonElement;
    expect(addButton).not.toBeNull();
    addButton.click();

    // Verify HTML
    const nameInput = document.getElementById('root.users.0.__var_Item1.name') as HTMLInputElement;
    expect(nameInput).not.toBeNull();

    // Verify JSON (Store should update on click via renderer event listener)
    expect(store.get()).toEqual({
      users: [{}] 
    });

    // Input data
    nameInput.value = "Alice";
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));

    expect(store.get()).toEqual({
      users: [{ name: "Alice" }]
    });
  });

  it('should handle allOf by merging properties', async () => {
    const schema = {
      "type": "object",
      "allOf": [
        {
          "properties": {
            "propA": { "type": "string", "default": "A" }
          }
        },
        {
          "properties": {
            "propB": { "type": "string", "default": "B" }
          }
        }
      ]
    };

    const rootNode = await parseSchema(schema as any);
    renderForm(rootNode, container, store, CONFIG);

    // Verify HTML structure
    const inputA = document.getElementById('root.propA') as HTMLInputElement;
    const inputB = document.getElementById('root.propB') as HTMLInputElement;

    expect(inputA).not.toBeNull();
    expect(inputA.value).toBe('A');
    expect(inputB).not.toBeNull();
    expect(inputB.value).toBe('B');

    // Verify JSON
    const initialData = generateDefaultData(rootNode);
    store.reset(initialData);
    
    expect(store.get()).toEqual({
      propA: "A",
      propB: "B"
    });
  });

  it('should handle anyOf as a selection', async () => {
    const schema = {
      "anyOf": [
        { 
          "type": "object", 
          "title": "OptionA", 
          "properties": { "valA": { "type": "string", "default": "A" } } 
        },
        { 
          "type": "object", 
          "title": "OptionB", 
          "properties": { "valB": { "type": "string", "default": "B" } } 
        }
      ]
    };

    const rootNode = await parseSchema(schema as any);
    renderForm(rootNode, container, store, CONFIG);

    // Verify selector exists
    const selector = document.getElementById('root__selector') as HTMLSelectElement;
    expect(selector).not.toBeNull();
    expect(selector.value).toBe('0');
    
    // Verify content
    const inputA = document.getElementById('root.__var_OptionA.valA') as HTMLInputElement;
    expect(inputA).not.toBeNull();
    expect(inputA.value).toBe('A');

    // Verify JSON
    const initialData = generateDefaultData(rootNode);
    store.reset(initialData);
    expect(store.get()).toEqual({ valA: "A" });

    // Switch to OptionB
    selector.value = '1';
    selector.dispatchEvent(new Event('change', { bubbles: true }));

    const inputB = document.getElementById('root.__var_OptionB.valB') as HTMLInputElement;
    expect(inputB).not.toBeNull();
    expect(inputB.value).toBe('B');

    expect(store.get()).toEqual({ valB: "B" });
  });
});