import { describe, it, expect } from 'vitest';
import { transformSchemaToFormNode } from '../src/core/parser';

describe('transformSchemaToFormNode', () => {
  it('should transform a simple string schema', () => {
    const schema = { type: 'string', title: 'My String' };
    const result = transformSchemaToFormNode(schema as any);
    expect(result).toEqual({
      key: undefined,
      type: 'string',
      title: 'My String',
      description: "",
      defaultValue: undefined,
      enum: undefined,
      required: false,
      minLength: undefined,
      maxLength: undefined,
      minimum: undefined,
      maximum: undefined,
      pattern: undefined
    });
  });

  it('should infer title if missing', () => {
    const schema = { type: 'string' };
    const result = transformSchemaToFormNode(schema as any, 'myProp');
    expect(result.key).toBe('myProp');
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

  it('should handle required fields', () => {
    const schema = {
      type: 'object',
      properties: {
        reqProp: { type: 'string' },
        optProp: { type: 'string' }
      },
      required: ['reqProp']
    };
    const result = transformSchemaToFormNode(schema as any);
    expect(result.properties!['reqProp'].required).toBe(true);
    expect(result.properties!['optProp'].required).toBe(false);
  });

  it('should extract validation keywords', () => {
    const schema = {
      type: 'string',
      minLength: 5,
      maxLength: 10,
      pattern: '^abc'
    };
    const result = transformSchemaToFormNode(schema as any);
    expect(result.minLength).toBe(5);
    expect(result.maxLength).toBe(10);
    expect(result.pattern).toBe('^abc');
  });

  it('should extract numeric validation keywords', () => {
    const schema = {
      type: 'number',
      minimum: 0,
      maximum: 100
    };
    const result = transformSchemaToFormNode(schema as any);
    expect(result.minimum).toBe(0);
    expect(result.maximum).toBe(100);
  });

  it('should handle enums', () => {
    const schema = {
      type: 'string',
      enum: ['a', 'b', 'c']
    };
    const result = transformSchemaToFormNode(schema as any);
    expect(result.enum).toEqual(['a', 'b', 'c']);
  });

  it('should merge allOf schemas including validation', () => {
    const schema = {
      allOf: [
        { type: 'string' },
        { minLength: 3 }
      ]
    };
    const result = transformSchemaToFormNode(schema as any);
    expect(result.type).toBe('string');
    expect(result.minLength).toBe(3);
  });
});