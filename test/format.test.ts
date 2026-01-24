import { describe, it, expect } from 'vitest';
import { parseSchema } from '../src/parser';
import { renderNode, RenderContext } from '../src/renderer';
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
      const html = (node as HTMLElement).outerHTML;
      const match = html.match(/<(?:input|vsf-input)[^>]*type="([^"]+)"/);
      return match ? match[1] : null;
    };

    const emailNode = renderNode(context, rootNode.properties!['emailField'], 'root.emailField');
    expect(getType(emailNode)).toBe('email');

    const uriNode = renderNode(context, rootNode.properties!['uriField'], 'root.uriField');
    expect(getType(uriNode)).toBe('url');

    const dateNode = renderNode(context, rootNode.properties!['dateField'], 'root.dateField');
    expect(getType(dateNode)).toBe('date');

    const timeNode = renderNode(context, rootNode.properties!['timeField'], 'root.timeField');
    expect(getType(timeNode)).toBe('time');

    const dateTimeNode = renderNode(context, rootNode.properties!['dateTimeField'], 'root.dateTimeField');
    expect(getType(dateTimeNode)).toBe('datetime-local');

    const defaultNode = renderNode(context, rootNode.properties!['defaultField'], 'root.defaultField');
    expect(getType(defaultNode)).toBe('text');
  });
});
