import { describe, it, expect, beforeEach } from 'vitest';
import { CONFIG, DEFAULT_CONFIG, setConfig } from '../src/config';

describe('Config', () => {
  beforeEach(() => {
    // Reset CONFIG to defaults before each test
    CONFIG.sorting = JSON.parse(JSON.stringify(DEFAULT_CONFIG.sorting));
    CONFIG.visibility = JSON.parse(JSON.stringify(DEFAULT_CONFIG.visibility));
    CONFIG.parser = JSON.parse(JSON.stringify(DEFAULT_CONFIG.parser));
    CONFIG.layout = JSON.parse(JSON.stringify(DEFAULT_CONFIG.layout));
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