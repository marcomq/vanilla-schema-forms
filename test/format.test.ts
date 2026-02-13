import { describe, it, expect } from 'vitest';
import { parseSchema } from '../src/parser';
import { renderNode } from '../src/renderer';
import { RenderContext } from '../src/types';
import { Store } from '../src/state';
import { CONFIG } from '../src/config';
import { JSONSchema } from 'json-schema-to-ts';

describe('Format Support', () => {
  it('renders correct input types for specific formats', async () => {
    const schema = {
      type: 'object',
      properties: {
        emailField: { type: 'string', format: 'email', title: 'Email' },
        uriField: { type: 'string', format: 'uri', title: 'URI' },
        dateField: { type: 'string', format: 'date', title: 'Date' },
        timeField: { type: 'string', format: 'time', title: 'Time' },
        dateTimeField: { type: 'string', format: 'date-time', title: 'DateTime' },
        defaultField: { type: 'string', title: 'Default' }
      }
    };

    const rootNode = await parseSchema(schema as JSONSchema);
    const store = new Store({});
    const context: RenderContext = {
      store,
      config: CONFIG,
      nodeRegistry: new Map(),
      dataPathRegistry: new Map(),
      elementIdToDataPath: new Map(),
      customRenderers: {},
      rootNode
    };
    
    // Helper to extract type attribute from HTML string
    const getType = (node: Node) => {
      const input = (node as HTMLElement).querySelector('input') as HTMLInputElement | null;
      return input ? input.type : null;
    };

    const emailNode = renderNode(context, rootNode.properties!['emailField'], 'root');
    expect(getType(emailNode)).toBe('email');

    const uriNode = renderNode(context, rootNode.properties!['uriField'], 'root');
    expect(getType(uriNode)).toBe('url');

    const dateNode = renderNode(context, rootNode.properties!['dateField'], 'root');
    expect(getType(dateNode)).toBe('date');

    const timeNode = renderNode(context, rootNode.properties!['timeField'], 'root');
    expect(getType(timeNode)).toBe('time');

    const dateTimeNode = renderNode(context, rootNode.properties!['dateTimeField'], 'root');
    expect(getType(dateTimeNode)).toBe('datetime-local');

    const defaultNode = renderNode(context, rootNode.properties!['defaultField'], 'root');
    expect(getType(defaultNode)).toBe('text');
  });
});
