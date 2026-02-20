import { describe, it, expect } from 'vitest';
import { createForm } from './index';
import { Store } from './core/state';

describe('createForm (Headless Core)', () => {
  const schema = {
    type: 'object',
    title: 'Test Form',
    properties: {
      name: { type: 'string', default: 'John Doe' },
      age: { type: 'number' },
      active: { type: 'boolean', default: true },
    },
    required: ['name'],
  };

  it('should initialize core components without initial data', async () => {
    const { rootNode, store, finalData } = await createForm(schema);

    // Check rootNode for correct parsing
    expect(rootNode.title).toBe('Test Form');
    expect(rootNode.properties?.name.defaultValue).toBe('John Doe');

    // Check store for correct default data
    expect(store).toBeInstanceOf(Store);
    expect(store.get()).toEqual({
      name: 'John Doe',
      active: true,
    });

    // Check finalData for correct default data
    expect(finalData).toEqual({
      name: 'John Doe',
      active: true,
    });
  });

  it('should initialize with provided initialData', async () => {
    const initialData = {
      name: 'Jane Doe',
      age: 30,
    };
    const { rootNode, store, finalData } = await createForm(schema, initialData);

    // Check rootNode (it should be hydrated with initial data)
    expect(rootNode.properties?.name.defaultValue).toBe('Jane Doe');
    expect(rootNode.properties?.age.defaultValue).toBe(30);
    // This should still come from the schema, as it wasn't in initialData
    expect(rootNode.properties?.active.defaultValue).toBe(true);

    // Check store
    expect(store.get()).toEqual(initialData);

    // Check finalData
    expect(finalData).toEqual(initialData);
  });

  it('should correctly handle a sub-schema path with corresponding initialData', async () => {
    const fullSchema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          title: 'User Details',
          properties: {
            name: { type: 'string', default: 'Sub John' },
            email: { type: 'string' },
          },
        },
      },
    };

    const initialData = {
      user: {
        name: 'Sub Jane'
      }
    };

    const { rootNode, store, finalData } = await createForm(
      fullSchema,
      initialData,
      { subSchemaPath: 'user' }
    );

    // Check rootNode (should be the sub-schema)
    expect(rootNode.title).toBe('User Details');
    expect(rootNode.properties?.name.defaultValue).toBe('Sub Jane'); // Hydrated from sub-data

    // Check store (should contain only sub-data)
    expect(store.get()).toEqual({ name: 'Sub Jane' });

    // Check finalData
    expect(finalData).toEqual({ name: 'Sub Jane' });
  });
});