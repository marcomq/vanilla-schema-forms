// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseSchema } from '../src/core/parser';
import { renderForm, createTypeSelectArrayRenderer } from '../src/vanilla-renderer/renderer';
import { rendererConfig } from '../src/vanilla-renderer/dom-renderer';
import { Store } from '../src/core/state';
import { CONFIG } from '../src/core/config';

const schema = {
  type: 'object',
  properties: {
    middlewares: {
      type: 'array',
      items: {
        oneOf: [
          { title: 'Retry', type: 'object', properties: { attempts: { type: 'integer', default: 3 } } },
          { title: 'Dlq', type: 'object', properties: { topic: { type: 'string' } } },
        ],
      },
    },
  },
};

async function render(store: Store<any>, container: HTMLElement) {
  const rootNode = await parseSchema(schema as any);
  renderForm(container, {
    rootNode,
    store,
    config: CONFIG,
    customRenderers: { middlewares: createTypeSelectArrayRenderer({ buttonLabel: 'Add Middleware' }) },
    nodeRegistry: new Map(),
    dataPathRegistry: new Map(),
    elementIdToDataPath: new Map(),
  } as any);
}

describe('type-select array picker', () => {
  let container: HTMLElement;
  let hadShowPicker: boolean;
  const proto = HTMLSelectElement.prototype as any;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'generated-form';
    document.body.appendChild(container);
    hadShowPicker = typeof proto.showPicker === 'function';
  });

  afterEach(() => {
    if (document.body.contains(container)) document.body.removeChild(container);
    if (!hadShowPicker) delete proto.showPicker;
  });

  it('uses the picker itself as the trigger when showPicker is unavailable', async () => {
    delete proto.showPicker;
    await render(new Store<any>({}), container);

    const select = document.getElementById('root.middlewares__type_picker') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.style.display).toBe('inline-block');
    expect(select.options[0].textContent).toBe('Add Middleware');
    // No dead first click: the button that could not open the picker is not rendered.
    expect(container.querySelector(`.${rendererConfig.triggers.arrayTypeToggle}`)).toBeNull();
  });

  it('keeps the picker visible after adding an item when it is the only trigger', async () => {
    delete proto.showPicker;
    const store = new Store<any>({});
    await render(store, container);

    const select = document.getElementById('root.middlewares__type_picker') as HTMLSelectElement;
    select.value = '0';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(store.getPath(['middlewares'])).toHaveLength(1);
    expect(select.style.display).toBe('inline-block');
    expect(select.value).toBe('');
  });

  it('keeps the button-then-picker flow where showPicker exists', async () => {
    proto.showPicker = function () {};
    await render(new Store<any>({}), container);

    const button = container.querySelector(`.${rendererConfig.triggers.arrayTypeToggle}`) as HTMLButtonElement;
    const select = document.getElementById('root.middlewares__type_picker') as HTMLSelectElement;
    expect(button).not.toBeNull();
    expect(select.style.display).toBe('none');

    button.click();
    expect(button.style.display).toBe('none');
    expect(select.style.display).toBe('inline-block');
  });
});
