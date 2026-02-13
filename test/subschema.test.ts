// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { init } from '../src/index';

describe('Sub-schema Rendering', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'form-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  });

  it('should render only the specified sub-schema', async () => {
    const schema = {
      type: "object",
      title: "Root",
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" }
          }
        },
        meta: { type: "string" }
      }
    };

    const data = {
      user: { name: "Alice", age: 30 },
      meta: "info"
    };

    // Render only 'user'
    const result = await init(container, schema, data, undefined, { subSchemaPath: 'user' });
    const getData = result!.getData;

    // Check DOM - ID is generated based on sub-root key (which becomes the new root)
    expect(document.getElementById('root.name')).not.toBeNull();
    expect(document.getElementById('root.meta')).toBeNull();

    // Check Data (scoped to sub-schema)
    expect(getData()).toEqual({ name: "Alice", age: 30 });
  });

  it('should handle nested paths', async () => {
     const schema = {
      type: "object",
      properties: {
        a: {
          type: "object",
          properties: {
            b: {
              type: "object",
              properties: {
                c: { type: "string" }
              }
            }
          }
        }
      }
    };
    
    await init(container, schema, {}, undefined, { subSchemaPath: 'a.b' });
    expect(document.getElementById('root.c')).not.toBeNull();
  });
  
  it('should generate default data if sub-data is missing', async () => {
    const schema = {
      type: "object",
      properties: {
        config: {
          type: "object",
          properties: {
            enabled: { type: "boolean", default: true }
          }
        }
      }
    };
    
    // Pass empty object as data
    const result = await init(container, schema, {}, undefined, { subSchemaPath: 'config' });
    expect(result!.getData()).toEqual({ enabled: true });
  });

  it('should show error for invalid path', async () => {
      const schema = { type: "object", properties: { a: { type: "string" } } };
      const result = await init(container, schema, {}, undefined, { subSchemaPath: 'invalid' });
      expect(result).toBeUndefined();
      expect(container.textContent).toContain('Error: sub-schema path "invalid" not found');
  });
});