import {
  applyWebAwesomeTheme,
  createAdvancedOptionsRenderer,
  createOptionalRenderer,
  createTypeSelectArrayRenderer,
  init,
  setCustomRenderers,
} from "../../dist/vanilla-schema-forms.es.js";

applyWebAwesomeTheme();

setCustomRenderers({
  connection: createAdvancedOptionsRenderer(["protocol", "host", "port"]),
  tls: createOptionalRenderer("enabled"),
  middlewares: createTypeSelectArrayRenderer({
    buttonLabel: "Add Middleware",
    itemLabel: "Middleware",
  }),
});

const schema = {
  type: "object",
  title: "Gateway",
  properties: {
    name: { type: "string", title: "Name", default: "orders-eu" },
    environment: {
      type: "string",
      title: "Environment",
      enum: ["development", "staging", "production"],
      default: "production",
    },
    connection: {
      type: "object",
      title: "Connection",
      properties: {
        protocol: {
          type: "string",
          title: "Protocol",
          enum: ["https", "mqtt", "nats"],
          default: "https",
        },
        host: { type: "string", title: "Host", default: "api.example.com" },
        port: { type: "integer", title: "Port", default: 443 },
        path: { type: "string", title: "Path", default: "/orders" },
        topic: { type: "string", title: "Topic", default: "orders.events" },
        timeout_ms: {
          type: "integer",
          title: "Timeout (ms)",
          default: 8000,
        },
        retries: { type: "integer", title: "Retries", default: 3 },
      },
      required: ["protocol", "host", "port"],
    },
    tls: {
      type: "object",
      title: "TLS",
      properties: {
        enabled: { type: "boolean", title: "Enable TLS", default: true },
        server_name: {
          type: "string",
          title: "Server Name",
          default: "api.example.com",
        },
        cert_file: {
          type: "string",
          title: "Certificate Path",
          default: "/etc/certs/client.pem",
        },
        key_file: {
          type: "string",
          title: "Private Key Path",
          default: "/etc/certs/client-key.pem",
        },
      },
    },
    brokers: {
      type: "array",
      title: "Brokers",
      items: {
        type: "object",
        title: "Broker",
        properties: {
          name: { type: "string", title: "Name" },
          url: { type: "string", title: "URL" },
        },
      },
    },
    middlewares: {
      type: "array",
      title: "Middlewares",
      items: {
        oneOf: [
          {
            type: "object",
            title: "Retry Policy",
            properties: {
              retry_policy: {
                type: "object",
                title: "Retry Policy",
                properties: {
                  attempts: { type: "integer", title: "Attempts", default: 5 },
                  backoff_ms: { type: "integer", title: "Backoff (ms)", default: 200 },
                },
              },
            },
          },
          {
            type: "object",
            title: "Header Map",
            properties: {
              header_map: {
                type: "object",
                title: "Header Map",
                additionalProperties: { type: "string", title: "Value" },
              },
            },
          },
        ],
      },
    },
    metadata: {
      type: "object",
      title: "Metadata",
      additionalProperties: { type: "string", title: "Value" },
    },
  },
};

const initialData = {
  name: "orders-eu",
  environment: "production",
  connection: {
    protocol: "https",
    host: "api.example.com",
    port: 443,
    path: "/orders",
  },
  tls: {
    enabled: true,
    server_name: "api.example.com",
  },
  brokers: [
    {
      name: "Primary Cluster",
      url: "mqtts://broker-1.example.com",
    },
  ],
  metadata: {
    owner: "platform",
  },
};

init("form-container", schema, initialData, (data) => {
  document.getElementById("output").textContent = JSON.stringify(data, null, 2);
});
