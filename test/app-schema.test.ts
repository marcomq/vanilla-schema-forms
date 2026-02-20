import { describe, it, expect, afterEach } from 'vitest';
import { init } from '../src/index';
import appSchema from './fixtures/appSchema.json';

describe('App Schema', () => {
  let container: HTMLElement;

  afterEach(() => {
    if (container && document.body.contains(container)) {
      document.body.removeChild(container);
    }
  });

  it('should initialize with correct json data', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);

    const initialData = {
        "log_level": "debug,mq_bridge=trace",
        "logger": "plain",
        "ui_addr": "0.0.0.0:8080",
        "metrics_addr": "",
        "routes": {
            "http_to_file": {
                "input": {
                    "middlewares": [],
                    "http": {
                        "url": "127.0.0.1:3000",
                        "tls": {
                            "required": false,
                            "ca_file": null,
                            "cert_file": null,
                            "key_file": null,
                            "cert_password": null,
                            "accept_invalid_certs": false
                        },
                        "workers": null,
                        "message_id_header": null,
                        "request_timeout_ms": null
                    }
                },
                "output": {
                    "middlewares": [],
                    "file": {
                        "path": "output.txt",
                        "subscribe_mode": false,
                        "delete": null
                    }
                },
                "concurrency": 1,
                "batch_size": 1,
                "commit_concurrency_limit": 4096
            }
        }
    };

    const form = await init(container, appSchema, initialData);
    
    // Check internal data state
    expect(form?.getData()).toEqual(initialData);

    // Check DOM reflection for a few key fields
    const logLevel = container.querySelector('input[name="AppConfig[log_level]"]') as HTMLInputElement;
    expect(logLevel.value).toBe('debug,mq_bridge=trace');

    const httpUrl = container.querySelector('input[name="AppConfig[routes][http_to_file][input][http][url]"]') as HTMLInputElement;
    expect(httpUrl.value).toBe('127.0.0.1:3000');
  });
});
