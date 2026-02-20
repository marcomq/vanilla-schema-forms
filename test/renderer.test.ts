import { describe, it, expect, afterEach } from 'vitest';
import { hydrateNodeWithData, getName } from '../src/vanilla-renderer/renderer';
import { FormNode } from '../src/core/parser';
import { setConfig, resetConfig } from '../src/core/config';

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

describe('getName', () => {
  afterEach(() => {
    resetConfig();
  });

  it('should generate standard name by default', () => {
    expect(getName(['Root', 'prop'])).toBe('Root[prop]');
    expect(getName(['Root', 'nested', 'prop'])).toBe('Root[nested][prop]');
  });

  it('should skip root when configured', () => {
    setConfig({ html: { skipRootFromName: true } });
    expect(getName(['Root', 'prop'])).toBe('prop');
    expect(getName(['Root', 'nested', 'prop'])).toBe('nested[prop]');
  });

  it('should handle single segment paths when skipping root', () => {
    setConfig({ html: { skipRootFromName: true } });
    expect(getName(['Root'])).toBe('Root');
  });
});
