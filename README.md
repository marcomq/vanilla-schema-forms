# Vanilla Schema Forms - A JSON schema driven form generator

Vanilla Schema Forms is a web-based application that dynamically generates HTML forms from a given JSON Schema. It is built using Vanilla TypeScript (no heavy frameworks) and Vite for a fast development experience.

## Features

-   **Dynamic Form Generation**: Automatically creates HTML forms based on JSON Schema definitions.
-   **Hyperscript Rendering**: Lightweight DOM generation using a hyperscript helper, avoiding innerHTML injection risks.
-   **Schema Dereferencing**: Resolves `$ref` pointers within your JSON Schema using `@apidevtools/json-schema-ref-parser`.
-   **Type-Safe Development**: Written in TypeScript for robust and maintainable code.
-   **Modern Tooling**: Utilizes Vite for development and bundling, providing a fast and efficient workflow.
-   **Customizable UI**: Configurable field sorting, visibility, and text overrides via configuration files.
-   **Unit Testing**: Includes tests for core parsing logic using Vitest.

## Status

Vanilla Schema Forms is in a very early state. I am not using it yet and it may be changed in the future.

## Playground

Check out the **playground**  [here](https://marcomq.github.io/vanilla-schema-forms/)

## How it Works

The application follows a clear pipeline to transform a JSON Schema into an interactive form:

1.  **Schema Loading**: The `index.html` file (located in the project root) is the entry point. It loads the main application script (`src/index.ts`).
2.  **Schema Fetching & Parsing**: The `src/index.ts` script fetches the `schema.json` file. It then uses `src/parser.ts` to parse this schema.
3.  **Schema Dereferencing and Transformation**: `src/parser.ts` utilizes the `@apidevtools/json-schema-ref-parser` library to dereference any `$ref` pointers in the JSON Schema. It then transforms the raw JSON Schema into a simplified, UI-friendly `FormNode` tree structure.
4.  **Form Rendering**: `src/index.ts` passes the `FormNode` tree to `src/renderer.ts`. This orchestrator delegates the actual DOM creation to `src/dom-renderer.ts`, which produces the final HTML structure.
5.  **Live JSON Output**: As the user interacts with the generated form, the application dynamically updates a live JSON output, reflecting the current state of the form data.

## Validation

The application uses AJV (Another JSON Schema Validator) for robust, standard-compliant validation.

### Architecture

1.  **Initialization**: When a schema is parsed in `src/parser.ts`, a bundled version (resolving external refs but keeping internal refs to avoid recursion issues) is passed to `src/validator.ts`.
2.  **Compilation**: `src/validator.ts` initializes an `Ajv2020` instance, registers standard formats (via `ajv-formats`) and custom formats (e.g., `uint64`), and compiles the schema into a validation function.
3.  **Mapping**: During rendering (`src/renderer.ts`), the application builds a registry mapping AJV data paths (JSON pointers like `/server/port`) to HTML Element IDs.
4.  **Real-time Validation**:
    *   When the user modifies the form, the current data is extracted from the DOM.
    *   The data is passed to the compiled AJV validator.
    *   If errors occur, they are mapped back to specific DOM elements using the registry, and error messages are displayed inline.

### Supported Formats

In addition to standard JSON Schema formats (email, date-time, etc.), the validator supports the following custom integer formats often found in systems like Protobuf or Go:
*   `uint`, `uint8`, `uint16`, `uint32`, `uint64`

## Project Structure

```text
.
├── index.html            # Main HTML entry point
├── package.json          # Project dependencies and scripts
├── schema.json           # Example JSON Schema
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite configuration (including polyfills for Node.js modules)
└── src/
    ├── config.ts         # Configuration for sorting, visibility, and heuristics
    ├── dom-renderer.ts   # DOM generation logic using hyperscript
    ├── i18n.ts           # Text overrides and internationalization mappings
    ├── index.ts          # Main application logic, orchestrates parsing and rendering
    ├── form-data-reader.ts # Logic to read data back from the DOM
    ├── ui-schema-adapter.ts # Adapter for JSON Forms UI Schemas
    ├── parser.ts         # Parses JSON Schema, dereferences, and transforms to FormNode tree
    ├── parser.test.ts    # Unit tests for the parser
    └── renderer.ts       # Renders the FormNode tree into HTML form elements
```

## Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Development Server**:
    To start the development server and view the application in your browser:
    ```bash
    npm run dev
    ```
    The application will typically be available at `http://localhost:5173/` (or a similar port if 5173 is in use).

## Troubleshooting

-   **"Buffer is not defined" or "Module 'path' has been externalized" errors**: This project uses Node.js polyfills via `vite-plugin-node-polyfills` to make `@apidevtools/json-schema-ref-parser` compatible with browser environments. Ensure this plugin is correctly configured in `vite.config.ts` and `buffer` and `path` are included in its `include` option.
-   **404 errors for `index.html`**: Ensure `index.html` is located in the root of your project directory.

## Customization

Vanilla Schema Forms allows extensive customization through configuration and custom renderers.

### Global Configuration

You can configure global behavior like sorting and visibility using `setConfig`.

```typescript
import { setConfig } from "./src/index";

setConfig({
  sorting: {
    defaultPriority: ["name", "id", "type"], // These keys always appear at the top
    defaultRenderLast: ["metadata", "tags"]   // These keys always appear at the bottom
  },
  visibility: {
    hiddenPaths: ["root.internalId"], // Hide specific paths
    hiddenKeys: ["password"]          // Hide keys globally
  }
});
```

### Custom Renderers

You can override the rendering of specific fields based on their key or path.

```typescript
import { setCustomRenderers, domRenderer } from "./src/index";

setCustomRenderers({
  // Set Custom Renderer: Complete control over the DOM element
  "color": {
    render: (node, path, elementId, dataPath, context) => {
      const input = document.createElement("input");
      input.type = "color";
      input.id = elementId;
      input.value = node.defaultValue || "#000000";
      
      // Use the default wrapper for consistent labeling/layout
      return domRenderer.renderFieldWrapper(node, elementId, input);
    }
  }
});
```

### Customization Guidelines & Best Practices

Customizing the rendering logic provides great flexibility but can lead to maintenance issues if not structured correctly.

1.  **Preserve Event Bubbling**: The core architecture relies on `change` and `input` events bubbling up from form elements. If you build a custom widget (e.g., a `div`-based switch), ensure it dispatches a `change` event or updates a hidden `<input>` element. Without this, validation and data retrieval will fail.
2.  **Use `domRenderer` Helpers**: Avoid re-implementing standard logic. Use `domRenderer.renderFieldWrapper` to wrap your custom inputs. This ensures consistent rendering of labels, descriptions, and error placeholders.
3.  **Avoid Monolithic Renderers**: Don't create a single "Master Renderer" with huge `if/else` blocks. Register small, specific renderers for specific keys or types using `setCustomRenderers`.
4.  **Security**: Avoid using `innerHTML` to prevent XSS vulnerabilities. Use `document.createElement` or the internal `h()` hyperscript helper.

### Layout Grouping

You can group fields together (e.g., for horizontal layout) using the `layout.groups` configuration in `src/config.ts`.

```typescript
import { setConfig } from "./config";

setConfig({
  layout: {
    groups: {
      // Key is the ID of the parent object (usually the title)
      "Connection": [
        {
          keys: ["host", "port"], // Fields to group
          className: "d-flex gap-3", // CSS classes for the container
          title: "Endpoint" // Optional title for the group
        }
      ]
    }
  }
});
```

### JSON Forms Adapter

If you prefer using a JSON Forms compatible UI Schema, you can use the built-in adapter.

```typescript
import { adaptUiSchema } from "./src/index";

const uiSchema = {
  type: "HorizontalLayout",
  elements: [
    { type: "Control", scope: "#/properties/host" },
    { type: "Control", scope: "#/properties/port" }
  ]
};

// Applies the UI Schema to the object with ID "Connection"
adaptUiSchema(uiSchema, "Connection");
```

### Architectural Vision: Supporting UI Frameworks (React, etc.)

While the current implementation is a lightweight, dependency-free DOM renderer, a primary goal is to evolve the architecture to seamlessly support modern UI frameworks like React. The current approach of mounting framework components inside a vanilla renderer can be complex and inefficient for full-form customizations.

To make this easier and more robust, the plan is to refactor the library into a "headless" core engine with separate, optional renderer packages.

**The Proposed Structure:**

1.  **`@vanilla-schema-forms/core`**: A framework-agnostic engine that handles:
    *   Schema parsing, dereferencing, and transformation into the `FormNode` tree.
    *   AJV-based validation.
    *   State management (data and errors).
    *   Configuration and UI schema adaptation.
    *   **It will have zero DOM rendering logic.**

2.  **`@vanilla-schema-forms/vanilla-renderer`**: The default, lightweight renderer (the current implementation), which consumes the core engine to render standard HTML elements.

3.  **`@vanilla-schema-forms/react-renderer`**: A new package that provides React hooks and components to build forms.
    *   A `useForm()` hook that connects to the core engine.
    *   A `<Field />` component that can dynamically render the correct input based on the `FormNode`.
    *   A system for providing a custom set of components (e.g., a Material UI renderer set).

**What this means for you:**

With this architecture, building a fully custom form with React and Material UI would become straightforward:

```jsx
// Future-state example
import { VanillaSchemaForm } from '@vanilla-schema-forms/react-renderer';
import { materialRenderers } from '@vanilla-schema-forms/material-renderer';

function MyForm({ schema }) {
  return (
    <VanillaSchemaForm
      schema={schema}
      renderers={materialRenderers}
      onChange={(data, errors) => console.log(data, errors)}
    />
  );
}
```

This approach separates the complex business logic of schema processing from the presentation layer, making the library far more flexible and easier to integrate into any project, while still offering a zero-dependency option for those who need it.



## Testing

This project uses Vitest for unit testing.
