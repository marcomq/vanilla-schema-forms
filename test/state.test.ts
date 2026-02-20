import { describe, it, expect, vi } from 'vitest';
import { Store } from '../src/core/state';

describe('Store', () => {
  it('should initialize with default state', () => {
    const initialState = { foo: 'bar' };
    const store = new Store(initialState);
    expect(store.get()).toEqual(initialState);
  });

  it('should update state via set', () => {
    const store = new Store({ foo: 'bar' });
    store.set({ foo: 'baz' });
    expect(store.get()).toEqual({ foo: 'baz' });
  });

  it('should update nested path via setPath', () => {
    const store = new Store<any>({});
    store.setPath(['a', 'b'], 1);
    expect(store.get()).toEqual({ a: { b: 1 } });
  });

  it('should create arrays for numeric path segments', () => {
    const store = new Store<any>({});
    store.setPath(['items', 0, 'name'], 'first');
    expect(store.get()).toEqual({ items: [{ name: 'first' }] });
  });

  it('should remove object property via removePath', () => {
    const store = new Store({ a: 1, b: 2 });
    store.removePath(['a']);
    expect(store.get()).toEqual({ b: 2 });
  });

  it('should splice array item via removePath', () => {
    const store = new Store({ items: [1, 2, 3] });
    store.removePath(['items', 1]);
    expect(store.get()).toEqual({ items: [1, 3] });
  });

  it('should handle removing non-existent paths gracefully', () => {
    const store = new Store({ a: 1 });
    store.removePath(['b', 'c']);
    expect(store.get()).toEqual({ a: 1 });
  });

  it('should notify subscribers on change', () => {
    const store = new Store({ count: 0 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    
    store.setPath(['count'], 1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ count: 1 });

    unsubscribe();
    store.setPath(['count'], 2);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
