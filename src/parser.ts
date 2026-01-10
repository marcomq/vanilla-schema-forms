import $RefParser from "@apidevtools/json-schema-ref-parser";
import { JSONSchema } from "json-schema-to-ts";

/**
 * A simplified representation of a schema property, designed for easy
 * consumption by the UI renderer.
 */
export interface FormNode {
  type: string; // e.g., 'string', 'number', 'boolean', 'object', 'array'
  title: string;
  description?: string;
  defaultValue?: any;
  properties?: { [key: string]: FormNode }; // For objects
  items?: FormNode; // For arrays
  additionalProperties?: boolean | FormNode;
  oneOf?: FormNode[];
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
    // Parse first to get the raw structure and check for root $ref
    const parsedSchema = (await parser.parse(schema as any)) as JSONSchema;
    console.log(parsedSchema);

    const rootRef = typeof parsedSchema === "object" ? (parsedSchema as Exclude<JSONSchema, boolean>).$ref : undefined;
    const rootAdditionalPropertiesRef =
      typeof parsedSchema === "object" && parsedSchema.additionalProperties && typeof parsedSchema.additionalProperties === "object" && "$ref" in parsedSchema.additionalProperties
        ? (parsedSchema.additionalProperties as { $ref: string }).$ref
        : undefined;

    console.log("a");
    // Dereference the schema to resolve all $ref pointers
    const dereferencedSchema = (await parser.dereference(schema as any)) as JSONSchema;
    console.log("b");
    let finalSchema = dereferencedSchema;

    // If the root schema had a $ref, resolve it manually from the dereferenced definitions
    if (rootRef && rootRef.startsWith("#/") && typeof finalSchema === "object") {
      console.log(1);
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
      console.log(2);
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
    console.log("dereferencedSchema:", finalSchema);
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
function transformSchemaToFormNode(
  schema: JSONSchema,
  title: string = "",
  depth: number = 0
): FormNode {
  if (depth > 16) {
    return { type: "string", title: title || "Max Depth Reached", description: "Maximum recursion depth exceeded." };
  }

  if (typeof schema === "boolean") {
    return { type: "boolean", title };
  }

  let schemaObj = schema as Exclude<JSONSchema, boolean>;

  // Check for allOf on the object
  if (schemaObj.allOf) {
    const merged = mergeAllOf(schemaObj);
    if (typeof merged === "boolean") {
      return { type: "boolean", title };
    }
    schemaObj = merged as Exclude<JSONSchema, boolean>;
  }

  // Base case and type checking
  let type = schemaObj.type;
  if (!type) {
    // Infer type if missing
    if (schemaObj.properties || schemaObj.additionalProperties || schemaObj.oneOf) {
      type = "object";
    } else {
      type = Array.isArray(schemaObj.type) ? schemaObj.type[0] : "string";
    }
  } else if (Array.isArray(type)) {
    type = type[0];
  }

  const node: FormNode = {
    type: type as string,
    title: schemaObj.title || title,
    description: schemaObj.description,
    defaultValue: schemaObj.default,
  };

  // Handle oneOf
  if (schemaObj.oneOf) {
    node.oneOf = schemaObj.oneOf.map((sub: JSONSchema, idx: number) => {
      const mergedSub = mergeAllOf(sub);
      return transformSchemaToFormNode(mergedSub, inferTitle(mergedSub, idx), depth + 1);
    });
  }

  // Recurse for object properties
  if (node.type === "object") {
    if (schemaObj.properties) {
      node.properties = {};
      for (const key in schemaObj.properties) {
        const propSchema = schemaObj.properties[key] as JSONSchema;
        node.properties[key] = transformSchemaToFormNode(propSchema, key, depth + 1);
      }
    }
    if (schemaObj.additionalProperties !== undefined) {
      if (typeof schemaObj.additionalProperties === "boolean") {
        node.additionalProperties = schemaObj.additionalProperties;
      } else {
        node.additionalProperties = transformSchemaToFormNode(
          schemaObj.additionalProperties as JSONSchema,
          "Additional Property",
          depth + 1
        );
      }
    }
  }

  // Recurse for array items
  if (schemaObj.type === "array" && schemaObj.items) {
    // Assuming schema.items is a single schema object
    if (typeof schemaObj.items === "object" && !Array.isArray(schemaObj.items)) {
      node.items = transformSchemaToFormNode(schemaObj.items as JSONSchema, "Item", depth + 1);
    }
  }

  return node;
}

function getConstOrEnum(schema: JSONSchema): string | undefined {
  if (typeof schema === "boolean") return undefined;
  const schemaObj = schema as Exclude<JSONSchema, boolean>;

  if (schemaObj.const) return String(schemaObj.const);
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

  const candidates = ['type', 'name', 'kind', 'id', 'mode', 'strategy', 'action', 'method', 'service', 'provider'];
  for (const key of candidates) {
    if (schemaObj.properties?.[key]) {
      const prop = schemaObj.properties[key] as JSONSchema;
      const val = getConstOrEnum(prop);
      if (val) return val;
      if (typeof prop === "object" && prop.default) return String(prop.default);
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
  });

  return merged as JSONSchema;
}
