# JSON Schema Form Generator

This project is a web-based application that dynamically generates HTML forms from a given JSON Schema. It's built using Vite for a fast development experience and uses TypeScript for type safety.

## Features

-   **Dynamic Form Generation**: Automatically creates HTML forms based on JSON Schema definitions.
-   **Schema Dereferencing**: Resolves `$ref` pointers within your JSON Schema using `@apidevtools/json-schema-ref-parser`.
-   **Type-Safe Development**: Written in TypeScript for robust and maintainable code.
-   **Modern Tooling**: Utilizes Vite for development and bundling, providing a fast and efficient workflow.
-   **Customizable UI**: Configurable field sorting, visibility, and text overrides via configuration files.
-   **Unit Testing**: Includes tests for core parsing logic using Vitest.

## Status

This project is in a very early pre-alpha state. I am not using it yet and it may not be working correctly for you.

## How it Works

The application follows a clear pipeline to transform a JSON Schema into an interactive form:

1.  **Schema Loading**: The `index.html` file (located in the project root) is the entry point. It loads the main application script (`src/index.ts`).
2.  **Schema Fetching & Parsing**: The `src/index.ts` script fetches the `schema.json` file. It then uses `src/parser.ts` to parse this schema.
3.  **Schema Dereferencing and Transformation**: `src/parser.ts` utilizes the `@apidevtools/json-schema-ref-parser` library to dereference any `$ref` pointers in the JSON Schema. It then transforms the raw JSON Schema into a simplified, UI-friendly `FormNode` tree structure.
4.  **Form Rendering**: `src/index.ts` passes the `FormNode` tree to `src/renderer.ts`, which is responsible for generating and injecting the corresponding HTML form elements into the DOM.
5.  **Live JSON Output**: As the user interacts with the generated form, the application dynamically updates a live JSON output, reflecting the current state of the form data.

## Project Structure

```text
.
├── index.html            # Main HTML entry point
├── package.json          # Project dependencies and scripts
├── schema.json           # Example JSON Schema
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite configuration (including polyfills for Node.js modules)
├── public/               # Static assets (e.g., schema.json will be moved here if needed)
│   └── (optional: schema.json) # schema.json is served from here
└── src/
    ├── config.ts         # Configuration for sorting, visibility, and heuristics
    ├── i18n.ts           # Text overrides and internationalization mappings
    ├── index.ts          # Main application logic, orchestrates parsing and rendering
    ├── parser.ts         # Parses JSON Schema, dereferences, and transforms to FormNode tree
    ├── parser.test.ts    # Unit tests for the parser
    └── renderer.ts       # Renders the FormNode tree into HTML form elements
    └── templates.ts      # HTML template strings for UI components
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