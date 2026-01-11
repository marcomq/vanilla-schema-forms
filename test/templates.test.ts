import { describe, it, expect } from 'vitest';
import * as templates from '../src/templates';
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
    const html = templates.renderString(node, 'user_id');
    
    expect(html).toContain('id="user_id"');
    expect(html).toContain('required');
    expect(html).toContain('minlength="3"');
    expect(html).toContain('maxlength="20"');
    expect(html).toContain('pattern="^[a-z]+$"');
    // Check label for required asterisk
    expect(html).toContain('Username <span class="text-danger">*</span>');
  });

  it('renderNumber should include range attributes', () => {
    const node: FormNode = {
      type: 'number',
      title: 'Age',
      minimum: 18,
      maximum: 99
    };
    const html = templates.renderNumber(node, 'age_id');
    
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
    const html = templates.renderBoolean(node, 'bool_id');
    
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
    const html = templates.renderSelect(node, 'select_id', node.enum);
    
    expect(html).toContain('<option value="blue" selected>blue</option>');
    expect(html).toContain('<option value="red" >red</option>');
  });
});