import { describe, it, expect } from 'vitest';
import { domRenderer } from '../src/dom-renderer';
import { FormNode } from '../src/parser';

describe('Templates', () => {
  it('renderString should include validation attributes', () => {
    const node: FormNode = {
      type: 'string',
      title: 'Username',
      required: true,
      minLength: 3,
      maxLength: 20,
      pattern: '^[a-z]+$'
    };
    const element = domRenderer.renderString(node, 'user_id', "user_id");
    const html = (element as HTMLElement).outerHTML;
    
    expect(html).toContain('id="user_id"');
    expect(html).toContain('required');
    expect(html).toContain('minlength="3"');
    expect(html).toContain('maxlength="20"');
    expect(html).toContain('pattern="^[a-z]+$"');
    expect(html).toContain('Username<span class="text-danger">*</span>');
  });

  it('renderNumber should include range attributes', () => {
    const node: FormNode = {
      type: 'number',
      title: 'Age',
      minimum: 18,
      maximum: 99
    };
    const element = domRenderer.renderNumber(node, 'age_id', "age_id");
    const html = (element as HTMLElement).outerHTML;
    
    expect(html).toContain('type="number"');
    expect(html).toContain('min="18"');
    expect(html).toContain('max="99"');
  });

  it('renderBoolean should handle checked state', () => {
    const node: FormNode = {
      type: 'boolean',
      title: 'Agree',
      defaultValue: true
    };
    const element = domRenderer.renderBoolean(node, 'bool_id', "bool_id");
    const html = (element as HTMLElement).outerHTML;
    
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
  });

  it('renderSelect should mark selected option', () => {
    const node: FormNode = {
      type: 'string',
      title: 'Color',
      defaultValue: 'blue',
      enum: ['red', 'blue', 'green']
    };
    const element = domRenderer.renderSelect(node, 'select_id', node.enum as string[], "select_id");
    const html = (element as HTMLElement).outerHTML;
    
    expect(html).toContain('<option value="blue" selected="true">blue</option>');
    expect(html).toContain('<option value="red">red</option>');
  });
});