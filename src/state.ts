/**
 * Reactive state management for the form data.
 * This store holds the current state of the form and notifies listeners of changes.
 */

export type StateListener<T> = (state: T) => void;

export class Store<T> {
  private state: T;
  private listeners: Set<StateListener<T>> = new Set();

  constructor(initialState: T) {
    this.state = initialState;
  }

  /**
   * Returns the current state snapshot.
   */
  get(): T {
    return this.state;
  }

  /**
   * Retrieves a value at a specific path.
   */
  getPath(path: (string | number)[]): any {
    let current: any = this.state;
    for (const key of path) {
      if (current === undefined || current === null) return undefined;
      current = current[key];
    }
    return current;
  }

  /**
   * Replaces the entire state and notifies listeners.
   */
  set(newState: T): void {
    this.state = newState;
    this.notify();
  }

  /**
   * Resets the state to the provided value.
   */
  reset(initialState: T): void {
    this.state = initialState;
    this.notify();
  }

  /**
   * Updates a value at a specific path (e.g., ['properties', 'url']) and notifies listeners.
   * Automatically creates intermediate objects or arrays if they don't exist.
   */
  setPath(path: (string | number)[], value: any): void {
    if (path.length === 0) {
      this.set(value);
      return;
    }

    // Use structuredClone for a deep copy to ensure immutability of the previous state
    // and to trigger reactivity in systems that rely on reference equality.
    const newState = structuredClone(this.state);
    let current: any = newState;

    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      // If the key doesn't exist, create an object or array based on the next key
      if (current[key] === undefined || current[key] === null) {
        const nextKey = path[i + 1];
        current[key] = typeof nextKey === 'number' ? [] : {};
      }
      current = current[key];
    }

    current[path[path.length - 1]] = value;
    this.state = newState;
    this.notify();
  }

  /**
   * Removes a value at a specific path.
   * If the target is an array item, it splices the array.
   * If the target is an object property, it deletes the key.
   */
  removePath(path: (string | number)[]): void {
    if (path.length === 0) return;

    const newState = structuredClone(this.state);
    let current: any = newState;

    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
      if (current === undefined || current === null) return; // Path doesn't exist
    }

    const lastKey = path[path.length - 1];
    if (Array.isArray(current) && typeof lastKey === 'number') {
      current.splice(lastKey, 1);
    } else {
      delete current[lastKey];
    }
    this.state = newState;
    this.notify();
  }

  /**
   * Subscribes a listener to state changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener: StateListener<T>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

// Global store instance for the form data
export const formStore = new Store<Record<string, any>>({});