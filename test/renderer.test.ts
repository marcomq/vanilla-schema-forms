import { describe, it, expect } from 'vitest';
import { hydrateNodeWithData } from '../src/renderer';
import { FormNode } from '../src/parser';

describe('hydrateNodeWithData', () => {
  it('preserves primitive values', () => {
    const node: FormNode = { type: 'string', title: 'Test' };
    const hydrated = hydrateNodeWithData(node, 'hello');
    expect(hydrated.defaultValue).toBe('hello');
  });

  it('preserves object properties recursively', () => {
    const node: FormNode = {
      type: 'object',
      title: 'Root',
      properties: {
        child: { type: 'string', title: 'Child' }
      }
    };
    const data = { child: 'value' };
    const hydrated = hydrateNodeWithData(node, data);
    expect(hydrated.properties?.child.defaultValue).toBe('value');
  });

  it('validates enums before preserving', () => {
    const node: FormNode = {
      type: 'string',
      title: 'Enum',
      enum: ['A', 'B']
    };
    
    // Valid
    const valid = hydrateNodeWithData(node, 'A');
    expect(valid.defaultValue).toBe('A');

    // Invalid
    const invalid = hydrateNodeWithData(node, 'C');
    expect(invalid.defaultValue).toBeUndefined();
  });
});
