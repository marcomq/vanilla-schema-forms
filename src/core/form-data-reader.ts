import { FormNode } from "./parser";

/**
 * Generates the default data structure for a given FormNode.
 * This replaces the need to scrape the DOM for initial data.
 */
export function generateDefaultData(node: FormNode): any {
  if (node.defaultValue !== undefined) {
    return node.defaultValue;
  }

  if (node.type === 'object') {
    const obj: any = {};
    
    if (node.properties) {
      for (const key in node.properties) {
        const prop = node.properties[key];
        
        // Only include properties that are required, have a default value,
        // or are complex types (objects/arrays) which should be initialized.
        const shouldInclude = prop.required || 
                              prop.defaultValue !== undefined || 
                              prop.type === 'object' || 
                              prop.type === 'array';

        if (shouldInclude) {
          const value = generateDefaultData(prop);
          if (value !== undefined) {
            obj[key] = value;
          }
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
    
    // For objects, always return an object, even if empty. This is crucial for array items.
    return obj;
  }

  if (node.type === 'array') {
    if (node.prefixItems && node.prefixItems.length > 0) {
      return node.prefixItems.map(item => generateDefaultData(item));
    }
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