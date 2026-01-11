import { describe, it, expect } from 'vitest';
import { generateDefaultData } from './form-data-reader';
import { FormNode } from './parser';

describe('generateDefaultData', () => {
  it('returns explicit default value if present', () => {
    const node: FormNode = { type: 'string', title: 'Test', defaultValue: 'custom' };
    expect(generateDefaultData(node)).toBe('custom');
  });

  it('returns empty string for string type', () => {
    const node: FormNode = { type: 'string', title: 'Test' };
    expect(generateDefaultData(node)).toBe('');
  });

  it('returns 0 for number/integer type', () => {
    expect(generateDefaultData({ type: 'number', title: 'Test' })).toBe(0);
    expect(generateDefaultData({ type: 'integer', title: 'Test' })).toBe(0);
  });

  it('returns false for boolean type', () => {
    expect(generateDefaultData({ type: 'boolean', title: 'Test' })).toBe(false);
  });

  it('returns null for null type', () => {
    expect(generateDefaultData({ type: 'null', title: 'Test' })).toBe(null);
  });

  it('returns empty array for array type', () => {
    expect(generateDefaultData({ type: 'array', title: 'Test' })).toEqual([]);
  });

  it('returns first enum value if present', () => {
    const node: FormNode = { type: 'string', title: 'Test', enum: ['a', 'b'] };
    expect(generateDefaultData(node)).toBe('a');
  });

  it('generates object structure with required fields', () => {
    const node: FormNode = {
      type: 'object',
      title: 'Root',
      properties: {
        req: { type: 'string', title: 'Req', required: true },
        opt: { type: 'string', title: 'Opt' }
      }
    };
    expect(generateDefaultData(node)).toEqual({ req: '' });
  });

  it('generates object structure with fields having defaults', () => {
    const node: FormNode = {
      type: 'object',
      title: 'Root',
      properties: {
        withDef: { type: 'string', title: 'WithDef', defaultValue: 'def' },
        noDef: { type: 'string', title: 'NoDef' }
      }
    };
    expect(generateDefaultData(node)).toEqual({ withDef: 'def' });
  });

  it('generates object structure for optional complex types', () => {
    const node: FormNode = {
      type: 'object',
      title: 'Root',
      properties: {
        nested: {
          type: 'object',
          title: 'Nested',
          properties: {
            val: { type: 'string', title: 'Val', defaultValue: 'default' }
          }
        }
      }
    };
    expect(generateDefaultData(node)).toEqual({ nested: { val: 'default' } });
  });
});
