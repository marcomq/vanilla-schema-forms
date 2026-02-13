import { describe, it, expect, beforeEach } from 'vitest';
import { CONFIG, DEFAULT_CONFIG, setConfig, resetConfig } from '../src/config';

describe('Config', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('should merge sorting configuration', () => {
    setConfig({ sorting: { defaultPriority: ['new', 'priority'] } });
    
    expect(CONFIG.sorting.defaultPriority).toEqual(['new', 'priority']);
    // Ensure other properties in sorting are preserved (shallow merge of sorting object)
    expect(CONFIG.sorting.perObjectPriority).toEqual(DEFAULT_CONFIG.sorting.perObjectPriority);
  });

  it('should merge visibility configuration', () => {
    const customFn = () => true;
    setConfig({ visibility: { customVisibility: customFn } });
    
    expect(CONFIG.visibility.customVisibility).toBe(customFn);
    // Ensure other properties are preserved
    expect(CONFIG.visibility.hiddenPaths).toEqual(DEFAULT_CONFIG.visibility.hiddenPaths);
  });
});