// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { init, setCustomRenderers, resetCustomRenderers, createOptionalRenderer } from '../src/index';

const encryptionSchema = {
  type: 'object',
  properties: {
    file: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        format: { type: 'string', default: 'normal' },
        encryption: {
          anyOf: [{ $ref: '#/$defs/EncryptionConfig' }, { type: 'null' }],
          default: null,
        },
      },
      required: ['path'],
    },
  },
  $defs: {
    EncryptionConfig: {
      type: 'object',
      properties: {
        cipher: { type: 'string', enum: ['xchacha20poly1305', 'aes256gcm'], default: 'xchacha20poly1305' },
        key_id: { type: 'string', default: 'default' },
        key: { type: 'string' },
      },
      required: ['key'],
      additionalProperties: false,
    },
  },
};

describe('default seeding', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'form-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
    resetCustomRenderers();
  });

  it('does not materialize an absent optional object from its children defaults', async () => {
    const handle = await init(container, encryptionSchema, { file: { path: '/tmp/out.jsonl' } }, () => {});
    const data = handle!.getData();

    expect(data.file).not.toHaveProperty('encryption');
    // Seeding is not disabled wholesale: `file` is present in the data, so its
    // own leaf defaults still round-trip.
    expect(data.file.format).toBe('normal');
    expect(await handle!.validate()).toBeNull();
  });

  it('does not materialize a plain optional object that has required properties', async () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        contact: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            newsletter: { type: 'boolean', default: true },
          },
          required: ['email'],
        },
      },
      required: ['name'],
    };

    const handle = await init(container, schema, { name: 'Ada' }, () => {});
    const data = handle!.getData();

    expect(data).not.toHaveProperty('contact');
    expect(await handle!.validate()).toBeNull();
  });

  // Decision: the seeding guard keys on *optional*, not on *absent*. A required
  // container that is missing from the data makes the document invalid already,
  // so materializing it cannot turn a valid document into an invalid one, and
  // defaults still round-trip for a form rendered over empty initial data.
  it('still seeds defaults into a required container that is absent from the data', async () => {
    const schema = {
      type: 'object',
      properties: {
        settings: {
          type: 'object',
          properties: {
            theme: { type: 'string', default: 'dark' },
          },
        },
      },
      required: ['settings'],
    };

    const handle = await init(container, schema, {}, () => {});
    expect(handle!.getData()).toEqual({ settings: { theme: 'dark' } });
  });

  // The other half of the guard: a held default is not dropped. The form displays
  // it, so it has to land as soon as the user's own edit creates the container.
  it('seeds a held default once the user fills a sibling of it', async () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        contact: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            newsletter: { type: 'boolean', default: true },
          },
          required: ['email', 'newsletter'],
        },
      },
      required: ['name'],
    };

    const handle = await init(container, schema, { name: 'Ada' }, () => {});
    expect(handle!.getData()).not.toHaveProperty('contact');

    const email = document.getElementById('root.contact.email') as HTMLInputElement;
    email.value = 'ada@example.com';
    email.dispatchEvent(new Event('input', { bubbles: true }));
    email.dispatchEvent(new Event('change', { bubbles: true }));

    expect(handle!.getData().contact).toEqual({ email: 'ada@example.com', newsletter: true });
    expect(await handle!.validate()).toBeNull();
  });

  it('leaves a held default pending while its container stays absent', async () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        contact: {
          type: 'object',
          properties: { email: { type: 'string' }, newsletter: { type: 'boolean', default: true } },
        },
      },
    };

    const handle = await init(container, schema, {}, () => {});
    const name = document.getElementById('root.name') as HTMLInputElement;
    name.value = 'Ada';
    name.dispatchEvent(new Event('change', { bubbles: true }));

    // Editing an unrelated field must not drag `contact` into the document.
    expect(handle!.getData()).toEqual({ name: 'Ada' });
  });

  // The optional renderer's toggle is the same story: checking it creates the
  // object, and the properties it reveals must bring their defaults with them.
  it('seeds held defaults when the optional toggle creates the object', async () => {
    const schema = {
      type: 'object',
      properties: {
        auth: {
          type: 'object',
          properties: {
            required: { type: 'boolean', title: 'Enabled' },
            scheme: { type: 'string', default: 'bearer' },
          },
        },
      },
    };

    setCustomRenderers({ auth: createOptionalRenderer() });
    const handle = await init(container, schema, {}, () => {});
    expect(handle!.getData()).not.toHaveProperty('auth');

    const toggle = document.getElementById('root.auth.required') as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));

    expect(handle!.getData().auth).toEqual({ required: true, scheme: 'bearer' });
  });

  it('keeps a schema-valid input document valid after init', async () => {
    const cases: { schema: any; data: any }[] = [
      { schema: encryptionSchema, data: { file: { path: '/tmp/out.jsonl' } } },
      {
        schema: encryptionSchema,
        data: { file: { path: '/tmp/out.jsonl', encryption: { key: 'secret' } } },
      },
      {
        schema: {
          type: 'object',
          properties: {
            routes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  retry: {
                    type: 'object',
                    properties: {
                      attempts: { type: 'integer', default: 3 },
                      backoff: { type: 'string' },
                    },
                    required: ['backoff'],
                  },
                },
                required: ['id'],
              },
            },
          },
        },
        data: { routes: [{ id: 'a' }] },
      },
    ];

    for (const { schema, data } of cases) {
      container.innerHTML = '';
      const handle = await init(container, schema, structuredClone(data), () => {});
      expect(await handle!.validate(), JSON.stringify(handle!.getData())).toBeNull();
    }
  });
});
