import { describe, it, expect } from 'vitest';
import { transformSchemaToFormNode } from './parser';

describe('transformSchemaToFormNode', () => {
  it('should transform a simple string schema', () => {
    const schema = { type: 'string', title: 'My String' };
    const result = transformSchemaToFormNode(schema as any);
    expect(result).toEqual({
      type: 'string',
      title: 'My String',
      description: undefined,
      defaultValue: undefined
    });
  });

  it('should infer title if missing', () => {
    const schema = { type: 'string' };
    const result = transformSchemaToFormNode(schema as any, 'myProp');
    expect(result.title).toBe('My Prop');
  });

  it('should handle objects with properties', () => {
    const schema = {
      type: 'object',
      properties: {
        prop1: { type: 'string' }
      }
    };
    const result = transformSchemaToFormNode(schema as any);
    expect(result.type).toBe('object');
    expect(result.properties).toBeDefined();
    expect(result.properties!['prop1'].type).toBe('string');
  });

  it('should handle arrays', () => {
    const schema = {
      type: 'array',
      items: { type: 'number' }
    };
    const result = transformSchemaToFormNode(schema as any);
    expect(result.type).toBe('array');
    expect(result.items).toBeDefined();
    expect(result.items!.type).toBe('number');
  });
});