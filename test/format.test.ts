import { describe, it, expect } from 'vitest';
import { parseSchema } from '../src/parser';
import { renderNode } from '../src/renderer';
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
    
    // Helper to extract type attribute from HTML string
    const getType = (html: string) => {
      const match = html.match(/<input[^>]*type="([^"]+)"/);
      return match ? match[1] : null;
    };

    const emailHtml = renderNode(rootNode.properties!['emailField'], 'root.emailField') as string;
    expect(getType(emailHtml)).toBe('email');

    const uriHtml = renderNode(rootNode.properties!['uriField'], 'root.uriField') as string;
    expect(getType(uriHtml)).toBe('url');

    const dateHtml = renderNode(rootNode.properties!['dateField'], 'root.dateField') as string;
    expect(getType(dateHtml)).toBe('date');

    const timeHtml = renderNode(rootNode.properties!['timeField'], 'root.timeField') as string;
    expect(getType(timeHtml)).toBe('time');

    const dateTimeHtml = renderNode(rootNode.properties!['dateTimeField'], 'root.dateTimeField') as string;
    expect(getType(dateTimeHtml)).toBe('datetime-local');

    const defaultHtml = renderNode(rootNode.properties!['defaultField'], 'root.defaultField') as string;
    expect(getType(defaultHtml)).toBe('text');
  });
});
