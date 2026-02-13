import $RefParser from "@apidevtools/json-schema-ref-parser";
import { JSONSchema } from "json-schema-to-ts";
import { getKeyText, getDescriptionText } from "./i18n";
import { CONFIG } from "./config";
import { initValidator } from "./validator";

/**
 * A simplified representation of a schema property, designed for easy
 * consumption by the UI renderer.
 */
export interface FormNode {
  key?: string;
  type: string; // e.g., 'string', 'number', 'boolean', 'object', 'array'
  title: string;
  description?: string;
  defaultValue?: any;
  properties?: { [key: string]: FormNode }; // For objects
  items?: FormNode; // For arrays
  prefixItems?: FormNode[];
  additionalProperties?: boolean | FormNode;
  oneOf?: FormNode[];
  enum?: any[];
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;
  readOnly?: boolean;
  // ... other properties we might need for rendering
}

/**
 * Parses a JSON schema from a given URL or object, dereferences all $refs,
 * and transforms it into a simplified tree of FormNode objects.
 *
 * @param schema - The JSON schema object or a URL/path to it.
 * @returns A promise that resolves to the root FormNode of the parsed schema.
 */
export async function parseSchema(schema: JSONSchema | string): Promise<FormNode> {
  try {
    const parser = new $RefParser();
    // Create a copy for AJV if it's an object, to prevent dereference from affecting it
    const schemaForAjv = typeof schema === 'object' ? JSON.parse(JSON.stringify(schema)) : schema;

    // Parse first to get the raw structure and check for root $ref
    const parsedSchema = (await parser.parse(schema as any)) as JSONSchema;

    const rootRef = typeof parsedSchema === "object" ? (parsedSchema as Exclude<JSONSchema, boolean>).$ref : undefined;
    const rootAdditionalPropertiesRef =
      typeof parsedSchema === "object" && parsedSchema.additionalProperties && typeof parsedSchema.additionalProperties === "object" && "$ref" in parsedSchema.additionalProperties
        ? (parsedSchema.additionalProperties as { $ref: string }).$ref
        : undefined;
    // Dereference the schema to resolve all $ref pointers
    const dereferencedSchema = (await parser.dereference(schema as any)) as JSONSchema;
    let finalSchema = dereferencedSchema;

    // If the root schema had a $ref, resolve it manually from the dereferenced definitions
    if (rootRef && rootRef.startsWith("#/") && typeof finalSchema === "object") {
      const refPath = rootRef.substring(2).split("/");
      let definition: any = dereferencedSchema;
      for (const part of refPath) {
        definition = definition?.[part];
      }
      if (definition) {
        finalSchema = { ...(dereferencedSchema as Exclude<JSONSchema, boolean>), ...definition };
      }
    }

    // If the root schema had a $ref in additionalProperties, resolve it manually
    if (rootAdditionalPropertiesRef && rootAdditionalPropertiesRef.startsWith("#/") && typeof finalSchema === "object") {
      const refPath = rootAdditionalPropertiesRef.substring(2).split("/");
      let definition: any = dereferencedSchema;
      for (const part of refPath) {
        definition = definition?.[part];
      }
      if (definition) {
        const schemaObj = finalSchema as Exclude<JSONSchema, boolean>;
        const existingAp = typeof schemaObj.additionalProperties === "object" ? schemaObj.additionalProperties : {};
        (schemaObj as any).additionalProperties = { ...existingAp, ...definition };
      }
    }

    // Transform the raw schema into our simplified FormNode tree
    
    // Initialize validator with bundled schema to handle recursion correctly without stack overflow
    const ajvParser = new $RefParser();
    const bundledSchema = (await ajvParser.bundle(schemaForAjv as any)) as JSONSchema;
    initValidator(bundledSchema);
    
    return transformSchemaToFormNode(finalSchema);
  } catch (err) {
    console.error("Error parsing schema:", err);
    throw err;
  }
}

/**
 * Recursively transforms a JSON schema object into a FormNode tree.
 * @param schema - The schema object to transform.
 * @param title - The title for the current node.
 * @returns The transformed FormNode.
 */
export function transformSchemaToFormNode(
  schema: JSONSchema,
  key: string = "",
  depth: number = 0,
  isRequired: boolean = false
): FormNode {
  if (depth > 16) {
    return { type: "string", title: key || "Max Depth Reached", description: "Maximum recursion depth exceeded." };
  }

  if (typeof schema === "boolean") {
    return { type: "boolean", title: key };
  }

  let schemaObj = schema as Exclude<JSONSchema, boolean>;

  // Check for allOf on the object
  if (schemaObj.allOf) {
    const merged = mergeAllOf(schemaObj);
    if (typeof merged === "boolean") {
      return { type: "boolean", title: key };
    }
    schemaObj = merged as Exclude<JSONSchema, boolean>;
  }

  // Base case and type checking
  let type = schemaObj.type;
  if (!type) {
    // Infer type if missing
    if (schemaObj.properties || schemaObj.additionalProperties || schemaObj.oneOf || schemaObj.anyOf) {
      type = "object";
    } else {
      type = Array.isArray(schemaObj.type) ? schemaObj.type[0] : "string";
    }
  } else if (Array.isArray(type)) {
    type = type[0];
  }

  // Determine the key to use for I18N lookup.
  // If we are at the root (title is empty), use the schema title if available.
  const titleFromKey = key ? formatTitle(key) : "";
  
  // Use schema title if present (even if empty string), otherwise fallback to key
  const explicitTitle = schemaObj.title;
  const resolvedTitle = explicitTitle !== undefined ? explicitTitle : titleFromKey;
  const i18nKey = resolvedTitle || "";

  const node: FormNode = {
    key: key || undefined,
    type: type as string,
    title: getKeyText(i18nKey, resolvedTitle),
    description: getDescriptionText(key, schemaObj.description || undefined),
    defaultValue: schemaObj.default,
    enum: schemaObj.enum as any[],
    required: isRequired,
    minLength: schemaObj.minLength,
    maxLength: schemaObj.maxLength,
    minimum: schemaObj.minimum,
    maximum: schemaObj.maximum,
    pattern: schemaObj.pattern,
    format: schemaObj.format,
    readOnly: schemaObj.readOnly,
  };

  // Handle oneOf
  const selection = schemaObj.oneOf || schemaObj.anyOf;
  if (selection) {
    node.oneOf = selection.map((sub: JSONSchema, idx: number) => {
      let mergedSub = mergeAllOf(sub);
      const subTitleKey = inferTitle(mergedSub, idx); // e.g., "aws"
      const subTitle = formatTitle(subTitleKey); // e.g., "Aws"

      // Pass empty string for key as oneOf options don't have a property key
      const subNode = transformSchemaToFormNode(mergedSub, "", depth + 1, isRequired);
      if (!subNode.title || subNode.title.startsWith('Option ')) {
        subNode.title = subTitle;
      }
      return subNode;
    });
  }

  // Recurse for object properties
  if (node.type === "object") {
    if (schemaObj.properties) {
      node.properties = {};
      for (const propKey in schemaObj.properties) {
        const propSchema = schemaObj.properties[propKey] as JSONSchema;
        const isPropRequired = schemaObj.required?.includes(propKey) || false;
        
        // If the property key is the same as the parent's title (case-insensitive),
        // it's likely a wrapper for a oneOf variant. Don't give it a title.
        if (node.title && propKey.toLowerCase() === node.title.toLowerCase()) {
          const ps = propSchema as any;
          // Only clear title for complex types (objects/arrays) to avoid removing labels from primitives
          if (ps.type === 'object' || ps.type === 'array' || ps.properties || ps.items || ps.oneOf || ps.anyOf) {
            ps.title = "";
          }
        }
        node.properties[propKey] = transformSchemaToFormNode(propSchema, propKey, depth + 1, isPropRequired);
      }
    }
    if (schemaObj.additionalProperties !== undefined) {
      if (typeof schemaObj.additionalProperties === "boolean") {
        node.additionalProperties = schemaObj.additionalProperties;
      } else {
        node.additionalProperties = transformSchemaToFormNode(
          schemaObj.additionalProperties as JSONSchema,
          "Additional Property",
          depth + 1,
          false
        );
      }
    }
  }

  // Recurse for array items
  if (node.type === "array") {
    // Assuming schema.items is a single schema object
    if (schemaObj.items && typeof schemaObj.items === "object" && !Array.isArray(schemaObj.items)) {
      node.items = transformSchemaToFormNode(schemaObj.items as JSONSchema, "", depth + 1, false);
    }
    // Handle prefixItems (JSON Schema 2020-12)
    if ((schemaObj as any).prefixItems && Array.isArray((schemaObj as any).prefixItems)) {
      node.prefixItems = (schemaObj as any).prefixItems.map((item: any) => transformSchemaToFormNode(item, "", depth + 1, false));
    }
  }

  return node;
}

function getConstOrEnum(schema: JSONSchema): string | undefined {
  if (typeof schema === "boolean") return undefined;
  const schemaObj = schema as Exclude<JSONSchema, boolean>;

  if (schemaObj.const !== undefined) return String(schemaObj.const);
  if (Array.isArray(schemaObj.enum) && schemaObj.enum.length === 1) return String(schemaObj.enum[0]);
  
  if (schemaObj.allOf) {
    for (const sub of schemaObj.allOf) {
      const val = getConstOrEnum(sub);
      if (val) return val;
    }
  }
  return undefined;
}

function inferTitle(schema: JSONSchema, index: number): string {
  if (typeof schema === "boolean") return `Option ${index + 1}`;
  const schemaObj = schema as Exclude<JSONSchema, boolean>;

  if (schemaObj.title) return schemaObj.title;
  
  const directVal = getConstOrEnum(schemaObj);
  if (directVal) return directVal;
  
  // Heuristic: If the object has exactly one property, use that property name as the title.
  if (schemaObj.properties) {
    const keys = Object.keys(schemaObj.properties);
    if (keys.length === 1) return keys[0];
  }

  const candidates = CONFIG.parser.titleCandidates;
  for (const key of candidates) {
    if (schemaObj.properties?.[key]) {
      const prop = schemaObj.properties[key] as JSONSchema;
      const val = getConstOrEnum(prop);
      if (val) return val;
      if (typeof prop === "object" && prop.default !== undefined) return String(prop.default);
    }
  }

  // Fallback: Check ANY property for a const/single-enum string value
  if (schemaObj.properties) {
    for (const key in schemaObj.properties) {
      const val = getConstOrEnum(schemaObj.properties[key] as JSONSchema);
      if (val && val.length < 50) return val;
    }
  }
  
  return `Option ${index + 1}`;
}

function mergeAllOf(schema: JSONSchema): JSONSchema {
  if (typeof schema === "boolean") {
    return schema;
  }
  const schemaObj = schema as Exclude<JSONSchema, boolean>;
  // Destructure to separate allOf from the rest, avoiding 'any' and 'delete'
  const { allOf, ...rest } = schemaObj;
  const merged: any = { ...rest };

  if (!allOf) return schemaObj;

  allOf.forEach((subSchema: JSONSchema) => {
    // Recursively merge nested allOfs to ensure we get all properties
    const flattenedSub = mergeAllOf(subSchema);

    if (typeof flattenedSub === "boolean") return;

    if (!merged.title && flattenedSub.title) {
      merged.title = flattenedSub.title;
    }
    if (flattenedSub.type && !merged.type) {
      merged.type = flattenedSub.type;
    }
    if (flattenedSub.properties) {
      merged.properties = { ...merged.properties, ...flattenedSub.properties };
    }
    if (flattenedSub.required) {
      merged.required = [...(merged.required || []), ...flattenedSub.required];
    }
    if (flattenedSub.additionalProperties !== undefined) {
      merged.additionalProperties = flattenedSub.additionalProperties;
    }
    if (flattenedSub.oneOf) {
      merged.oneOf = flattenedSub.oneOf;
    }
    if (flattenedSub.anyOf) {
      merged.anyOf = flattenedSub.anyOf;
    }
    // Merge validation keywords (simple overwrite/fill strategy)
    if (flattenedSub.minLength !== undefined) merged.minLength = flattenedSub.minLength;
    if (flattenedSub.maxLength !== undefined) merged.maxLength = flattenedSub.maxLength;
    if (flattenedSub.minimum !== undefined) merged.minimum = flattenedSub.minimum;
    if (flattenedSub.maximum !== undefined) merged.maximum = flattenedSub.maximum;
    if (flattenedSub.pattern !== undefined) merged.pattern = flattenedSub.pattern;
    if (flattenedSub.enum !== undefined) merged.enum = flattenedSub.enum;
    if (flattenedSub.format !== undefined) merged.format = flattenedSub.format;
  });

  return merged as JSONSchema;
}

function formatTitle(key: string): string {
  if (!key) return "";
  // Check mapping first
  const mapped = getKeyText(key, "");
  if (mapped) return mapped;

  return key
    .replace(/[-_]/g, " ") // snake_case and kebab-case
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase
    .replace(/\b\w/g, (c) => c.toUpperCase()); // Title Case
}
