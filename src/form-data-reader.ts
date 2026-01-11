import { FormNode } from "./parser";

/**
 * Generates the default data structure for a given FormNode.
 * This replaces the need to scrape the DOM for initial data.
 */
export function generateDefaultData(node: FormNode): any {
  if (node.defaultValue !== undefined) return node.defaultValue;

  if (node.type === 'object') {
    const obj: any = {};
    
    if (node.properties) {
      for (const key in node.properties) {
        const prop = node.properties[key];
        // Include if required, has default, or is a complex type (object/array/oneOf) that might contain defaults
        const isComplex = prop.type === 'object' || prop.type === 'array' || (prop.oneOf && prop.oneOf.length > 0);
        if (prop.required || prop.defaultValue !== undefined || isComplex) {
           obj[key] = generateDefaultData(prop);
        }
      }
    }

    // Handle oneOf defaults
    if (node.oneOf && node.oneOf.length > 0) {
      let selectedIndex = node.oneOf.findIndex(opt => opt.type === 'null');
      if (selectedIndex === -1) {
        selectedIndex = node.oneOf.findIndex(opt => {
          const title = opt.title ? opt.title.toLowerCase() : "";
          return title === 'null' || title === 'none';
        });
      }
      if (selectedIndex === -1) selectedIndex = 0;

      const oneOfDefault = generateDefaultData(node.oneOf[selectedIndex]);
      if (oneOfDefault !== undefined) {
        if (typeof oneOfDefault === 'object' && oneOfDefault !== null) {
          Object.assign(obj, oneOfDefault);
        }
      }
    }
    
    return obj;
  }

  if (node.type === 'array') {
    return [];
  }

  if (node.enum && node.enum.length > 0) {
    return node.enum[0];
  }

  switch (node.type) {
    case 'string': return "";
    case 'number': 
    case 'integer': return 0;
    case 'boolean': return false;
    case 'null': return null;
    default: return undefined;
  }
}